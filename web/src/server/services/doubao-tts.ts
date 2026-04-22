import { CHARACTERS, type CharacterId } from "@vb/shared";
import { randomUUID } from "crypto";

interface DoubaoTokenCache {
  token: string;
  expireAtMs: number;
}

let tokenCache: DoubaoTokenCache | null = null;

/**
 * 豆包/方舟 TTS 业务错误（映射为 HTTP 状态）
 */
export class DoubaoTtsError extends Error {
  /**
   * @param message - 可对用户展示的简短说明
   * @param statusCode - 建议返回前端的 HTTP 状态
   * @param code - 稳定错误码，便于日志检索
   */
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string
  ) {
    super(message);
    this.name = "DoubaoTtsError";
  }
}

function devLog(tag: string, data: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;
  console.log(`[doubao-tts] ${tag}`, JSON.stringify(data));
}

function resolveTtsBaseUrl(): string {
  const raw = process.env.ARK_BASE_URL?.trim() || "https://ark.cn-beijing.volces.com/api/v3";
  return raw.replace(/\/$/, "");
}

function resolveVoice(characterId: CharacterId): string {
  const envMap: Record<CharacterId, string | undefined> = {
    shenyu: process.env.DOUBAO_TTS_VOICE_SHENYU,
    lushiyan: process.env.DOUBAO_TTS_VOICE_LUSHIYAN,
    jiangyubai: process.env.DOUBAO_TTS_VOICE_JIANGYUBAI,
    huoyanchen: process.env.DOUBAO_TTS_VOICE_HUOYANCHEN,
  };
  return (
    envMap[characterId]?.trim() ||
    process.env.DOUBAO_TTS_VOICE_DEFAULT?.trim() ||
    CHARACTERS[characterId].ttsVoice
  );
}

/**
 * 调用方舟 OpenAI 兼容语音接口：
 * POST {ARK_BASE_URL}/audio/speech
 */
export async function synthesizeDoubaoTtsMp3(params: {
  characterId: CharacterId;
  text: string;
}): Promise<Buffer> {
  const apiKey = process.env.ARK_API_KEY?.trim();
  if (!apiKey) {
    throw new DoubaoTtsError("缺少 ARK_API_KEY", 500, "config_missing");
  }

  const model = process.env.DOUBAO_TTS_MODEL?.trim() || "doubao-voice-mini";
  const voice = resolveVoice(params.characterId);
  const timeoutMs = Math.max(
    3000,
    Number(process.env.DOUBAO_TTS_TIMEOUT_MS ?? 30_000) || 30_000
  );
  const baseUrl = resolveTtsBaseUrl();
  const url = `${baseUrl}/audio/speech`;
  const input = params.text.trim().slice(0, 1200);
  if (!input) {
    throw new DoubaoTtsError("文本为空", 400, "empty_text");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  devLog("request_start", {
    model,
    voice,
    inputLen: input.length,
    timeoutMs,
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        voice,
        input,
        response_format: "mp3",
      }),
      signal: controller.signal,
    });

    const elapsedMs = Date.now() - started;
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      devLog("http_error", {
        status: res.status,
        elapsedMs,
        bodySnippet: raw.slice(0, 300),
      });
      if (res.status === 401) {
        throw new DoubaoTtsError("方舟 TTS 鉴权失败（ARK_API_KEY 无效）", 401, "auth_failed");
      }
      if (res.status === 429) {
        throw new DoubaoTtsError("方舟 TTS 触发限流，请稍后重试", 429, "rate_limited");
      }
      throw new DoubaoTtsError(
        `方舟 TTS 请求失败（${res.status}）`,
        res.status >= 500 ? 502 : 400,
        "upstream_error"
      );
    }

    if (contentType.includes("application/json")) {
      const raw = await res.text().catch(() => "");
      devLog("unexpected_json", { elapsedMs, bodySnippet: raw.slice(0, 300) });
      throw new DoubaoTtsError("方舟 TTS 返回了 JSON 而非音频，请检查模型/音色配置", 502, "unexpected_json");
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) {
      throw new DoubaoTtsError("方舟 TTS 返回空音频", 502, "empty_audio");
    }

    devLog("success", { elapsedMs, bytes: buf.length, contentType });
    return buf;
  } catch (e) {
    if (e instanceof DoubaoTtsError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new DoubaoTtsError("方舟 TTS 请求超时，请稍后再试", 504, "timeout");
    }
    throw new DoubaoTtsError(
      e instanceof Error ? e.message : "方舟 TTS 异常",
      500,
      "internal"
    );
  } finally {
    clearTimeout(timer);
  }
}

function hasOpenSpeechCredentials(): boolean {
  return Boolean(
    process.env.DOUBAO_SPEECH_APPID?.trim() &&
      (process.env.DOUBAO_SPEECH_ACCESS_TOKEN?.trim() ||
        process.env.DOUBAO_SPEECH_SECRET_KEY?.trim()) &&
      process.env.DOUBAO_SPEECH_CLUSTER?.trim()
  );
}

/**
 * 用 APPID + Secret Key 获取临时 access_token（若已直接配置 ACCESS_TOKEN 则优先使用）
 *
 * @see https://www.volcengine.com/docs/6561/79820
 */
