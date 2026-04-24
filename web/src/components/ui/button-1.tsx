"use client";

import type { MouseEventHandler, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** 尺寸预设：`sm` 约为 `lg` 的 0.5 倍，用于首页顶栏等 */
const SIZE_CLASS: Record<
  "sm" | "md" | "lg",
  { outer: string; btn: string; icon: string; glow: string }
> = {
  sm: {
    outer: "gap-2",
    glow: "rounded-md",
    btn: "rounded-md px-4 py-[7px] text-xs min-w-[6rem] justify-center",
    icon: "ml-1 -mr-0.5 h-3 w-3",
  },
  md: {
    outer: "gap-4",
    glow: "rounded-md",
    btn: "rounded-md px-5 py-2 text-sm",
    icon: "ml-2 -mr-0.5 h-4 w-4",
  },
  lg: {
    outer: "gap-4",
    glow: "rounded-xl",
    btn: "rounded-xl px-8 py-3.5 text-base min-w-[12rem] justify-center",
    icon: "ml-2 -mr-0.5 h-5 w-5",
  },
};

interface GlowLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  /** 与 `GlowButton` 一致的尺寸档位 */
  size?: "sm" | "md" | "lg";
}

interface GlowButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** 较大尺寸：用于人物卡片「选择」等主 CTA */
  size?: "sm" | "md" | "lg";
}

/**
 * 与人物画廊「选择」同风格的渐变发光链接按钮（`next/link`）。
 */
export function GlowLink({ href, children, className = "", size = "md" }: GlowLinkProps) {
  const s = SIZE_CLASS[size];
  return (
    <div className={`relative inline-flex items-center justify-center ${s.outer} group ${className}`}>
      <div
        className={`absolute inset-0 bg-gradient-to-r from-indigo-500 via-pink-500 to-yellow-400 opacity-60 blur-lg duration-1000 transition-all group-hover:opacity-100 group-hover:duration-200 ${s.glow}`}
      />
      <Link
        href={href}
        className={`group relative inline-flex items-center font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-800 hover:shadow-lg hover:shadow-gray-600/30 ${s.btn} bg-gray-900`}
      >
        {children}
        <ArrowRight className={`transition group-hover:translate-x-[3px] ${s.icon}`} />
      </Link>
    </div>
  );
}

/**
 * 渐变发光按钮（可复用）。
 */
export function GlowButton({ children, className = "", onClick, size = "md" }: GlowButtonProps) {
  const s = SIZE_CLASS[size];
  return (
    <div className={`relative inline-flex items-center justify-center ${s.outer} group ${className}`}>
      <div
        className={`absolute inset-0 bg-gradient-to-r from-indigo-500 via-pink-500 to-yellow-400 opacity-60 blur-lg duration-1000 transition-all group-hover:opacity-100 group-hover:duration-200 ${s.glow}`}
      />
      <button
        type="button"
        onClick={onClick}
        className={`group relative inline-flex items-center font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-800 hover:shadow-lg hover:shadow-gray-600/30 ${s.btn} bg-gray-900`}
        title={typeof children === "string" ? children : "button"}
      >
        {children}
        <ArrowRight className={`transition group-hover:translate-x-[3px] ${s.icon}`} />
      </button>
    </div>
  );
}

/**
 * 示例导出（与给定集成模板保持一致）。
 */
export const Component = () => {
  return <GlowButton>Explore CAT UI</GlowButton>;
};

