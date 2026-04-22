import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ReplyType } from "@vb/shared";

/**
 * 持久化单条聊天消息
 */
export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  createdAt: number;
  content: string;
  reply_type?: ReplyType;
  image_ref?: string;
  image_url?: string;
  safety_note?: string;
}

interface VBSchema extends DBSchema {
  sessions: {
    key: string;
    value: {
      characterId: string;
      updatedAt: number;
      messages: StoredChatMessage[];
    };
  };
}

const DB_NAME = "vb-companion-v1";
const STORE = "sessions";

let dbPromise: Promise<IDBPDatabase<VBSchema>> | null = null;

/**
 * 打开 IndexedDB 单例
 */
function getDb(): Promise<IDBPDatabase<VBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<VBSchema>(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: "characterId" });
      },
    });
  }
  return dbPromise;
}

/**
 * 读取某角色的会话记录
 */
export async function loadSession(characterId: string): Promise<StoredChatMessage[]> {
  const db = await getDb();
  const row = await db.get(STORE, characterId);
  return row?.messages ?? [];
}

/**
 * 覆盖保存某角色的完整消息列表
 */
export async function saveSession(
  characterId: string,
  messages: StoredChatMessage[]
): Promise<void> {
  const db = await getDb();
  await db.put(STORE, {
    characterId,
    updatedAt: Date.now(),
    messages,
  });
}
