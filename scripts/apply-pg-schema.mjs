/**
 * 从仓库根目录 `.env.local` 读取 DATABASE_URL，执行 db/postgresql/001_init.sql。
 * 用法：node scripts/apply-pg-schema.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const pgRoot = path.join(root, "node_modules", "pg");
const pgWeb = path.join(root, "web", "node_modules", "pg");
const pg = fs.existsSync(pgRoot) ? require(pgRoot) : require(pgWeb);

function loadDatabaseUrl() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("未找到 .env.local");
    process.exit(1);
  }
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed) continue;
    const m = trimmed.match(/^DATABASE_URL\s*=\s*(.+)$/);
    if (m) {
      return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  console.error(".env.local 中未找到 DATABASE_URL");
  process.exit(1);
}

const connectionString = loadDatabaseUrl();
const sqlPath = path.join(root, "db", "postgresql", "001_init.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query(sql);
  console.log("已执行 db/postgresql/001_init.sql，Neon 表结构就绪。");
} finally {
  await client.end();
}
