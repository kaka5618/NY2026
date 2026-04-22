import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "虚拟男友 · 陪伴聊天",
  description: "无付费墙、无好感度的陪伴式聊天（Next.js）",
};

/**
 * 根布局：全局样式与文档结构
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
