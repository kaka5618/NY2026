import { NextResponse } from "next/server";
import {
  CHARACTERS,
  type CharacterId,
  type SessionModalityStats,
} from "@vb/shared";
import { ArkChatError, completeCharacterChat } from "@/server/services/ark-chat";
import { buildCharacterImagePrompt } from "@/server/services/image-prompt";
import { buildPlaceholderReply } from "@/server/services/placeholder-reply";

interface ChatBody {
  characterId: CharacterId;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  userMessage: string;
  stats?: SessionModalityStats;
}

/**
 * USE_ARK_CHAT !== "false" 且配置了 ARK_API_KEY 时走方舟；否则占位逻辑（便于回滚与本地无 Key 开发）
 */
function shouldUseArk(): boolean {
  return process.env.USE_ARK_CHAT !== "false";
}

function hasArkApiKey(): boolean {
  return Boolean(process.env.ARK_API_KEY?.trim());
}

/**
 * 图片类型判断：仅 image / text+image 触发生图
 */
function hasImageReply(replyType: string | undefined): boolean {
  const rt = replyType ?? "text";
  return rt === "image" || rt === "text+image";
}

/**
 * 判断是否显式关闭方舟生图能力
 */
function shouldUseArkImage(): boolean {
  return process.env.USE_ARK_IMAGE !== "false";
}

/**
 * POST /api/chat — 方舟 Chat Completions + 结构化回复管线；可经 USE_ARK_CHAT=false 回退占位
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatBody;
    const characterId = body.characterId;
    if (!characterId || !CHARACTERS[characterId]) {
      return NextResponse.json({ error: "无效角色" }, { status: 400 });
    }
    const userMessage = String(body.userMessage ?? "").trim();
    if (!userMessage) {
      return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
    }

    const history = (body.messages ?? [])
      .filter(
        (m): m is { role: "user" | "assistant"; content: string } =>
          m.role === "user" || m.role === "assistant"
      )
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    if (!shouldUseArk() || !hasArkApiKey()) {
      if (process.env.NODE_ENV === "development") {
        console.log("[chat-route] placeholder", {
          reason: !shouldUseArk() ? "USE_ARK_CHAT=false" : "ARK_API_KEY missing",
          characterId,
        });
      }
      const { reply, model } = buildPlaceholderReply(characterId, userMessage);
      return NextResponse.json({ reply, characterId, model });
    }

    const result = await completeCharacterChat({
      characterId,
      history,
      userMessage,
      stats: body.stats,
    });

    let reply = result.reply;
    let imageGenerationPrompt: string | undefined;
    if (
      shouldUseArkImage() &&
      hasArkApiKey() &&
      hasImageReply(reply.reply_type) &&
      reply.image_ref
    ) {
      imageGenerationPrompt = buildCharacterImagePrompt({
        characterId,
        imageRef: reply.image_ref,
        userMessage,
        assistantContent: reply.content,
      });
    }

    return NextResponse.json({
      reply: {
        ...reply,
        image_generation_prompt: imageGenerationPrompt,
      },
      characterId,
      model: result.model,
      usage: result.usage,
    });
  } catch (e) {
    if (e instanceof ArkChatError) {
      if (process.env.NODE_ENV === "development") {
        console.error("[chat-route] ArkChatError", e.code, e.message);
      }
      return NextResponse.json({ error: e.message }, { status: e.statusCode });
    }
    const msg = e instanceof Error ? e.message : "服务器错误";
    console.error("[chat-route]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
