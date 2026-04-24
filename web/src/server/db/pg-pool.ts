import { Pool } from "pg";

let pool: Pool | null = null;

/**
 * 懒加载 PostgreSQL 连接池（`DATABASE_URL`）。
 */
export function getPgPool(): Pool {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "缺少环境变量 DATABASE_URL。请在仓库根目录 .env.local 中配置 PostgreSQL 连接串，并已执行 db/postgresql/001_init.sql。"
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
