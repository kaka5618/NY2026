import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

let pool: Pool | null = null;
let attemptedDiskEnvLoad = false;

/**
 * 在 monorepo 中 `next dev` 的工作目录常为 `web/`，仅依赖 next.config 注入的 env
 * 时，部分运行上下文中 `process.env.DATABASE_URL` 仍为空。
 * 此处从常见路径读取 `.env.local` 中的 `DATABASE_URL` 作为兜底。
 */
function loadDatabaseUrlFromEnvFilesIfMissing(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  if (attemptedDiskEnvLoad) return;
  attemptedDiskEnvLoad = true;

  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), "..", ".env.local"),
    path.join(process.cwd(), "web", ".env.local"),
  ];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    const text = fs.readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const m = trimmed.match(/^(?:export\s+)?DATABASE_URL\s*=\s*(.+)$/);
      if (m) {
        process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
        if (process.env.DATABASE_URL) return;
      }
    }
  }
}

/**
 * 懒加载 PostgreSQL 连接池（`DATABASE_URL`）。
 */
export function getPgPool(): Pool {
  loadDatabaseUrlFromEnvFilesIfMissing();
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "缺少环境变量 DATABASE_URL。请在仓库根目录或 web 目录的 .env.local 中配置 PostgreSQL 连接串，并已执行 db/postgresql/001_init.sql。"
    );
  }
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: Number(process.env.PG_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}
