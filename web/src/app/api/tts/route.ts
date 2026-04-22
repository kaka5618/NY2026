import { NextResponse } from "next/server";
import { CHARACTERS, type CharacterId } from "@vb/shared";
import { buildSilentWavPcm } from "@/lib/silent-wav";
import {
  synthesizeSuperTtsMp3,
  XfyunTtsError,
} from "@/server/services/xfyun-super-tts";
import {
  DoubaoTtsError,
  synthesizeDoubaoOpenSpeechMp3,
  synthesizeDoubaoTtsMp3,
} from "@/server/services/doubao-tts";

export const runtime = "nodejs";

interface TtsBody {
  characterId: CharacterId;
  text: string;
}

type DoubaoTtsProvider = "openspeech" | "ark" | "auto";

/**
 * 未配置讯飞或显式关闭时走静音占位
 */
function shouldUseXfyunTts(): boolean {
  return process.env.USE_XFYUN_TTS !== "false";
}

function hasXfyunCredentials(): boolean {
  return Boolean(
    process.env.XFYUN_APP_ID?.trim() &&
      process.env.XFYUN_API_KEY?.trim() &&
      process.env.XFYUN_API_SECRET?.trim() &&
      process.env.XFYUN_SUPER_TTS_WSS_URL?.trim()
  );
}

function shouldUseDoubaoTts(): boolean {
  return process.env.USE_DOUBAO_TTS !== "false";
}

function hasDoubaoCredentials(): boolean {
  return Boolean(process.env.ARK_API_KEY?.trim());
}

function hasDoubaoOpenSpeechCredentials(): boolean {
  return Boolean(
    process.env.DOUBAO_SPEECH_APPID?.trim() &&
      (process.env.DOUBAO_SPEECH_ACCESS_TOKEN?.trim() ||
        process.env.DOUBAO_SPEECH_SECRET_KEY?.trim()) &&
      process.env.DOUBAO_SPEECH_CLUSTER?.trim()
  );
}

/**
 * 解析豆包 TTS 通道选择：
 * - openspeech: 仅走豆包语音 HTTP v1
 * - ark: 仅走方舟 audio/speech
 * - auto: openspeech 不可用时回退 ark
 */
function resolveDoubaoTtsProvider(): DoubaoTtsProvider {
  const raw = process.env.DOUBAO_TTS_PROVIDER?.trim().toLowerCase();
  if (raw === "openspeech" || raw === "ark" || raw === "auto") return raw;
  return "openspeech";
}

/**
 * POST /api/tts — 按通道配置合成语音；未命中时回退讯飞/静音占位
 */
export async function POST(req: Request) {
  try {
    const { characterId, text } = (await req.json()) as TtsBody;
    if (!characterId || !CHARACTERS[characterId]) {
      return NextResponse.json({ error: "无效角色" }, { status: 400 });
    }
    const t = String(text ?? "").trim();
    if (!t) {
      return NextResponse.json({ error: "文本为空" }, { status: 400 });
    }

    if (shouldUseDoubaoTts()) {
      const provider = resolveDoubaoTtsProvider();
      if (provider === "openspeech") {
        if (!hasDoubaoOpenSpeechCredentials()) {
          throw new DoubaoTtsError(
            "DOUBAO_TTS_PROVIDER=openspeech 时需配置 DOUBAO_SPEECH_APPID / DOUBAO_SPEECH_CLUSTER / (DOUBAO_SPEECH_ACCESS_TOKEN 或 DOUBAO_SPEECH_SECRET_KEY)",
            500,
            "config_missing"
          );
        }
        const mp3 = await synthesizeDoubaoOpenSpeechMp3({
          characterId,
          text: t,
        });
        return new NextResponse(new Uint8Array(mp3), {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "X-TTS-Mode": "doubao-openspeech-v1",
            "Cache-Control": "no-store",
          },
        });
      }

      if (provider === "ark") {
        if (!hasDoubaoCredentials()) {
          throw new DoubaoTtsError(
            "DOUBAO_TTS_PROVIDER=ark 时需配置 ARK_API_KEY",
            500,
            "config_missing"
          );
        }
        const mp3 = await synthesizeDoubaoTtsMp3({
          characterId,
          text: t,
        });
        return new NextResponse(new Uint8Array(mp3), {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "X-TTS-Mode": "doubao-ark",
            "Cache-Control": "no-store",
          },
        });
      }

      if (hasDoubaoOpenSpeechCredentials()) {
        const mp3 = await synthesizeDoubaoOpenSpeechMp3({
          characterId,
          text: t,
        });
        return new NextResponse(new Uint8Array(mp3), {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "X-TTS-Mode": "doubao-openspeech-v1",
            "Cache-Control": "no-store",
          },
        });
      }
      if (hasDoubaoCredentials()) {
        const mp3 = await synthesizeDoubaoTtsMp3({
          characterId,
          text: t,
        });
        return new NextResponse(new Uint8Array(mp3), {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "X-TTS-Mode": "doubao-ark",
            "Cache-Control": "no-store",
          },
        });
      }
    }

    if (shouldUseXfyunTts() && hasXfyunCredentials()) {
      const char = CHARACTERS[characterId];
      const timeoutMs = Math.max(
        3000,
        Number(process.env.XFYUN_TTS_TIMEOUT_MS ?? 30_000) || 30_000
      );

      const mp3 = await synthesizeSuperTtsMp3({
        text: t,
        vcn: char.xfyunSuperTtsVcn,
        appId: process.env.XFYUN_APP_ID!.trim(),
        uid: process.env.XFYUN_UID?.trim() || `vb_${characterId}`,
        stmid: process.env.XFYUN_STMID?.trim() || "0",
        scene: process.env.XFYUN_SCENE?.trim() || "sos_app",
        apiKey: process.env.XFYUN_API_KEY!.trim(),
        apiSecret: process.env.XFYUN_API_SECRET!.trim(),
        wsUrl: process.env.XFYUN_SUPER_TTS_WSS_URL!.trim(),
        timeoutMs,
      });

      return new NextResponse(new Uint8Array(mp3), {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "X-TTS-Mode": "xfyun-super",
          "Cache-Control": "no-store",
        },
      });
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[tts-route] placeholder_wav", {
        reason: "missing TTS provider config",
      });
    }
    const body = buildSilentWavPcm(0.45, 16000);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "X-TTS-Mode": "placeholder",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof DoubaoTtsError) {
      if (process.env.NODE_ENV === "development") {
        console.error("[tts-route] DoubaoTtsError", e.code, e.message);
      }
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    if (e instanceof XfyunTtsError) {
      if (process.env.NODE_ENV === "development") {
        console.error("[tts-route] XfyunTtsError", e.code, e.xfyunCode, e.message);
      }
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : "TTS 失败";
    console.error("[tts-route]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
