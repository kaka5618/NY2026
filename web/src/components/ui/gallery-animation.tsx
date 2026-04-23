"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { GlowButton } from "@/components/ui/button-1";
import photoShenyu from "../../ui/pages/home/照片/iShot_2026-04-23_21.22.22.png";
import photoLushiyan from "../../ui/pages/home/照片/iShot_2026-04-23_21.31.05.png";
import photoJiangyubai from "../../ui/pages/home/照片/iShot_2026-04-23_21.33.07.png";
import photoHuoyanchen from "../../ui/pages/home/照片/iShot_2026-04-23_21.35.55.png";

interface ExpandableGalleryProps {
  images: string[];
  labels?: string[];
  onSelect?: (index: number) => void;
  selectCtaText?: string;
  className?: string;
}

/**
 * 可横向扩展和全屏预览的图片画廊组件。
 */
const ExpandableGallery: React.FC<ExpandableGalleryProps> = ({
  images,
  labels = [],
  onSelect,
  selectCtaText = "选择",
  className = "",
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  /**
   * 打开指定图片索引。
   */
  const openImage = (index: number): void => {
    setSelectedIndex(index);
  };

  /**
   * 关闭预览层。
   */
  const closeImage = (): void => {
    setSelectedIndex(null);
  };

  /**
   * 切换到下一张图片。
   */
  const goToNext = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % images.length);
    }
  };

  /**
   * 切换到上一张图片。
   */
  const goToPrev = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + images.length) % images.length);
    }
  };

  /**
   * 根据 hover 状态计算当前项 flex 比例。
   */
  const getFlexValue = (index: number): number => {
    if (hoveredIndex === null) {
      return 1;
    }
    return hoveredIndex === index ? 2 : 0.5;
  };

  /**
   * 点击“选择”按钮时触发对应回调。
   */
  const handleSelect = (e: React.MouseEvent, index: number): void => {
    e.stopPropagation();
    onSelect?.(index);
  };

  return (
    <div className={className}>
      <div className="flex h-[36rem] w-full gap-2">
        {images.map((image, index) => (
          <motion.div
            key={index}
            className="relative cursor-pointer overflow-hidden rounded-md"
            style={{ flex: 1 }}
            animate={{ flex: getFlexValue(index) }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => openImage(index)}
          >
            <img
              src={image}
              alt={`Gallery image ${index + 1}`}
              className="h-full w-full object-cover"
            />
            <motion.div
              className="absolute inset-0 bg-black"
              initial={{ opacity: 0 }}
              animate={{ opacity: hoveredIndex === index ? 0 : 0.3 }}
              transition={{ duration: 0.3 }}
            />
            <AnimatePresence>
              {hoveredIndex === index && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-x-0 bottom-4 flex flex-col items-center justify-center px-3"
                >
                  <p className="mb-2 text-xs font-medium text-white/90">开始聊天</p>
                  <GlowButton
                    className="scale-90"
                    onClick={(e) => handleSelect(e, index)}
                  >
                    {selectCtaText}
                    {labels[index] ? ` · ${labels[index]}` : ""}
                  </GlowButton>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-sm"
            onClick={closeImage}
          >
            <button
              className="absolute right-4 top-4 z-10 text-white transition-colors hover:text-gray-300"
              onClick={closeImage}
              aria-label="关闭预览"
            >
              <X className="h-8 w-8" />
            </button>

            {images.length > 1 && (
              <button
                className="absolute left-4 z-10 text-white transition-colors hover:text-gray-300"
                onClick={goToPrev}
                aria-label="上一张"
              >
                <ChevronLeft className="h-10 w-10" />
              </button>
            )}

            <motion.div
              className="relative max-h-[90vh] w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.img
                key={selectedIndex}
                src={images[selectedIndex]}
                alt={`Gallery image ${selectedIndex + 1}`}
                className="h-full w-full rounded-md object-contain"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
              />
            </motion.div>

            {images.length > 1 && (
              <button
                className="absolute right-4 z-10 text-white transition-colors hover:text-gray-300"
                onClick={goToNext}
                aria-label="下一张"
              >
                <ChevronRight className="h-10 w-10" />
              </button>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-black/45 px-4 py-2 text-sm text-white ring-1 ring-white/15">
              {selectedIndex + 1} / {images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * 组件示例导出，方便页面直接引用。
 */
export function Component(): React.ReactElement {
  const router = useRouter();
  const galleryItems = [
    { image: photoShenyu.src, label: "沈屿", href: "/chat/shenyu" },
    { image: photoLushiyan.src, label: "陆时衍", href: "/chat/lushiyan" },
    { image: photoJiangyubai.src, label: "江屿白", href: "/chat/jiangyubai" },
    { image: photoHuoyanchen.src, label: "霍砚琛", href: "/chat/huoyanchen" },
  ] as const;

  return (
    <div className="flex items-center justify-center bg-transparent p-4 md:p-6">
      <ExpandableGallery
        images={galleryItems.map((item) => item.image)}
        labels={galleryItems.map((item) => item.label)}
        onSelect={(index) => {
          const target = galleryItems[index];
          if (target) router.push(target.href);
        }}
        selectCtaText="选择"
        className="w-full max-w-7xl"
      />
    </div>
  );
}

export default ExpandableGallery;
