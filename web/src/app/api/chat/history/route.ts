import { NextResponse } from "next/server";
import {
  getOrCreateChatSession,
  isValidCharacterId,
  listSessionMessages,
  replaceSessionMessages,
} from "@/server/db/chat-repo";
import { getOptionalSessionUserId } from "@/server/auth/session-user";
import type { StoredChatMessage } from "@/types/stored-chat";

export const runtime = "nodejs";

/**
 * 校验请求体中的 messages 结构（轻量，避免恶意超大对象）。
 */
function isStoredMessageArray(x: unknown): x is StoredChatMessage[] {
  if (!Array.isArray(x)) return false;
  if (x.length > 500) return false;
  for (const m of x) {
    if (!m || typeof m !== "object") return false;
    const o = m as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.role !== "string" || typeof o.content !== "string") return false;
    if (o.role !== "user" && o.role !== "assistant") return false;
    if (typeof o.createdAt !== "number") return false;
  }
  return true;
}

/**
 * GET /api/chat/history?characterId= — 已登录返回数据库中的消息；未登录返回空数组。
 */
export async function GET(req: Request): Promise<Response> {
  const userId = await getOptionalSessionUserId();
  if (!userId) {
    return NextResponse.json({ messages: [] as StoredChatMessage[] });
  }
  const { searchParams } = new URL(req.url);
  const characterId = searchParams.get("characterId") ?? "";
  if (!isValidCharacterId(characterId)) {
    return NextResponse.json({ error: "无效角色" }, { status: 400 });
  }
  try {
    const messages = await listSessionMessages(userId, characterId);
    return NextResponse.json({ messages });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "数据库未配置" }, { status: 503 });
    }
    console.error("[chat/history GET]", e);
    return NextResponse.json({ error: "读取失败" }, { status: 500 });
  }
}

/**
 * POST /api/chat/history — 将当前会话完整消息同步到数据库（需登录）。
 */
export async function POST(req: Request): Promise<Response> {
  const userId = await getOptionalSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 无效" }, { status: 400 });
  }
  const body = json as { characterId?: string; messages?: unknown };
  const characterId = body.characterId ?? "";
  if (!isValidCharacterId(characterId)) {
    return NextResponse.json({ error: "无效角色" }, { status: 400 });
  }
  if (!isStoredMessageArray(body.messages)) {
    return NextResponse.json({ error: "messages 无效或过多" }, { status: 400 });
  }
  try {
    const sessionId = await getOrCreateChatSession(userId, characterId);
    await replaceSessionMessages(sessionId, body.messages);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("messages_limit_")) {
      return NextResponse.json({ error: "消息条数过多" }, { status: 400 });
    }
    if (msg.includes("DATABASE_URL")) {
      return NextResponse.json({ error: "数据库未配置" }, { status: 503 });
    }
    console.error("[chat/history POST]", e);
    return NextResponse.json({ error: "同步失败" }, { status: 500 });
  }
}
