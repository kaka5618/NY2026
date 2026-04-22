import { NextResponse } from "next/server";
import { listPublicCharacters } from "@vb/shared";

/**
 * GET /api/characters — 返回公开角色卡片数据（与 shared 一致）
 */
export function GET() {
  return NextResponse.json({ characters: listPublicCharacters() });
}
