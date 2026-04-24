import type { QueryResult } from "pg";
import { getPgPool } from "@/server/db/pg-pool";
import type { CreateUserInput, UserRowDb, UserRowPublic } from "@/server/db/user-types";

interface UserRowPg {
  id: string | number;
  username: string;
  email: string;
  nickname: string;
  created_at: Date;
  password_hash?: string;
}

/**
 * 将 `RETURNING` 行映射为对外用户对象。
 */
function toPublic(r: UserRowPg): UserRowPublic {
  const t = r.created_at instanceof Date ? r.created_at : new Date(r.created_at);
  return {
    id: String(r.id),
    username: r.username,
    email: r.email,
    nickname: r.nickname,
    createdAt: t.getTime(),
  };
}

/**
 * 映射为含密码哈希的行。
 */
function toDb(r: UserRowPg & { password_hash: string }): UserRowDb {
  return { ...toPublic(r), passwordHash: r.password_hash };
}

/**
 * 按用户名查找（大小写不敏感），仅正常状态用户。
 */
export async function findUserByUsername(username: string): Promise<UserRowDb | null> {
  const pool = getPgPool();
  const res: QueryResult<UserRowPg & { password_hash: string }> = await pool.query(
    `SELECT id, username, email, password_hash, nickname, created_at
     FROM users
     WHERE lower(username) = lower($1) AND status = 1
     LIMIT 1`,
    [username.trim()]
  );
  const row = res.rows[0];
  return row ? toDb(row) : null;
}

/**
 * 按邮箱查找（大小写不敏感）。
 */
export async function findUserByEmail(email: string): Promise<UserRowDb | null> {
  const pool = getPgPool();
  const res: QueryResult<UserRowPg & { password_hash: string }> = await pool.query(
    `SELECT id, username, email, password_hash, nickname, created_at
     FROM users
     WHERE lower(email) = lower($1) AND status = 1
     LIMIT 1`,
    [email.trim()]
  );
  const row = res.rows[0];
  return row ? toDb(row) : null;
}

/**
 * 按主键查找公开字段。
 */
export async function findUserById(id: string): Promise<UserRowPublic | null> {
  const pool = getPgPool();
  const res: QueryResult<UserRowPg> = await pool.query(
    `SELECT id, username, email, nickname, created_at
     FROM users
     WHERE id = $1::bigint AND status = 1
     LIMIT 1`,
    [id]
  );
  const row = res.rows[0];
  return row ? toPublic(row) : null;
}

/**
 * 使用「用户名或邮箱」解析用户（用于登录）。
 */
export async function findUserByLoginKey(loginKey: string): Promise<UserRowDb | null> {
  const key = loginKey.trim();
  if (!key) return null;
  if (key.includes("@")) {
    return findUserByEmail(key);
  }
  return findUserByUsername(key);
}

/**
 * 插入新用户；违反唯一约束时抛出 `code === "23505"` 的 DatabaseError。
 */
export async function createUser(input: CreateUserInput): Promise<UserRowPublic> {
  const pool = getPgPool();
  const email = input.email.trim().toLowerCase();
  const res: QueryResult<UserRowPg> = await pool.query(
    `INSERT INTO users (username, password_hash, email, nickname)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, nickname, created_at`,
    [input.username.trim(), input.passwordHash, email, input.nickname.trim()]
  );
  const row = res.rows[0];
  if (!row) {
    throw new Error("注册写入失败：未返回行");
  }
  return toPublic(row);
}