async function resolveOpenSpeechAccessToken(): Promise<string> {
  const direct = process.env.DOUBAO_SPEECH_ACCESS_TOKEN?.trim();
  if (direct) return direct;

  const appid = process.env.DOUBAO_SPEECH_APPID?.trim();
  const secretKey = process.env.DOUBAO_SPEECH_SECRET_KEY?.trim();
  if (!appid || !secretKey) {
    throw new DoubaoTtsError(
      "缺少 DOUBAO_SPEECH_ACCESS_TOKEN，且未提供 DOUBAO_SPEECH_SECRET_KEY",
      500,
      "config_missing"
    );
  }

  if (tokenCache && Date.now() < tokenCache.expireAtMs - 60_000) {
    return tokenCache.token;
  }

  const tokenUrl =
    process.env.DOUBAO_SPEECH_TOKEN_URL?.trim() ||
    "https://open.volcengineapi.com/oauth/token";
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: appid,
    client_secret: secretKey,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const raw = await res.text();
  if (!res.ok) {
    devLog("token_http_error", { status: res.status, bodySnippet: raw.slice(0, 300) });
    throw new DoubaoTtsError(`获取豆包 access_token 失败（${res.status}）`, 502, "token_http_error");
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new DoubaoTtsError("token 响应不是 JSON", 502, "token_bad_json");
  }

  const token =
    String(json.access_token ?? json.AccessToken ?? json.token ?? "").trim();
  if (!token) {
    devLog("token_missing_field", { bodySnippet: raw.slice(0, 300) });
    throw new DoubaoTtsError("token 响应缺少 access_token 字段", 502, "token_missing");
  }

  const expiresInSec = Number(json.expires_in ?? 3600) || 3600;
  tokenCache = {
    token,
    expireAtMs: Date.now() + expiresInSec * 1000,
  };
  devLog("token_refreshed", { expiresInSec });
  return token;
}

/**
 * 调用豆包语音 HTTP v1（openspeech）一次性合成接口：
 * POST https://openspeech.bytedance.com/api/v1/tts
 */
export async function synthesizeDoubaoOpenSpeechMp3(params: {
  characterId: CharacterId;
  text: string;
}): Promise<Buffer> {
  if (!hasOpenSpeechCredentials()) {
    throw new DoubaoTtsError(
      "缺少 DOUBAO_SPEECH_APPID / (ACCESS_TOKEN 或 SECRET_KEY) / CLUSTER",
      500,
      "config_missing"
    );
  }

  const appid = process.env.DOUBAO_SPEECH_APPID!.trim();
  const accessToken = await resolveOpenSpeechAccessToken();
  const cluster = process.env.DOUBAO_SPEECH_CLUSTER!.trim();
  const voiceType =
    process.env.DOUBAO_SPEECH_VOICE_TYPE_DEFAULT?.trim() || "BV001_streaming";
  const encoding = process.env.DOUBAO_SPEECH_ENCODING?.trim() || "mp3";
  const timeoutMs = Math.max(
    3000,
    Number(process.env.DOUBAO_SPEECH_TIMEOUT_MS ?? 30_000) || 30_000
  );
  const text = params.text.trim().slice(0, 1200);
  if (!text) {
    throw new DoubaoTtsError("文本为空", 400, "empty_text");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  devLog("openspeech_request_start", {
    cluster,
    voiceType,
    encoding,
    textLen: text.length,
  });

  try {
    const res = await fetch("https://openspeech.bytedance.com/api/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer;${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app: {
          appid,
          token: accessToken,
          cluster,
        },
        user: {
          uid: process.env.DOUBAO_SPEECH_UID?.trim() || `vb_${params.characterId}`,
        },
        audio: {
          voice_type: voiceType,
          encoding,
          speed_ratio: 1.0,
          volume_ratio: 1.0,
          pitch_ratio: 1.0,
        },
        request: {
          reqid: randomUUID(),
          text,
          text_type: "plain",
          operation: "query",
          with_frontend: 1,
          frontend_type: "unitTson",
        },
      }),
      signal: controller.signal,
    });

    const elapsedMs = Date.now() - started;
    const raw = await res.text();
    if (!res.ok) {
      devLog("openspeech_http_error", {
        status: res.status,
        elapsedMs,
        bodySnippet: raw.slice(0, 300),
      });
      if (res.status === 401) {
        throw new DoubaoTtsError("豆包语音鉴权失败（token 无效）", 401, "auth_failed");
      }
      if (res.status === 429) {
        throw new DoubaoTtsError("豆包语音触发限流，请稍后重试", 429, "rate_limited");
      }
      throw new DoubaoTtsError(`豆包语音请求失败（${res.status}）`, 502, "upstream_error");
    }

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new DoubaoTtsError("豆包语音返回格式异常（非 JSON）", 502, "bad_json");
    }

    const code = Number(json.code ?? -1);
    if (!Number.isFinite(code) || code !== 3000) {
      const message = String(json.message ?? "豆包语音返回失败");
      throw new DoubaoTtsError(message, 502, "tts_failed");
    }

    const b64 = String(json.data ?? "");
    if (!b64) {
      throw new DoubaoTtsError("豆包语音返回空音频", 502, "empty_audio");
    }
    const buf = Buffer.from(b64, "base64");
    if (buf.length === 0) {
      throw new DoubaoTtsError("豆包语音音频解码失败", 502, "decode_failed");
    }

    devLog("openspeech_success", { elapsedMs, bytes: buf.length });
    return buf;
  } catch (e) {
    if (e instanceof DoubaoTtsError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new DoubaoTtsError("豆包语音请求超时，请稍后再试", 504, "timeout");
    }
    throw new DoubaoTtsError(
      e instanceof Error ? e.message : "豆包语音异常",
      500,
      "internal"
    );
  } finally {
    clearTimeout(timer);
  }
}
