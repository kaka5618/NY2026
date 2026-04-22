import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import path from "path";

/**
 * 从 monorepo 仓库根目录加载 `.env.local`（与根目录单一环境文件约定一致）
 */
loadEnvConfig(path.resolve(process.cwd(), ".."));

const nextConfig: NextConfig = {
  transpilePackages: ["@vb/shared"],
};

export default nextConfig;
