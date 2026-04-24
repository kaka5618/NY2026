import { NextResponse } from "next/server";
import { CHARACTERS, type CharacterId } from "@vb/shared";
import { getOptionalSessionUserId } from "@/server/auth/session-user";
import {
  ArkImageError,
  generateArkImage,
  type ArkImageGenerationInput,
} from "@/server/services/ark-image";
import { persistGeneratedImage } from "@/server/services/media-storage";

export const runtime = "nodejs";

/**
 * 图片生成路由请求体
 */
interface GenerateImageBody extends Partial<ArkImageGenerationInput> {
  prompt?: string;
  /** 用于 R2 对象键分层与归档 */
  characterId?: CharacterId;
  /** 与聊天 image_ref 对齐，便于排查 */
  imageRef?: string;
}

/**
 * 判断是否显式关闭方舟文生图能力
 */
function shouldUseArkImage(): boolean {
  return process.env.USE_ARK_IMAGE !== "false";
}

/**
 * 判断方舟文生图必要配置是否齐全
 */
function hasArkImageConfig(): boolean {
  return Boolean(process.env.ARK_API_KEY?.trim());
}

/**
 * POST /api/image/generate
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateImageBody;
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt 不能为空" }, { status: 400 });
    }

    if (!shouldUseArkImage()) {
      return NextResponse.json(
        { error: "图片生成能力已关闭（USE_ARK_IMAGE=false）" },
        { status: 503 }
      );
    }

    if (!hasArkImageConfig()) {
      return NextResponse.json(
        { error: "缺少 ARK_API_KEY 配置" },
        { status: 500 }
      );
    }

    let result = await generateArkImage({
      model: body.model,
      prompt,
      sequential_image_generation: body.sequential_image_generation,
      response_format: body.response_format,
      size: body.size,
      stream: body.stream,
      watermark: body.watermark,
    });

    const arkUrl = result.data?.[0]?.url;
    const cid = body.characterId;
    if (arkUrl && cid && CHARACTERS[cid]) {
      const sessionUserId = await getOptionalSessionUserId();
      try {
        const persisted = await persistGeneratedImage({
          characterId: cid,
          imageRef: String(body.imageRef ?? "generated"),
          sourceUrl: arkUrl,
          prompt,
          userId: sessionUserId ?? undefined,
        });
        if (persisted?.url && result.data?.[0]) {
          result = {
            ...result,
            data: [{ ...result.data[0], url: persisted.url }],
          };
        }
      } catch (persistErr) {
        if (process.env.NODE_ENV === "development") {
          console.error("[image-generate-route] r2_persist_failed", persistErr);
        }
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ArkImageError) {
      if (process.env.NODE_ENV === "development") {
        console.error("[image-generate-route] ArkImageError", e.code, e.message);
      }
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : "图片生成失败";
    console.error("[image-generate-route]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
