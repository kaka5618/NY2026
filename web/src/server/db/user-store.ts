import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

/** 写入数据库的用户行（不含密码哈希的对外形态） */
export interface UserRowPublic {
  id: string;
  username: string;
  email: string;
  nickname: string;
  createdAt: number;
}

interface UserRowDb extends UserRowPublic {
  passwordHash: string;
}

let dbSingleton: Database.Database | null = null;

/**
 * 解析 Next 应用 `web` 包根目录（兼容从仓库根或 `web` 目录启动 dev）。
 */
function resolveWebPackageRoot(): string {
  const cwd = process.cwd();
  if (path.basename(cwd) === "web" && fs.existsSync(path.join(cwd, "package.json"))) {
    return cwd;
  }
  const nested = path.join(cwd, "web");
  if (fs.existsSync(path.join(nested, "package.json"))) {
    return nested;
  }
  return cwd;
}

/**
 * 打开（或初始化）本地 SQLite，用于存放注册用户。
 */
function getDb(): Database.Database {
  if (dbSingleton) return dbSingleton;
  const dir = path.join(resolveWebPackageRoot(), "data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const file = path.join(dir, "app.db");
  const db = new Database(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      nickname TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `);
  dbSingleton = db;
  return db;
}

/**
 * 按用户名查找（大小写不敏感）。
 */
export function findUserByUsername(username: string): UserRowDb | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, username, email, password_hash AS passwordHash, nickname, created_at AS createdAt
       FROM users WHERE username = @u COLLATE NOCASE LIMIT 1`
    )
    .get({ u: username }) as UserRowDb | undefined;
  return row ?? null;
}

/**
 * 按邮箱查找（大小写不敏感）。
 */
export function findUserByEmail(email: string): UserRowDb | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, username, email, password_hash AS passwordHash, nickname, created_at AS createdAt
       FROM users WHERE email = @e COLLATE NOCASE LIMIT 1`
    )
    .get({ e: email.trim().toLowerCase() }) as UserRowDb | undefined;
  return row ?? null;
}

/**
 * 按 id 查找公开字段。
 */
export function findUserById(id: string): UserRowPublic | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, username, email, nickname, created_at AS createdAt
       FROM users WHERE id = @id LIMIT 1`
    )
    .get({ id }) as UserRowPublic | undefined;
  return row ?? null;
}

/**
 * 使用「用户名或邮箱」解析用户（用于登录）。
 */
export function findUserByLoginKey(loginKey: string): UserRowDb | null {
  const key = loginKey.trim();
  if (!key) return null;
  if (key.includes("@")) {
    return findUserByEmail(key);
  }
  return findUserByUsername(key);
}

export interface CreateUserInput {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  nickname: string;
  createdAt: number;
}

/**
 * 插入新用户；若用户名或邮箱冲突则抛出带 code 的错误。
 */
export function createUser(input: CreateUserInput): UserRowPublic {
  const db = getDb();
  try {
    db.prepare(
      `INSERT INTO users (id, username, email, password_hash, nickname, created_at)
       VALUES (@id, @username, @email, @passwordHash, @nickname, @createdAt)`
    ).run({
      id: input.id,
      username: input.username,
      email: input.email.trim().toLowerCase(),
      passwordHash: input.passwordHash,
      nickname: input.nickname,
      createdAt: input.createdAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) {
      const err = new Error("用户名或邮箱已被使用");
      (err as Error & { code: string }).code = "DUPLICATE";
      throw err;
    }
    throw e;
  }
  return {
    id: input.id,
    username: input.username,
    email: input.email.trim().toLowerCase(),
    nickname: input.nickname,
    createdAt: input.createdAt,
  };
}
