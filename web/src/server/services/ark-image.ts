/**
 * 方舟文生图请求体（仅保留本项目需要的字段）
 */
export interface ArkImageGenerationInput {
  model?: string;
  prompt: string;
  sequential_image_generation?: "disabled" | "enabled";
  response_format?: "url" | "b64_json";
  size?: string;
  stream?: boolean;
  watermark?: boolean;
}

/**
 * 方舟文生图单张图片结果
 */
export interface ArkImageGenerationDataItem {
  url?: string;
  b64_json?: string;
  size?: string;
}

/**
 * 方舟文生图响应结构（仅保留本项目消费字段）
 */
export interface ArkImageGenerationResponse {
  model?: string;
  created?: number;
  data?: ArkImageGenerationDataItem[];
  usage?: {
    generated_images?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * 可映射为 HTTP 状态码的文生图业务错误
 */
export class ArkImageError extends Error {
  /**
   * @param message 对前端可展示的错误文案
   * @param statusCode 建议返回给前端的 HTTP 状态码
   * @param code 稳定错误码，便于日志检索
   * @param details 可选调试信息（勿包含密钥）
   */
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ArkImageError";
  }
}

/**
 * 开发环境日志（不输出密钥）
 */
function devLog(tag: string, data: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;
  console.log(`[ark-image] ${tag}`, JSON.stringify(data));
}

/**
 * 清洗提示词，避免控制字符导致上游解析失败
 */
function sanitizePrompt(prompt: string): string {
  return prompt
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

/**
 * 调用火山方舟 Images Generations API，返回统一结构化结果
 */
export async function generateArkImage(
  input: ArkImageGenerationInput
): Promise<ArkImageGenerationResponse> {
  const apiKey = process.env.ARK_API_KEY?.trim();
  if (!apiKey) {
    throw new ArkImageError("服务器未配置 ARK_API_KEY", 500, "config_missing");
  }

  const prompt = sanitizePrompt(input.prompt);
  if (!prompt) {
    throw new ArkImageError("prompt 不能为空", 400, "invalid_prompt");
  }

  const baseUrl = (
    process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3"
  ).replace(/\/$/, "");
  const model =
    input.model?.trim() ||
    process.env.ARK_IMAGE_MODEL?.trim() ||
    "doubao-seedream-4-0-250828";
  const timeoutMs = Math.max(
    1000,
    Number(process.env.ARK_IMAGE_TIMEOUT_MS ?? 45_000) || 45_000
  );

  const requestBody: ArkImageGenerationInput = {
    model,
    prompt,
    sequential_image_generation:
      input.sequential_image_generation ?? "disabled",
    response_format: input.response_format ?? "url",
    size: input.size ?? "2K",
    stream: input.stream ?? false,
    watermark: input.watermark ?? true,
  };

  const url = `${baseUrl}/images/generations`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  devLog("request_start", {
    model,
    promptLen: prompt.length,
    response_format: requestBody.response_format,
    size: requestBody.size,
    timeoutMs,
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    const elapsedMs = Date.now() - started;
    const requestId =
      res.headers.get("x-request-id") ??
      res.headers.get("x-tt-logid") ??
      undefined;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      devLog("http_error", {
        status: res.status,
        elapsedMs,
        requestId,
        bodySnippet: text.slice(0, 400),
      });

      if (res.status === 401) {
        throw new ArkImageError(
          "API Key 无效或未授权，请检查 ARK_API_KEY",
          401,
          "auth_failed",
          { requestId }
        );
      }
      if (res.status === 429) {
        throw new ArkImageError(
          "请求过于频繁，请稍后重试",
          429,
          "rate_limited",
          { requestId }
        );
      }
      throw new ArkImageError(
        `图片生成服务暂时不可用（${res.status}）`,
        res.status >= 500 ? 502 : 400,
        "upstream_error",
        { requestId }
      );
    }

    const json = (await res.json()) as ArkImageGenerationResponse;
    const imageCount = json.data?.length ?? 0;
    devLog("success", {
      elapsedMs,
      requestId,
      model: json.model ?? model,
      generatedImages: imageCount,
      usage: json.usage,
    });

    if (imageCount === 0) {
      throw new ArkImageError("上游返回了空图片结果", 502, "empty_data", {
        requestId,
      });
    }

    return json;
  } catch (e) {
    const elapsedMs = Date.now() - started;

    if (e instanceof ArkImageError) throw e;

    if (e instanceof Error && e.name === "AbortError") {
      devLog("timeout", { timeoutMs, elapsedMs });
      throw new ArkImageError("图片生成请求超时，请稍后再试", 504, "timeout");
    }

    devLog("unexpected_error", {
      elapsedMs,
      name: e instanceof Error ? e.name : "unknown",
      message: e instanceof Error ? e.message.slice(0, 200) : String(e),
    });
    throw new ArkImageError(
      e instanceof Error ? e.message : "图片生成服务异常",
      500,
      "internal"
    );
  } finally {
    clearTimeout(timer);
  }
}
