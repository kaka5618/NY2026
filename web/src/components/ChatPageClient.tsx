"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CharacterId, ReplyType } from "@vb/shared";
import { ImageCard } from "@/components/ImageCard";
import { VoiceBar } from "@/components/VoiceBar";
import { postChat, fetchCharacters, type CharacterPublic } from "@/lib/api";
import { loadSession, saveSession, type StoredChatMessage } from "@/lib/db";
import { computeModalityStats } from "@/lib/stats";

const VALID_IDS: CharacterId[] = ["shenyu", "lushiyan", "jiangyubai", "huoyanchen"];

function isCharacterId(s: string | undefined): s is CharacterId {
  return !!s && (VALID_IDS as string[]).includes(s);
}

interface ChatPageClientProps {
  characterId: string;
}

/**
 * 单会话聊天页：消息流 + 本地持久化 + 多模态展示
 */
export function ChatPageClient({ characterId: rawId }: ChatPageClientProps) {
  const characterId = isCharacterId(rawId) ? rawId : null;

  const [meta, setMeta] = useState<CharacterPublic | null>(null);
  const [messages, setMessages] = useState<StoredChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!characterId) return;
    let cancelled = false;
    (async () => {
      const [chars, stored] = await Promise.all([
        fetchCharacters().catch(() => [] as CharacterPublic[]),
        loadSession(characterId),
      ]);
      if (cancelled) return;
      const m = chars.find((c) => c.id === characterId) ?? null;
      setMeta(m);
      setMessages(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, [characterId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const persist = useCallback(
    async (next: StoredChatMessage[]) => {
      if (!characterId) return;
      setMessages(next);
      await saveSession(characterId, next);
    },
    [characterId]
  );

  const onSend = async () => {
    if (!characterId) return;
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: StoredChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      createdAt: Date.now(),
      content: text,
    };

    const draft = [...messages, userMsg];
    setInput("");
    setError(null);
    setSending(true);

    try {
      await persist(draft);
      const stats = computeModalityStats(draft, true);
      const res = await postChat({
        characterId,
        messages: draft,
        userMessage: text,
        stats,
      });

      const r = res.reply;
      const replyType = (r.reply_type ?? "text") as ReplyType;

      const assistantMsg: StoredChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        createdAt: Date.now(),
        content: r.content,
        reply_type: replyType,
        voice_text: r.voice_text,
        image_ref: r.image_ref,
        image_url: r.resolved_image_url,
        safety_note: r.safety_note,
      };

      await persist([...draft, assistantMsg]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败");
    } finally {
      setSending(false);
    }
  };

  const title = meta?.name ?? "聊天";
  const headerLine = useMemo(() => {
    if (!meta) return "";
    return `${meta.age} 岁 · ${meta.role}`;
  }, [meta]);

  if (!characterId) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-slate-300">无效角色</p>
        <Link href="/" className="text-rose-300 underline">
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-slate-950 to-slate-900">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/85 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            href="/"
            className="rounded-full px-2 py-1 text-sm text-slate-400 transition hover:text-white"
          >
            ← 切换
          </Link>
          {meta && (
            <img
              src={meta.avatarUrl}
              alt=""
              className="h-11 w-11 rounded-2xl object-cover ring-1 ring-white/15"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold text-white">{title}</h1>
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                在线
              </span>
            </div>
            <p className="truncate text-xs text-slate-400">{headerLine}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 overflow-y-auto px-3 py-4">
        {messages.length === 0 && (
          <p className="mx-auto max-w-md rounded-2xl bg-white/5 px-4 py-3 text-center text-sm text-slate-400 ring-1 ring-white/10">
            打个招呼吧。他会根据你的语气，用文字、语音或画面回应你。
          </p>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-3xl rounded-br-md bg-rose-500/90 px-4 py-2.5 text-sm leading-relaxed text-white shadow-lg shadow-rose-900/20">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-start">
              <div className="max-w-[90%] rounded-3xl rounded-bl-md bg-slate-800/90 px-4 py-2.5 text-sm leading-relaxed text-slate-100 ring-1 ring-white/10">
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.safety_note && (
                  <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-100 ring-1 ring-amber-400/30">
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
          <div className="flex justify-start">
            <div className="rounded-3xl bg-slate-800/60 px-4 py-3 text-sm text-slate-400 ring-1 ring-white/10">
              <span className="inline-flex gap-1">
                <span className="animate-bounce">·</span>
                <span className="animate-bounce [animation-delay:120ms]">·</span>
                <span className="animate-bounce [animation-delay:240ms]">·</span>
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-center text-sm text-rose-100">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      <footer className="border-t border-white/10 bg-slate-950/90 px-3 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
            rows={1}
            placeholder="想说的，慢慢打在这里…"
            className="max-h-40 min-h-[48px] flex-1 resize-none rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500 focus:border-rose-400/50"
          />
          <button
            type="button"
            onClick={() => void onSend()}
            disabled={sending || !input.trim()}
            className="shrink-0 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 transition hover:bg-rose-400 disabled:opacity-40"
          >
            发送
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-slate-500">
          记录仅保存在本机浏览器，不会上传你的本地存储历史。语音播放按需加载，不影响首条文字返回。
        </p>
      </footer>
    </div>
  );
}
