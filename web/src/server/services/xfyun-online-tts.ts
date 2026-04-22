import { CHARACTERS, type CharacterId } from "@vb/shared";
import { createHmac } from "crypto";

/**
 * 讯飞在线 TTS 业务错误，供路由层映射 HTTP 状态码。
 */
export class XfyunOnlineTtsError extends Error {
  /**
   * @param message 可面向前端展示的错误信息
   * @param statusCode 建议返回给前端的 HTTP 状态码
   * @param code 稳定错误码，便于检索日志
   * @param xfyunCode 讯飞侧返回码（若有）
   */
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly xfyunCode?: number
  ) {
    super(message);
    this.name = "XfyunOnlineTtsError";
  }
}

function devLog(tag: string, data: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;
  console.log(`[xfyun-online-tts] ${tag}`, JSON.stringify(data));
}

/**
 * 将文本压缩为 TTS 可接受的口语输入，避免超长和异常控制字符。
 */
function sanitizeText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

/**
 * 按文档规则拼装在线 TTS 鉴权 URL（HMAC-SHA256）。
 */
function buildAuthUrl(params: {
  hostUrl: string;
  apiKey: string;
  apiSecret: string;
}): string {
  const base = new URL(params.hostUrl);
  const host = base.host;
  const date = new Date().toUTCString();
  const requestLine = `GET ${base.pathname} HTTP/1.1`;
  const signatureOrigin = `host: ${host}\ndate: ${date}\n${requestLine}`;
  const signature = createHmac("sha256", params.apiSecret)
    .update(signatureOrigin)
    .digest("base64");
  const authorizationOrigin = `api_key="${params.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authorizationOrigin, "utf8").toString("base64");

  base.searchParams.set("authorization", authorization);
  base.searchParams.set("date", date);
  base.searchParams.set("host", host);
  return base.toString();
}

function resolveVoice(characterId: CharacterId): string {
  const envMap: Record<CharacterId, string | undefined> = {
    shenyu: process.env.XFYUN_ONLINE_TTS_VCN_SHENYU,
    lushiyan: process.env.XFYUN_ONLINE_TTS_VCN_LUSHIYAN,
    jiangyubai: process.env.XFYUN_ONLINE_TTS_VCN_JIANGYUBAI,
    huoyanchen: process.env.XFYUN_ONLINE_TTS_VCN_HUOYANCHEN,
  };
  return (
    envMap[characterId]?.trim() ||
    process.env.XFYUN_ONLINE_TTS_VCN_DEFAULT?.trim() ||
    CHARACTERS[characterId].xfyunOnlineTtsVcn
  );
}

/**
 * 调用讯飞在线 TTS WebSocket 接口并返回 MP3 Buffer。
 */
export async function synthesizeXfyunOnlineTtsMp3(params: {
  characterId: CharacterId;
  text: string;
}): Promise<Buffer> {
  process.env.WS_NO_BUFFER_UTIL = "1";
  process.env.WS_NO_UTF_8_VALIDATE = "1";
  const { default: WebSocket } = await import("ws");

  const appId = process.env.XFYUN_APP_ID?.trim();
  const apiKey = process.env.XFYUN_API_KEY?.trim();
  const apiSecret = process.env.XFYUN_API_SECRET?.trim();
  if (!appId || !apiKey || !apiSecret) {
    throw new XfyunOnlineTtsError("缺少 XFYUN_APP_ID / XFYUN_API_KEY / XFYUN_API_SECRET", 500, "config_missing");
  }

  const hostUrl = process.env.XFYUN_ONLINE_TTS_WSS_URL?.trim() || "wss://tts-api.xfyun.cn/v2/tts";
  const voice = resolveVoice(params.characterId);
  const text = sanitizeText(params.text);
  if (!text) {
    throw new XfyunOnlineTtsError("文本为空", 400, "empty_text");
  }

  const timeoutMs = Math.max(3000, Number(process.env.XFYUN_TTS_TIMEOUT_MS ?? 30_000) || 30_000);
  const tte = process.env.XFYUN_ONLINE_TTS_TTE?.trim() || "UTF8";
  const aue = process.env.XFYUN_ONLINE_TTS_AUE?.trim() || "lame";
  const auf = process.env.XFYUN_ONLINE_TTS_AUF?.trim() || "audio/L16;rate=16000";
  const authUrl = buildAuthUrl({ hostUrl, apiKey, apiSecret });

  devLog("request_start", { voice, tte, aue, auf, textLen: text.length, timeoutMs });

  return await new Promise<Buffer>((resolve, reject) => {
    let settled = false;
    const chunks: Buffer[] = [];

    const ws = new WebSocket(authUrl);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.close();
      reject(new XfyunOnlineTtsError("讯飞在线 TTS 超时", 504, "timeout"));
    }, timeoutMs);

    const finishWithError = (err: XfyunOnlineTtsError): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /** noop */
      }
      reject(err);
    };

    ws.on("open", () => {
      const payload: Record<string, unknown> = {
        common: { app_id: appId },
        business: {
          aue,
          auf,
          vcn: voice,
          tte,
          ...(aue === "lame" ? { sfl: 1 } : {}),
        },
        data: {
          status: 2,
          text: Buffer.from(text, "utf8").toString("base64"),
        },
      };
      ws.send(JSON.stringify(payload));
    });

    ws.on("message", (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        finishWithError(new XfyunOnlineTtsError("讯飞返回非 JSON 数据", 502, "bad_json"));
        return;
      }

      const code = Number(msg.code ?? 0);
      if (Number.isFinite(code) && code !== 0) {
        const message = String(msg.message ?? "讯飞在线 TTS 失败");
        const status = code === 11200 ? 403 : code === 10163 ? 429 : 502;
        finishWithError(new XfyunOnlineTtsError(message, status, "xfyun_upstream", code));
        return;
      }

      const data = (msg.data ?? {}) as Record<string, unknown>;
      const audio = String(data.audio ?? "");
      if (audio) chunks.push(Buffer.from(audio, "base64"));

      const status = Number(data.status ?? 0);
      if (status === 2) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ws.close();
        const buf = Buffer.concat(chunks);
        if (buf.length === 0) {
          reject(new XfyunOnlineTtsError("讯飞在线 TTS 返回空音频", 502, "empty_audio"));
          return;
        }
        devLog("success", { bytes: buf.length });
        resolve(buf);
      }
    });

    ws.on("error", (e) => {
      const message = e instanceof Error ? e.message : "WebSocket 连接失败";
      finishWithError(new XfyunOnlineTtsError(message, 502, "ws_error"));
    });

    ws.on("unexpected-response", (_req, res) => {
      const status = res.statusCode ?? 0;
      const chunks: Buffer[] = [];
      res.on("data", (c) => {
        chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c)));
      });
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8").slice(0, 500);
        devLog("unexpected_response", { status, body });
        const msg = body || `讯飞握手失败（HTTP ${status}）`;
        finishWithError(
          new XfyunOnlineTtsError(
            msg,
            status >= 400 ? status : 502,
            "ws_handshake_failed"
          )
        );
      });
    });

    ws.on("close", (code, reasonBuf) => {
      if (!settled) {
        const reason = reasonBuf?.toString("utf8") || "";
        devLog("ws_closed", { code, reason });
        finishWithError(
          new XfyunOnlineTtsError(
            reason
              ? `讯飞在线 TTS 提前断开（code=${code}, reason=${reason}）`
              : `讯飞在线 TTS 提前断开（code=${code}）`,
            502,
            "ws_closed"
          )
        );
      }
    });
  });
}
