"use client";

import Link from "next/link";
import type { CharacterId } from "@vb/shared";
import { ImageCard } from "@/components/ImageCard";
import { VoiceBar } from "@/components/VoiceBar";
import type { CharacterPublic } from "@/lib/api";
import type { StoredChatMessage } from "@/lib/db";

interface ChatPageViewProps {
  characterId: CharacterId;
  meta: CharacterPublic | null;
  title: string;
  headerLine: string;
  roleAvatarSrc: string;
  messages: StoredChatMessage[];
  sending: boolean;
  error: string | null;
  input: string;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

/**
 * 聊天页纯 UI 组件（微信风格）。
 */
export function ChatPageView({
  characterId,
  meta,
  title,
  headerLine,
  roleAvatarSrc,
  messages,
  sending,
  error,
  input,
  bottomRef,
  onInputChange,
  onSend,
}: ChatPageViewProps) {
  return (
    <div className="flex min-h-full flex-col bg-[#ededed]">
      <header className="sticky top-0 z-10 border-b border-black/10 bg-[#f7f7f7] px-4 py-2.5">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link href="/" className="text-sm font-medium text-[#576b95] transition hover:opacity-80">
            ← 切换
          </Link>
          {meta && <img src={roleAvatarSrc} alt="" className="h-9 w-9 rounded-md object-cover" />}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-[#111]">{title}</h1>
            <p className="truncate text-xs text-[#777]">{headerLine || "在线"}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 overflow-y-auto px-3 py-4">
        {messages.length === 0 && (
          <p className="mx-auto max-w-md rounded-md bg-[#d7d7d7] px-3 py-1.5 text-center text-xs text-[#666]">
            打个招呼吧。他会根据你的语气，用文字、语音或画面回应你。
          </p>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex items-start justify-end gap-2">
              <div className="max-w-[78%] rounded-md bg-[#95ec69] px-3 py-2 text-sm leading-relaxed text-[#111] shadow-[0_1px_1px_rgba(0,0,0,0.08)]">
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#c7c7c7] text-xs font-semibold text-[#555]">
                我
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex items-start gap-2">
              {meta ? (
                <img src={roleAvatarSrc} alt="" className="h-9 w-9 rounded-md object-cover" />
              ) : (
                <div className="h-9 w-9 rounded-md bg-[#c7c7c7]" />
              )}
              <div className="max-w-[78%] rounded-md bg-white px-3 py-2 text-sm leading-relaxed text-[#111] shadow-[0_1px_1px_rgba(0,0,0,0.08)]">
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.safety_note && (
                  <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-700">
                    {m.safety_note}
                  </p>
                )}
                {m.image_url && <ImageCard src={m.image_url} alt="分享的图片" />}
                {(() => {
                  const rt = m.reply_type ?? "text";
                  const vt = (m.voice_text?.trim() || (rt === "voice" ? m.content : "")) || "";
                  if (!vt || (rt !== "voice" && rt !== "text+voice")) return null;
                  return <VoiceBar characterId={characterId} voiceText={vt} />;
                })()}
              </div>
            </div>
          )
        )}

        {sending && (
          <div className="flex items-start gap-2">
            {meta ? (
              <img src={roleAvatarSrc} alt="" className="h-9 w-9 rounded-md object-cover" />
            ) : (
              <div className="h-9 w-9 rounded-md bg-[#c7c7c7]" />
            )}
            <div className="rounded-md bg-white px-3 py-2 text-sm text-[#999] shadow-[0_1px_1px_rgba(0,0,0,0.08)]">
              <span className="inline-flex gap-1">
                <span className="animate-bounce">·</span>
                <span className="animate-bounce [animation-delay:120ms]">·</span>
                <span className="animate-bounce [animation-delay:240ms]">·</span>
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-center text-sm text-rose-600">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      <footer className="border-t border-black/10 bg-[#f7f7f7] px-3 py-2">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            placeholder="输入消息"
            className="max-h-40 min-h-[38px] flex-1 resize-none rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#95ec69]"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={sending || !input.trim()}
            className="h-[38px] shrink-0 rounded-md bg-[#07c160] px-4 text-sm font-semibold text-white transition hover:bg-[#06ad58] disabled:opacity-40"
          >
            发送
          </button>
        </div>
        <p className="mx-auto mt-1 max-w-3xl text-center text-[10px] text-[#999]">
          记录仅保存在本机浏览器，不会上传你的本地存储历史。语音播放按需加载，不影响首条文字返回。
        </p>
      </footer>
    </div>
  );
}

