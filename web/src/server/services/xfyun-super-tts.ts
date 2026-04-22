import crypto from "crypto";

/**
 * 讯飞超拟人 TTS 业务错误（映射为 HTTP 状态）
 */
export class XfyunTtsError extends Error {
  /**
   * @param message - 可对用户展示的简短说明
   * @param statusCode - 建议返回前端的 HTTP 状态
   * @param code - 稳定错误码，便于日志检索
   */
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly xfyunCode?: number
  ) {
    super(message);
    this.name = "XfyunTtsError";
  }
}

interface XfyunWsHeader {
  code?: number;
  message?: string;
  sid?: string;
  status?: number;
}

interface XfyunWsMessage {
  header?: XfyunWsHeader;
  payload?: {
    audio?: {
      audio?: string;
      status?: number;
    };
    tts?: {
      audio?: string;
      status?: number;
    };
  };
}

type WsLike = {
  send(data: string): void;
  close(): void;
  on(event: "open", listener: () => void): void;
  on(event: "error", listener: (err: Error) => void): void;
  on(event: "close", listener: () => void): void;
  on(event: "message", listener: (data: unknown) => void): void;
};

/**
 * 开发环境日志（不落密钥）
 */
function devLog(tag: string, data: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;
  console.log(`[xfyun-tts] ${tag}`, JSON.stringify(data));
}

/**
 * 构造带鉴权 query 的 WebSocket URL（与官方 Python 示例一致）
 *
 * @param requestUrl - 控制台提供的 wss 地址（不含 query）
 */
export function assembleXfyunWsAuthUrl(
  requestUrl: string,
  apiKey: string,
  apiSecret: string
): string {
  const u = new URL(requestUrl);
  const host = u.host;
  const path = u.pathname;
  const date = new Date().toUTCString();

  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(signatureOrigin, "utf8")
    .digest("base64");

  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authorizationOrigin, "utf8").toString("base64");

  const params = new URLSearchParams({
    host,
    date,
    authorization,
  });

  return `${requestUrl}?${params.toString()}`;
}

/**
 * 按文档要求弱化非法字符（制表符、emoji、不可见控制符等）
 *
 * @param text - 原始朗读文本
 * @param maxChars - 最大字符数（防止超长）
 */
export function sanitizeSuperTtsText(text: string, maxChars = 1200): string {
  let s = text.replace(/\t/g, " ").replace(/\r\n|\r|\n/g, " ");
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  try {
    s = s.replace(/\p{Extended_Pictographic}/gu, "");
  } catch {
    /* 旧运行时无 Unicode 属性类则跳过 emoji 剔除 */
  }
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > maxChars) {
    s = s.slice(0, maxChars);
  }
  return s;
}

/**
 * 是否对 payload.text.text 使用 Base64（文档与错误码 10161 常见要求）
 */
function useBase64PayloadText(): boolean {
  return process.env.XFYUN_TTS_TEXT_BASE64 !== "false";
}

/**
 * 构建单次合成（status=2）请求体
 */
function buildOneShotFrame(
  appId: string,
  uid: string,
  stmid: string,
  scene: string,
  vcn: string,
  textUtf8: string
) {
  const textField = useBase64PayloadText()
    ? Buffer.from(textUtf8, "utf8").toString("base64")
    : textUtf8;

  return {
    header: {
      app_id: appId,
      uid,
      status: 2,
      stmid,
      scene,
    },
    parameter: {
      tts: {
        vcn,
        speed: 50,
        volume: 50,
        pitch: 50,
        tts: {
          encoding: "lame",
          sample_rate: 24000,
          channels: 1,
          bit_depth: 16,
          frame_size: 0,
        },
      },
    },
    payload: {
      text: {
        status: 2,
        seq: 0,
        text: textField,
      },
    },
  };
}

/**
 * 将平台错误码映射为 HTTP 状态与文案
 */
