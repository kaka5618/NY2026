"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CharacterId, ReplyType } from "@vb/shared";
import {
  postChat,
  postGenerateImage,
  fetchCharacters,
  type CharacterPublic,
} from "@/lib/api";
import { loadSession, saveSession, type StoredChatMessage } from "@/lib/db";
import { computeModalityStats } from "@/lib/stats";
import { ChatPageView } from "@/ui/pages/chat/ChatPageView";
import photoShenyu from "@/ui/pages/home/照片/iShot_2026-04-23_21.22.22.png";
import photoLushiyan from "@/ui/pages/home/照片/iShot_2026-04-23_21.31.05.png";
import photoJiangyubai from "@/ui/pages/home/照片/iShot_2026-04-23_21.33.07.png";
import photoHuoyanchen from "@/ui/pages/home/照片/iShot_2026-04-23_21.35.55.png";

const VALID_IDS: CharacterId[] = ["shenyu", "lushiyan", "jiangyubai", "huoyanchen"];

const CHARACTER_AVATAR_MAP: Record<CharacterId, string> = {
  shenyu: photoShenyu.src,
  lushiyan: photoLushiyan.src,
  jiangyubai: photoJiangyubai.src,
  huoyanchen: photoHuoyanchen.src,
};

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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const syncRemote = useCallback(async (next: StoredChatMessage[]) => {
    if (!characterId) return;
    try {
      const meRes = await fetch("/api/auth/me", { credentials: "same-origin" });
      const me = (await meRes.json()) as { user?: { id: string } | null };
      if (!me.user) return;
      await fetch("/api/chat/history", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, messages: next }),
      });
    } catch {
      /* 同步失败时本地 IndexedDB 仍有数据 */
    }
  }, [characterId]);

  useEffect(() => {
    if (!characterId) return;
    let cancelled = false;
    (async () => {
      const [chars, mePayload] = await Promise.all([
        fetchCharacters().catch(() => [] as CharacterPublic[]),
        fetch("/api/auth/me", { credentials: "same-origin" }).then((r) => r.json()),
      ]);
      if (cancelled) return;
      const me = mePayload as { user?: { id: string } | null };
      const loggedIn = Boolean(me.user);
      setIsLoggedIn(loggedIn);

      const m = chars.find((c) => c.id === characterId) ?? null;
      setMeta(m);

      let stored: StoredChatMessage[] = [];
      if (loggedIn) {
        const h = await fetch(
          `/api/chat/history?characterId=${encodeURIComponent(characterId)}`,
          { credentials: "same-origin" }
        );
        if (h.ok) {
          const j = (await h.json()) as { messages?: StoredChatMessage[] };
          const remote = j.messages ?? [];
          if (remote.length > 0) {
            stored = remote;
          } else {
            const local = await loadSession(characterId);
            if (local.length > 0) {
              await fetch("/api/chat/history", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ characterId, messages: local }),
              });
              stored = local;
            }
          }
        }
      } else {
        stored = await loadSession(characterId);
      }
      setMessages(stored);
      await saveSession(characterId, stored);
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
      void syncRemote(next);
    },
    [characterId, syncRemote]
  );

  const onVoiceUrlCached = useCallback(
    (messageId: string, url: string) => {
      if (!characterId) return;
      setMessages((prev) => {
        const next = prev.map((x) => (x.id === messageId ? { ...x, voice_url: url } : x));
        void saveSession(characterId, next);
        void syncRemote(next);
        return next;
      });
    },
    [characterId, syncRemote]
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

      const isImageReply = replyType === "image" || replyType === "text+image";
      if (isImageReply && r.image_generation_prompt) {
        void (async () => {
          try {
            const generated = await postGenerateImage({
              prompt: r.image_generation_prompt!,
              response_format: "url",
              size: "2K",
              stream: false,
              watermark: true,
              sequential_image_generation: "disabled",
              characterId,
              imageRef: r.image_ref,
            });
            const generatedUrl = generated.data?.[0]?.url;
            if (generatedUrl) {
              if (!characterId) return;
              setMessages((prev) => {
                const next = prev.map((m) =>
                  m.id === assistantMsg.id
                    ? {
                        ...m,
                        image_url: generatedUrl,
                      }
                    : m
                );
                void saveSession(characterId, next);
                void syncRemote(next);
                return next;
              });
            }
          } catch {
            /**
             * 异步生图失败时保留占位图，不打断主聊天流程。
             */
          }
        })();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败");
    } finally {
      setSending(false);
    }
  };

  const title = meta?.name ?? "聊天";
  const roleAvatarSrc = useMemo(() => {
    if (!characterId) return "";
    return CHARACTER_AVATAR_MAP[characterId];
  }, [characterId]);

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
    <ChatPageView
      characterId={characterId}
      meta={meta}
      title={title}
      headerLine={headerLine}
      roleAvatarSrc={roleAvatarSrc}
      messages={messages}
      sending={sending}
      error={error}
      input={input}
      bottomRef={bottomRef}
      onInputChange={setInput}
      onSend={() => void onSend()}
      isLoggedIn={isLoggedIn}
      onVoiceUrlCached={onVoiceUrlCached}
    />
  );
}
