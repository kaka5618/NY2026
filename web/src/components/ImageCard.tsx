import { useState } from "react";

interface ImageCardProps {
  src: string;
  alt: string;
}

/**
 * 可点击放大的图片卡片
 */
export function ImageCard({ src, alt }: ImageCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 block max-w-[min(100%,280px)] overflow-hidden rounded-2xl ring-1 ring-white/15 transition hover:ring-rose-300/50"
      >
        <img src={src} alt={alt} className="max-h-72 w-full object-cover" loading="lazy" />
      </button>
      {open && (
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
