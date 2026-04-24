"use client";

import type { MouseEventHandler, ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/** 尺寸预设：与首页画廊等位置的主操作按钮配套 */
const SIZE_CLASS: Record<"md" | "lg", { btn: string; icon: string; glow: string }> = {
  md: {
    glow: "rounded-md",
    btn: "rounded-md px-5 py-2 text-sm",
    icon: "h-4 w-4",
  },
  lg: {
    glow: "rounded-xl",
    btn: "rounded-xl px-8 py-3.5 text-base min-w-[12rem] justify-center",
    icon: "h-5 w-5",
  },
};

interface GlowButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** 较大尺寸：用于人物卡片「选择」等主 CTA */
  size?: "md" | "lg";
}

/**
 * 渐变发光按钮（可复用）。
 */
export function GlowButton({ children, className = "", onClick, size = "md" }: GlowButtonProps) {
  const s = SIZE_CLASS[size];
  return (
    <div className={`relative inline-flex items-center justify-center gap-4 group ${className}`}>
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
        <ArrowRight className={`ml-2 -mr-0.5 transition group-hover:translate-x-[3px] ${s.icon}`} />
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

