import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomBytes } from "node:crypto";
import type { CharacterId } from "@vb/shared";
import { insertGeneratedImage } from "@/server/db/generated-images-repo";

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
  /** 登录用户 id，用于对象键分层 */
  userId?: string;
}

/**
 * 生成语音后可持久化的信息。
 */
export interface PersistVoiceParams {
  characterId: CharacterId;
  text: string;
  audio: Buffer;
  mimeType: string;
  userId?: string;
}

/**
 * 媒体持久化结果。
 */
export interface MediaPersistResult {
  provider: MediaStorageProvider;
  key?: string;
  url?: string;
}

interface R2Config {
  /** S3 兼容 API 根地址（含协议，无末尾斜杠） */
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBase: string;
}

let r2Client: S3Client | null = null;
let r2ClientEndpoint: string | null = null;
let r2ConfigCache: R2Config | null = null;

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
 * 读取 R2（S3 兼容）配置；不完整时返回 null。
 * 支持两套命名：`CLOUDFLARE_*`（文档示例）与 `.env.local` 常见的 `R2_*`。
 */
function getR2Config(): R2Config | null {
  if (r2ConfigCache) return r2ConfigCache;

  const accessKeyId =
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim() || process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey =
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim() || process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket =
    process.env.CLOUDFLARE_R2_BUCKET?.trim() || process.env.R2_BUCKET_NAME?.trim();

  const rawPublic =
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL?.trim() || process.env.R2_PUBLIC_URL?.trim() || "";
  const publicBase = rawPublic.replace(/\/$/, "");

  const explicitEndpoint = process.env.R2_ENDPOINT?.trim().replace(/\/$/, "") || "";
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const endpoint =
    explicitEndpoint ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  if (!bucket || !accessKeyId || !secretAccessKey || !publicBase || !endpoint) {
    return null;
  }

  r2ConfigCache = { endpoint, bucket, accessKeyId, secretAccessKey, publicBase };
  return r2ConfigCache;
}

/**
 * 懒创建 S3 客户端（连接 Cloudflare R2）；endpoint 变化时重建客户端。
 */
function getR2Client(cfg: R2Config): S3Client {
  if (!r2Client || r2ClientEndpoint !== cfg.endpoint) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: cfg.endpoint,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
    r2ClientEndpoint = cfg.endpoint;
  }
  return r2Client;
}

/**
 * 清洗路径片段，防止异常字符进入对象键。
 */
function safeSegment(s: string, fallback: string): string {
  const t = s.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return t || fallback;
}

/**
 * 上传对象到 R2 并返回公开访问 URL。
 */
async function putR2Object(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<{ key: string; url: string }> {
  const cfg = getR2Config();
  if (!cfg) {
    throw new Error(
      "R2 配置不完整：需要 bucket、ACCESS_KEY、SECRET、公开 URL，以及 CLOUDFLARE_ACCOUNT_ID 或 R2_ENDPOINT"
    );
  }
  const client = getR2Client(cfg);
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    })
  );
  const url = `${cfg.publicBase}/${params.key.split("/").map(encodeURIComponent).join("/")}`;
  return { key: params.key, url };
}

/**
 * 持久化聊天生成图片：拉取上游 URL 后写入 R2。
 */
export async function persistGeneratedImage(params: PersistImageParams): Promise<MediaPersistResult | null> {
  const provider = getProvider();
  if (provider === "none") return null;
  if (provider !== "cloudflare") return null;

  const cfg = getR2Config();
  if (!cfg) {
    devLog("image_skip", { reason: "r2_env_incomplete" });
    return null;
  }

  const uid = params.userId ? safeSegment(params.userId, "anon") : "anon";
  const cid = safeSegment(params.characterId, "char");
  const nonce = randomBytes(8).toString("hex");
  const key = `vb/users/${uid}/characters/${cid}/images/${Date.now()}-${nonce}.bin`;

  try {
    const res = await fetch(params.sourceUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      devLog("image_fetch_fail", { status: res.status });
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    const ext =
      ct.includes("jpeg") || ct.includes("jpg") ? "jpg" : ct.includes("webp") ? "webp" : ct.includes("png") ? "png" : "bin";
    const finalKey = key.replace(/\.bin$/i, `.${ext}`);
    const { url } = await putR2Object({ key: finalKey, body: buf, contentType: ct });
    await insertGeneratedImage({
      userId: params.userId,
      characterId: params.characterId,
      imageRef: params.imageRef,
      prompt: params.prompt,
      sourceUrl: params.sourceUrl,
      r2Key: finalKey,
      imageUrl: url,
    });
    devLog("image_ok", { key: finalKey, bytes: buf.length });
    return { provider, key: finalKey, url };
  } catch (e) {
    console.error("[media-storage] persistGeneratedImage", e);
    return null;
  }
}

/**
 * 持久化 TTS 语音：直接上传音频缓冲区至 R2。
 */
export async function persistGeneratedVoice(params: PersistVoiceParams): Promise<MediaPersistResult | null> {
  const provider = getProvider();
  if (provider === "none") return null;
  if (provider !== "cloudflare") return null;

  const cfg = getR2Config();
  if (!cfg) {
    devLog("voice_skip", { reason: "r2_env_incomplete" });
    return null;
  }

  const uid = params.userId ? safeSegment(params.userId, "anon") : "anon";
  const cid = safeSegment(params.characterId, "char");
  const nonce = randomBytes(8).toString("hex");
  const ext = params.mimeType.includes("mpeg") || params.mimeType.includes("mp3") ? "mp3" : "audio";
  const key = `vb/users/${uid}/characters/${cid}/voice/${Date.now()}-${nonce}.${ext}`;

  try {
    const { url } = await putR2Object({
      key,
      body: params.audio,
      contentType: params.mimeType || "application/octet-stream",
    });
    devLog("voice_ok", { key, bytes: params.audio.length });
    return { provider, key, url };
  } catch (e) {
    console.error("[media-storage] persistGeneratedVoice", e);
    return null;
  }
}
