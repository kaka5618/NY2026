"use client";

import type { MouseEventHandler, ReactNode } from "react";
import { ArrowRight } from "lucide-react";

interface GlowButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

/**
 * 渐变发光按钮（可复用）。
 */
export function GlowButton({ children, className = "", onClick }: GlowButtonProps) {
  return (
    <div className={`relative inline-flex items-center justify-center gap-4 group ${className}`}>
      <div className="absolute inset-0 rounded-md bg-gradient-to-r from-indigo-500 via-pink-500 to-yellow-400 opacity-60 blur-lg duration-1000 transition-all group-hover:opacity-100 group-hover:duration-200" />
      <button
        type="button"
        onClick={onClick}
        className="group relative inline-flex items-center justify-center rounded-md bg-gray-900 px-5 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-800 hover:shadow-lg hover:shadow-gray-600/30"
        title={typeof children === "string" ? children : "button"}
      >
        {children}
        <ArrowRight className="ml-2 h-4 w-4 -mr-1 transition group-hover:translate-x-[3px]" />
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