function mapXfyunCodeToError(code: number, message?: string): XfyunTtsError {
  const msg = message?.slice(0, 200) ?? "";

  if (code === 10313) {
    return new XfyunTtsError("讯飞 AppID 与 APIKey 不匹配", 401, "xfyun_auth", code);
  }
  if (code === 11200 || code === 11201) {
    return new XfyunTtsError(
      "讯飞服务未授权或额度不足，请检查控制台发音人与套餐",
      403,
      "xfyun_forbidden",
      code
    );
  }
  if (code === 10010) {
    return new XfyunTtsError("讯飞授权已满或不可用，请稍后再试", 429, "xfyun_quota", code);
  }

  return new XfyunTtsError(
    msg || `讯飞合成失败（${code}）`,
    code >= 10_000 && code < 20_000 ? 502 : 500,
    "xfyun_upstream",
    code
  );
}

export interface SynthesizeSuperTtsParams {
  text: string;
  vcn: string;
  appId: string;
  uid: string;
  stmid: string;
  scene: string;
  apiKey: string;
  apiSecret: string;
  wsUrl: string;
  timeoutMs: number;
}

/**
 * 调用讯飞超拟人 WebSocket，聚合 MP3（lame）二进制
 */
export async function synthesizeSuperTtsMp3(
  params: SynthesizeSuperTtsParams
): Promise<Buffer> {
  const safeText = sanitizeSuperTtsText(params.text);
  if (!safeText) {
    throw new XfyunTtsError("合成文本为空", 400, "empty_text");
  }

  const authUrl = assembleXfyunWsAuthUrl(params.wsUrl, params.apiKey, params.apiSecret);
  const frame = buildOneShotFrame(
    params.appId,
    params.uid,
    params.stmid,
    params.scene,
    params.vcn,
    safeText
  );

  // 某些 Node 版本下 `ws` + 可选原生加速包会出现 mask 兼容异常，禁用可稳定回退纯 JS 路径。
  process.env.WS_NO_BUFFER_UTIL = "1";
  process.env.WS_NO_UTF_8_VALIDATE = "1";
  const wsMod = await import("ws");
  const WebSocketCtor = wsMod.default as unknown as new (url: string) => WsLike;

  devLog("connect", {
    vcn: params.vcn,
    textLen: safeText.length,
    base64Text: useBase64PayloadText(),
  });

  return new Promise<Buffer>((resolve, reject) => {
    let settled = false;
    const chunks: Buffer[] = [];
    const ws = new WebSocketCtor(authUrl);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.close();
      devLog("timeout", { ms: params.timeoutMs });
      reject(
        new XfyunTtsError("讯飞合成超时，请稍后再试", 504, "timeout")
      );
    }, params.timeoutMs);

    const finalizeFromChunks = () => {
      clearTimeout(timer);
      const buf = Buffer.concat(chunks);
      if (buf.length === 0) {
        reject(new XfyunTtsError("未收到音频数据", 502, "empty_audio"));
      } else {
        devLog("done", { bytes: buf.length });
        resolve(buf);
      }
    };

    ws.on("open", () => {
      ws.send(JSON.stringify(frame));
    });

    ws.on("message", (data: unknown) => {
      const str =
        typeof data === "string"
          ? data
          : Buffer.isBuffer(data)
            ? data.toString("utf8")
            : String(data);
      let msg: XfyunWsMessage;
      try {
        msg = JSON.parse(str) as XfyunWsMessage;
      } catch {
        devLog("bad_json", { snippet: str.slice(0, 120) });
        return;
      }

      const code = msg.header?.code;
      if (code !== undefined && code !== 0) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ws.close();
        reject(mapXfyunCodeToError(code, msg.header?.message));
        return;
      }

      const b64 = msg.payload?.audio?.audio ?? msg.payload?.tts?.audio;
      if (b64) {
        try {
          chunks.push(Buffer.from(b64, "base64"));
        } catch {
          /* ignore chunk */
        }
      }

      const hStatus = msg.header?.status;
      const aStatus = msg.payload?.audio?.status ?? msg.payload?.tts?.status;
      if (hStatus === 2 || aStatus === 2) {
        if (settled) return;
        settled = true;
        ws.close();
        finalizeFromChunks();
      }
    });

    ws.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      devLog("ws_error", { message: err.message });
      reject(
        new XfyunTtsError("讯飞连接失败，请检查网络与 WSS 地址", 502, "ws_error")
      );
    });

    ws.on("close", () => {
      if (settled) return;
      settled = true;
      finalizeFromChunks();
    });
  });
}
