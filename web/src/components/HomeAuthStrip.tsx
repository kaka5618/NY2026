"use client";

import { useCallback, useEffect, useState } from "react";
import { GlowButton, GlowLink } from "@/components/ui/button-1";

type MeUser = { id: string; username: string; email: string; nickname: string };

/**
 * 首页右上角：未登录为半尺寸（`sm`）发光「登录 / 注册」；已登录为问候 + 「退出」。
 */
export function HomeAuthStrip() {
  const [user, setUser] = useState<MeUser | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    const data = (await res.json()) as { user: MeUser | null };
    setUser(data.user);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    setUser(null);
  };

  if (user === undefined) {
    return (
      <div className="flex min-h-[28px] items-center justify-end gap-2">
        <div className="h-7 w-[6rem] animate-pulse rounded-md bg-white/5" />
        <div className="h-7 w-[6rem] animate-pulse rounded-md bg-white/5" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex max-w-[min(100vw-1.5rem,20rem)] flex-wrap items-center justify-end gap-2">
        <span className="text-right text-xs text-slate-300 [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
          你好，{user.nickname}
        </span>
        <GlowButton size="sm" onClick={() => void logout()}>
          退出
        </GlowButton>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5">
      <GlowLink href="/login" size="sm">
        登录
      </GlowLink>
      <GlowLink href="/register" size="sm">
        注册
      </GlowLink>
    </div>
  );
}
