import { NextResponse } from "next/server";
import { CHARACTERS, type CharacterId } from "@vb/shared";
import {
  synthesizeXfyunOnlineTtsMp3,
  XfyunOnlineTtsError,
} from "@/server/services/xfyun-online-tts";

export const runtime = "nodejs";

interface TtsBody {
  characterId: CharacterId;
  text: string;
}

/**
 * 判断是否显式关闭讯飞在线 TTS。
 */
function shouldUseXfyunTts(): boolean {
  return process.env.USE_XFYUN_TTS !== "false";
}

/**
 * 检查讯飞在线 TTS 必要配置是否齐全。
 */
function hasXfyunCredentials(): boolean {
  return Boolean(
    process.env.XFYUN_APP_ID?.trim() &&
      process.env.XFYUN_API_KEY?.trim() &&
      process.env.XFYUN_API_SECRET?.trim()
  );
}

/**
 * POST /api/tts，基于讯飞在线 TTS 合成并返回 MP3。
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

    if (!shouldUseXfyunTts()) {
      return NextResponse.json({ error: "语音能力已关闭（USE_XFYUN_TTS=false）" }, { status: 503 });
    }
    if (!hasXfyunCredentials()) {
      return NextResponse.json(
        { error: "缺少 XFYUN_APP_ID / XFYUN_API_KEY / XFYUN_API_SECRET 配置" },
        { status: 500 }
      );
    }

    const mp3 = await synthesizeXfyunOnlineTtsMp3({
      characterId,
      text: t,
    });
    return new NextResponse(new Uint8Array(mp3), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "X-TTS-Mode": "xfyun-online",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof XfyunOnlineTtsError) {
      if (process.env.NODE_ENV === "development") {
        console.error("[tts-route] XfyunOnlineTtsError", e.code, e.xfyunCode, e.message);
      }
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : "TTS 失败";
    console.error("[tts-route]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
