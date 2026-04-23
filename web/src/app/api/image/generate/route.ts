import { NextResponse } from "next/server";
import {
  ArkImageError,
  generateArkImage,
  type ArkImageGenerationInput,
} from "@/server/services/ark-image";

export const runtime = "nodejs";

/**
 * 图片生成路由请求体
 */
interface GenerateImageBody extends Partial<ArkImageGenerationInput> {
  prompt?: string;
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

    const result = await generateArkImage({
      model: body.model,
      prompt,
      sequential_image_generation: body.sequential_image_generation,
      response_format: body.response_format,
      size: body.size,
      stream: body.stream,
      watermark: body.watermark,
    });

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
