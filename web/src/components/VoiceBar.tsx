"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterId } from "@vb/shared";
import { postTts } from "@/lib/api";

interface VoiceBarProps {
  characterId: CharacterId;
  voiceText: string;
}

/**
 * 语音条组件，首次播放时向服务端请求 TTS 音频并缓存 URL。
 */
export function VoiceBar({ characterId, voiceText }: VoiceBarProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const ensureAudio = useCallback(async () => {
    if (blobUrl) return blobUrl;
    setLoading(true);
    setErr(null);
    try {
      const blob = await postTts(characterId, voiceText);
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      return url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "语音加载失败");
      return null;
    } finally {
      setLoading(false);
    }
  }, [blobUrl, characterId, voiceText]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !blobUrl) return;
    const onMeta = () => setDuration(a.duration || null);
    const onEnded = () => setPlaying(false);
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnded);
    a.addEventListener("pause", onPause);
    a.addEventListener("play", onPlay);
    return () => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("play", onPlay);
    };
  }, [blobUrl]);

  const toggle = async () => {
    const url = blobUrl ?? (await ensureAudio());
    if (!url) return;
    const a = audioRef.current;
    if (!a) return;
    if (a.src !== url) a.src = url;
    if (playing) a.pause();
    else void a.play();
  };

  const sec = duration && Number.isFinite(duration) ? Math.max(1, Math.round(duration)) : null;

  return (
    <div className="mt-2 flex items-center gap-3 rounded-2xl bg-black/25 px-3 py-2 ring-1 ring-white/10">
      <audio ref={audioRef} className="hidden" preload="metadata" />
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={loading}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/90 text-white shadow-lg shadow-rose-900/40 transition hover:bg-rose-400 disabled:opacity-60"
        aria-label={playing ? "暂停语音" : "播放语音"}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : playing ? (
          <span className="text-lg">❚❚</span>
        ) : (
          <span className="ml-0.5 text-lg">▶</span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full w-1/3 rounded-full bg-gradient-to-r from-rose-300 to-amber-200 opacity-80"
            style={{ width: playing ? "65%" : "28%" }}
          />
        </div>
        <p className="mt-1 truncate text-xs text-slate-400">{err ?? (sec ? `${sec}″` : "点按播放")}</p>
      </div>
    </div>
  );
}
