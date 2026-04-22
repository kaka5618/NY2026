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

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `请求失败 ${res.status}`);
  }
  return (await res.json()) as ChatApiReply;
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
