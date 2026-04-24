import { useEffect, useState } from "react";

interface ImageCardProps {
  src: string;
  alt: string;
}

/**
 * 可点击放大的图片卡片
 */
export function ImageCard({ src, alt }: ImageCardProps) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!broken) setOpen(true);
        }}
        className="mt-2 block max-w-[min(100%,280px)] overflow-hidden rounded-2xl ring-1 ring-white/15 transition hover:ring-rose-300/50"
      >
        {!broken ? (
          <img
            src={src}
            alt={alt}
            className="max-h-72 w-full object-cover"
            loading="lazy"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-white/5 px-3 text-center text-xs text-slate-300">
            图片加载失败，正在使用占位图或稍后重试
          </div>
        )}
      </button>
      {open && !broken && (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
          aria-label="关闭预览"
        >
          <img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </button>
      )}
    </>
  );
}
