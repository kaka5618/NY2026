import type { CharacterId } from "@vb/shared";

/**
 * 媒体存储提供方类型。
 */
type MediaStorageProvider = "none" | "cloudflare";

/**
 * 生成图片后可持久化的信息。
 */
export interface PersistImageParams {
  characterId: CharacterId;
  imageRef: string;
  sourceUrl: string;
  prompt: string;
}

/**
 * 生成语音后可持久化的信息。
 */
export interface PersistVoiceParams {
  characterId: CharacterId;
  text: string;
  audio: Buffer;
  mimeType: string;
}

/**
 * 媒体持久化结果。
 */
export interface MediaPersistResult {
  provider: MediaStorageProvider;
  key?: string;
  url?: string;
}

/**
 * 开发环境日志（避免输出敏感字段）。
 */
function devLog(tag: string, data: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;
  console.log(`[media-storage] ${tag}`, JSON.stringify(data));
}

/**
 * 获取当前媒体存储提供方，默认关闭（none）。
 */
function getProvider(): MediaStorageProvider {
  const raw = process.env.MEDIA_STORAGE_PROVIDER?.trim().toLowerCase();
  if (raw === "cloudflare") return "cloudflare";
  return "none";
}

/**
 * 预留：持久化聊天生成图片。
 * 当前仅做可扩展占位，不改变现有返回链路。
 */
export async function persistGeneratedImage(
  params: PersistImageParams
): Promise<MediaPersistResult | null> {
  const provider = getProvider();
  if (provider === "none") return null;

  if (provider === "cloudflare") {
    /**
     * TODO(cloudflare):
     * 1) 下载 params.sourceUrl 图片内容
     * 2) 上传到 Cloudflare R2 / Images
     * 3) 写入 Cloudflare D1（保存 characterId/imageRef/prompt/sourceUrl/objectKey/url）
     * 4) 返回持久化后的可访问 URL
     */
    devLog("image_persist_stub", {
      provider,
      characterId: params.characterId,
      imageRef: params.imageRef,
      sourceUrlLen: params.sourceUrl.length,
      promptLen: params.prompt.length,
    });
    return { provider };
  }

  return null;
}

/**
 * 预留：持久化 TTS 语音。
 * 当前仅做可扩展占位，不改变现有返回链路。
 */
export async function persistGeneratedVoice(
  params: PersistVoiceParams
): Promise<MediaPersistResult | null> {
  const provider = getProvider();
  if (provider === "none") return null;

  if (provider === "cloudflare") {
    /**
     * TODO(cloudflare):
     * 1) 上传 params.audio 到 Cloudflare R2（建议按日期和角色分层 key）
     * 2) 写入 Cloudflare D1（保存 characterId/textHash/mimeType/bytes/objectKey/url）
     * 3) 可选：写入 KV 做短期缓存命中
     */
    devLog("voice_persist_stub", {
      provider,
      characterId: params.characterId,
      textLen: params.text.length,
      mimeType: params.mimeType,
      bytes: params.audio.length,
    });
    return { provider };
  }

  return null;
}
