import type { ReplyType } from "@vb/shared";

/**
 * 单条聊天消息（IndexedDB / 服务端 `chat_messages.extra_json` 对齐）
 */
export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  createdAt: number;
  content: string;
  reply_type?: ReplyType;
  voice_text?: string;
  image_ref?: string;
  image_url?: string;
  safety_note?: string;
  /** 语音文件公开 URL（如 R2），有时效或长期取决于存储配置 */
  voice_url?: string;
}
