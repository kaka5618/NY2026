import type { CharacterId, SessionModalityStats } from "@vb/shared";
import type { StoredChatMessage } from "./db";

export interface ChatApiReply {
  reply: {
    reply_type: string;
    content: string;
    voice_text?: string;
    image_ref?: string;
    safety_note?: string;
    resolved_image_url?: string;
    image_generation_prompt?: string;
  };
  characterId: CharacterId;
}

/**
 * 请求助手结构化回复
 */
export async function postChat(params: {
  characterId: CharacterId;
  messages: StoredChatMessage[];
  userMessage: string;
  stats: SessionModalityStats;
}): Promise<ChatApiReply> {
  const payload = {
    characterId: params.characterId,
    userMessage: params.userMessage,
    stats: params.stats,
    messages: params.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };

  const timeoutMs = 45_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `请求失败 ${res.status}`);
    }
    return (await res.json()) as ChatApiReply;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("请求超时，请重试");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 请求服务端合成语音并返回音频 Blob。
 */
export async function postTts(characterId: CharacterId, text: string): Promise<Blob> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterId, text }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `TTS 失败 ${res.status}`);
  }
  return res.blob();
}

export interface CharacterPublic {
  id: CharacterId;
  name: string;
  age: number;
  role: string;
  personalityTag: string;
  quote: string;
  avatarUrl: string;
  accentFrom: string;
  accentTo: string;
  xfyunOnlineTtsVcn: string;
}

/**
 * 拉取角色卡片列表
 */
export async function fetchCharacters(): Promise<CharacterPublic[]> {
  const res = await fetch("/api/characters");
  if (!res.ok) throw new Error("无法加载角色列表");
  const data = (await res.json()) as { characters: CharacterPublic[] };
  return data.characters;
}

export interface ImageGenerationRequest {
  model?: string;
  prompt: string;
  sequential_image_generation?: "disabled" | "enabled";
  response_format?: "url" | "b64_json";
  size?: string;
  stream?: boolean;
  watermark?: boolean;
}

export interface ImageGenerationResponse {
  model?: string;
  created?: number;
  data?: Array<{
    url?: string;
    b64_json?: string;
    size?: string;
  }>;
  usage?: {
    generated_images?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * 请求服务端生成图片（服务端代理方舟，避免前端暴露密钥）
 */
export async function postGenerateImage(
  params: ImageGenerationRequest
): Promise<ImageGenerationResponse> {
  const res = await fetch("/api/image/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `图片生成失败 ${res.status}`);
  }
  return (await res.json()) as ImageGenerationResponse;
}
