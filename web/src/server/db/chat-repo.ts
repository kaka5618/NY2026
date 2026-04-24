import { CHARACTERS, type CharacterId, type ReplyType } from "@vb/shared";
import { randomUUID } from "node:crypto";
import type { StoredChatMessage } from "@/types/stored-chat";
import { getPgPool } from "@/server/db/pg-pool";

const MAX_SYNC_MESSAGES = 500;

interface ExtraJson {
  clientId: string;
  voice_text?: string;
  image_ref?: string;
  image_url?: string;
  safety_note?: string;
  voice_url?: string;
}

/**
 * 校验角色 id 是否合法。
 */
export function isValidCharacterId(id: string): id is CharacterId {
  return typeof id === "string" && id in CHARACTERS;
}

/**
 * 解析 `characters` 表主键。
 */
export async function getCharacterNumericId(code: CharacterId): Promise<number | null> {
  const pool = getPgPool();
  const res = await pool.query<{ id: number }>(
    `SELECT id FROM characters WHERE code = $1 AND is_active = true LIMIT 1`,
    [code]
  );
  const n = res.rows[0]?.id;
  return typeof n === "number" ? n : null;
}

/**
 * 获取或创建「用户 × 角色」会话行，返回会话 id（字符串避免 bigint 精度问题）。
 */
export async function getOrCreateChatSession(userIdStr: string, characterId: CharacterId): Promise<string> {
  const charNumId = await getCharacterNumericId(characterId);
  if (charNumId == null) {
    throw new Error("invalid_character");
  }
  const pool = getPgPool();
  const res = await pool.query<{ id: string | number }>(
    `INSERT INTO chat_sessions (user_id, character_id, last_message_at)
     VALUES ($1::bigint, $2, now())
     ON CONFLICT (user_id, character_id) DO UPDATE SET
       updated_at = now(),
       last_message_at = now()
     RETURNING id`,
    [userIdStr, charNumId]
  );
  const id = res.rows[0]?.id;
  if (id == null) throw new Error("session_create_failed");
  return String(id);
}

/**
 * 用全量消息列表覆盖会话内消息（与客户端 IndexedDB 对齐）。
 */
export async function replaceSessionMessages(sessionIdStr: string, messages: StoredChatMessage[]): Promise<void> {
  if (messages.length > MAX_SYNC_MESSAGES) {
    throw new Error(`messages_limit_${MAX_SYNC_MESSAGES}`);
  }
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM chat_messages WHERE session_id = $1::bigint`, [sessionIdStr]);
    for (const m of messages) {
      if (m.role !== "user" && m.role !== "assistant") continue;
      const extra: ExtraJson = {
        clientId: m.id,
        voice_text: m.voice_text,
        image_ref: m.image_ref,
        image_url: m.image_url,
        safety_note: m.safety_note,
        voice_url: m.voice_url,
      };
      await client.query(
        `INSERT INTO chat_messages (session_id, role, content, reply_type, extra_json, created_at)
         VALUES ($1::bigint, $2, $3, $4, $5::jsonb, to_timestamp($6 / 1000.0))`,
        [
          sessionIdStr,
          m.role,
          m.content,
          m.reply_type ?? null,
          JSON.stringify(extra),
          m.createdAt,
        ]
      );
    }
    await client.query(
      `UPDATE chat_sessions SET last_message_at = now(), updated_at = now() WHERE id = $1::bigint`,
      [sessionIdStr]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * 列出某用户与某角色的全部聊天消息（按时间升序）。
 */
export async function listSessionMessages(
  userIdStr: string,
  characterId: CharacterId
): Promise<StoredChatMessage[]> {
  const charNumId = await getCharacterNumericId(characterId);
  if (charNumId == null) return [];
  const pool = getPgPool();
  const res = await pool.query<{
    role: string;
    content: string;
    reply_type: string | null;
    extra_json: ExtraJson | null;
    created_at: Date;
  }>(
    `SELECT m.role, m.content, m.reply_type, m.extra_json, m.created_at
     FROM chat_messages m
     INNER JOIN chat_sessions s ON s.id = m.session_id
     WHERE s.user_id = $1::bigint AND s.character_id = $2
     ORDER BY m.created_at ASC`,
    [userIdStr, charNumId]
  );
  return res.rows.map((r) => {
    const ex = r.extra_json ?? ({} as ExtraJson);
    const createdAt =
      r.created_at instanceof Date ? r.created_at.getTime() : new Date(r.created_at as unknown as string).getTime();
    const rt = (r.reply_type as ReplyType | null) ?? undefined;
    return {
      id: typeof ex.clientId === "string" && ex.clientId ? ex.clientId : randomUUID(),
      role: r.role as "user" | "assistant",
      createdAt,
      content: r.content,
      reply_type: rt,
      voice_text: ex.voice_text,
      image_ref: ex.image_ref,
      image_url: ex.image_url,
      safety_note: ex.safety_note,
      voice_url: ex.voice_url,
    };
  });
}
