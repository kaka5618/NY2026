-- 若已执行过旧版 001（含 CONSTRAINT uq_users_username UNIQUE (username)），再执行本脚本以改为不区分大小写唯一。
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/postgresql/002_users_username_ci_unique.sql

ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_username;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower ON users (lower(username));
