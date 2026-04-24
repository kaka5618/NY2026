"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import type { CharacterId } from "@vb/shared";
import { GlowButton } from "@/components/ui/button-1";
import photoShenyu from "../../ui/pages/home/照片/iShot_2026-04-23_21.22.22.png";
import photoLushiyan from "../../ui/pages/home/照片/iShot_2026-04-23_21.31.05.png";
import photoJiangyubai from "../../ui/pages/home/照片/iShot_2026-04-23_21.33.07.png";
import photoHuoyanchen from "../../ui/pages/home/照片/iShot_2026-04-23_21.35.55.png";

/** 与 shared 角色一一对应的首页短简介（悬停展开时显示） */
const GALLERY_INTROS: Record<CharacterId, string> = {
  shenyu: "大学文学系讲师。温柔会听、喜诗与煮茶，像旧书一样让人安心。",
  lushiyan: "互联网公司技术总监。外冷内热，会催你「先吃饭」，认定后很专一。",
  jiangyubai: "独立乐队主唱。阳光爱闹，常拽你去喝奶茶、换换心情。",
  huoyanchen: "家族企业继承人。语气笃定、习惯护短，给偏爱也给你时间。",
};

interface ExpandableGalleryProps {
  images: string[];
  labels?: string[];
  /** 与 `images` 下标一一对应的人物简介；有则悬停时展示在按钮上方 */
  intros?: string[];
  onSelect?: (index: number) => void;
  selectCtaText?: string;
  className?: string;
}

/**
 * 可横向手风琴展开的人物画廊：悬停项变宽、底部渐变压暗并展示简介 + 大颗「选择」按钮。
 */
const ExpandableGallery: React.FC<ExpandableGalleryProps> = ({
  images,
  labels = [],
  intros = [],
  onSelect,
  selectCtaText = "选择",
  className = "",
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
   * 点击“选择”按钮时触发回调。
   */
  const handleSelect = (e: React.MouseEvent, index: number): void => {
    e.stopPropagation();
    onSelect?.(index);
  };

  return (
    <div className={`select-none ${className}`}>
      <div className="flex h-[36rem] w-full gap-2">
        {images.map((image, index) => (
          <motion.div
            key={index}
            className="relative overflow-hidden rounded-md"
            style={{ flex: 1 }}
            animate={{ flex: getFlexValue(index) }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <img
              src={image}
              alt={`Gallery image ${index + 1}`}
              draggable={false}
              className="h-full w-full object-cover"
            />
            <motion.div
              className="absolute inset-0 bg-black"
              initial={{ opacity: 0 }}
              animate={{ opacity: hoveredIndex === index ? 0 : 0.3 }}
              transition={{ duration: 0.3 }}
            />
            {hoveredIndex === index && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-stretch justify-end"
              >
                <div
                  className="pointer-events-auto flex flex-col items-center gap-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-5 pt-10 font-home sm:px-6"
                >
                  {intros[index] ? (
                    <p className="max-w-[20rem] text-center text-[13px] font-normal leading-relaxed text-rose-50/95 [text-shadow:0_1px_12px_rgba(0,0,0,0.75)] sm:max-w-[24rem] sm:text-sm">
                      {intros[index]}
                    </p>
                  ) : null}
                  <div className="flex w-full justify-center">
                    <GlowButton
                      size="lg"
                      onClick={(e) => handleSelect(e, index)}
                    >
                      {selectCtaText}
                      {labels[index] ? ` · ${labels[index]}` : ""}
                    </GlowButton>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

/**
 * 组件示例导出，方便页面直接引用。
 */
export function Component(): React.ReactElement {
  const router = useRouter();
  const galleryItems = [
    { id: "shenyu" as const, image: photoShenyu.src, label: "沈屿", href: "/chat/shenyu" },
    { id: "lushiyan" as const, image: photoLushiyan.src, label: "陆时衍", href: "/chat/lushiyan" },
    { id: "jiangyubai" as const, image: photoJiangyubai.src, label: "江屿白", href: "/chat/jiangyubai" },
    { id: "huoyanchen" as const, image: photoHuoyanchen.src, label: "霍砚琛", href: "/chat/huoyanchen" },
  ] as const;

  return (
    <div className="flex items-center justify-center bg-transparent p-4 md:p-6">
      <ExpandableGallery
        images={galleryItems.map((item) => item.image)}
        labels={galleryItems.map((item) => item.label)}
        intros={galleryItems.map((item) => GALLERY_INTROS[item.id])}
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
