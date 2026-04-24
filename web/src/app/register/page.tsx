import { RegisterPageView } from "@/ui/pages/register/RegisterPageView";

/**
 * 避免静态预渲染在「构建瞬间」把空的站点密钥打进页面；改为每次请求在服务端读环境变量再传给客户端。
 * @see https://nextjs.org/docs/app/building-your-application/rendering/server-components
 */
export const dynamic = "force-dynamic";

/**
 * 解析 Turnstile 站点密钥：优先仅服务端可见的 `TURNSTILE_SITE_KEY`（适合 Docker/运行时注入），否则回退 `NEXT_PUBLIC_*`。
 *
 * @returns 站点密钥，未配置时为空串
 */
function resolveTurnstileSiteKey(): string {
  const a = process.env.TURNSTILE_SITE_KEY?.trim();
  const b = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return a || b || "";
}

/**
 * 注册页路由：注入 Turnstile 站点密钥（服务端读取，不依赖客户端打包内联）。
 */
export default function RegisterPage() {
  return <RegisterPageView turnstileSiteKey={resolveTurnstileSiteKey()} />;
}
