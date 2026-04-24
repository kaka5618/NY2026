import type { CharacterId } from "@vb/shared";
import { getPgPool } from "@/server/db/pg-pool";

/**
 * 生图记录入库参数。
 */
export interface InsertGeneratedImageParams {
  userId?: string;
  characterId: CharacterId;
  imageRef: string;
  prompt: string;
  sourceUrl: string;
  r2Key: string;
  imageUrl: string;
}

/**
 * 将生图结果写入 `generated_images` 归档表。
 */
export async function insertGeneratedImage(params: InsertGeneratedImageParams): Promise<void> {
  const pool = getPgPool();
  await pool.query(
    `INSERT INTO generated_images (
      user_id,
      character_id,
      image_ref,
      prompt,
      source_url,
      r2_key,
      image_url
    ) VALUES (
      $1::bigint,
      (SELECT id FROM characters WHERE code = $2 AND is_active = true LIMIT 1),
      $3,
      $4,
      $5,
      $6,
      $7
    )`,
    [
      params.userId ?? null,
      params.characterId,
      params.imageRef,
      params.prompt,
      params.sourceUrl,
      params.r2Key,
      params.imageUrl,
    ]
  );
}
