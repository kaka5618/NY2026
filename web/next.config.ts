import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import fs from "node:fs";
import path from "path";

/**
 * 从 monorepo 仓库根目录加载 `.env.local`（与根目录单一环境文件约定一致）
 */
function resolveRepoRoot(): string {
  const cwd = process.cwd();
  const cwdAsRoot = path.join(cwd, "web", "next.config.ts");
  if (fs.existsSync(cwdAsRoot)) return cwd;
  if (path.basename(cwd) === "web") return path.resolve(cwd, "..");
  return cwd;
}

const repoRoot = resolveRepoRoot();
loadEnvConfig(repoRoot);

const nextConfig: NextConfig = {
  transpilePackages: ["@vb/shared"],
};

export default nextConfig;
