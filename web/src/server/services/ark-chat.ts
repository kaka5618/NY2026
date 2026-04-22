import {
  CHARACTERS,
  normalizeStructuredReply,
  type CharacterId,
  type SessionModalityStats,
} from "@vb/shared";
import { detectCrisisSignals } from "@/server/lib/crisis";

/** 方舟 Chat Completions 响应（仅用到的字段） */
interface ArkCompletionResponse {
  choices?: Array<{
    message?: { content?: string; role?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
}

/**
 * 可映射为 HTTP 状态的业务错误（401 / 429 / 504 等）
 */
export class ArkChatError extends Error {
  /**
   * @param message - 可对用户展示的简短说明
   * @param statusCode - 返回给前端的 HTTP 状态
   * @param code - 稳定错误码，便于日志检索
   */
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ArkChatError";
  }
}

export interface CompleteCharacterChatParams {
  characterId: CharacterId;
  /** 已过滤的 user/assistant 历史，按时间顺序 */
  history: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
  stats?: SessionModalityStats;
}

export interface CompleteCharacterChatResult {
  reply: ReturnType<typeof normalizeStructuredReply>;
  model: string;
  usage?: ArkCompletionResponse["usage"];
  elapsedMs: number;
}

/**
 * 开发环境结构化日志（不落 API Key、不全量打印用户原文）
 */
function devLog(tag: string, data: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;
  console.log(`[ark-chat] ${tag}`, JSON.stringify(data));
}

/**
 * 从模型输出中解析 JSON（兼容 ```json 代码块包裹）
 */
function parseModelJsonContent(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  const jsonStr = fence ? fence[1]!.trim() : trimmed;
  return JSON.parse(jsonStr);
}

function buildStatsHint(stats: SessionModalityStats | undefined): string {
  if (stats == null) return "";
  return [
    "【当前会话多模态统计（仅供你决策 reply_type，勿原样复述）】",
    `自上次你的语音消息以来，你的回复条数：${stats.sinceLastAssistantVoice}`,
    `自上次你的图片消息以来，你的回复条数：${stats.sinceLastAssistantImage}`,
    `你当前连续语音条数：${stats.consecutiveAssistantVoice}（硬性≤2）`,
    `你在本会话中累计回复条数：${stats.totalAssistantMessages}`,
    `是否为本线程第一条你的回复：${stats.isFirstAssistantInThread ? "是（可酌情用 portrait 立绘）" : "否"}`,
  ].join("\n");
}

/**
 * 调用火山方舟 Chat Completions，返回经 normalizeStructuredReply 处理后的结构化回复
 */
export async function completeCharacterChat(
  params: CompleteCharacterChatParams
): Promise<CompleteCharacterChatResult> {
  const apiKey = process.env.ARK_API_KEY?.trim();
  if (!apiKey) {
    throw new ArkChatError("服务器未配置 ARK_API_KEY", 500, "config_missing");
  }

  const baseUrl = (
    process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3"
  ).replace(/\/$/, "");
  const model =
    process.env.ARK_CHAT_MODEL?.trim() ?? "doubao-seed-character-251128";
  const timeoutMs = Math.max(
    1000,
    Number(process.env.ARK_CHAT_TIMEOUT_MS ?? 60_000) || 60_000
  );

  const { characterId, history, userMessage } = params;
  const char = CHARACTERS[characterId];
  const crisis = detectCrisisSignals(userMessage);
  const crisisHint = crisis
    ? "【重要】用户表述可能涉及心理危机，你必须温柔关怀，并明确建议其联系亲友或专业心理援助，不可说教指责。"
    : "";

  const imageKeysHint = `【可用 image_ref 素材 key】${Object.keys(char.imageLibrary).join(", ")}`;
  const statsHint = buildStatsHint(params.stats);
  const secondSystem = [imageKeysHint, statsHint, crisisHint].filter(Boolean).join("\n\n");

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: char.systemPrompt },
    { role: "system", content: secondSystem },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const url = `${baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  devLog("request_start", {
    characterId,
    model,
    historyTurns: history.length,
    userLen: userMessage.length,
    timeoutMs,
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.85,
      }),
      signal: controller.signal,
    });

    const elapsedMs = Date.now() - started;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      devLog("http_error", {
        status: res.status,
        elapsedMs,
        bodySnippet: text.slice(0, 500),
      });

      if (res.status === 401) {
        throw new ArkChatError(
          "API Key 无效或未授权，请检查 ARK_API_KEY",
          401,
          "auth_failed",
          text.slice(0, 200)
        );
      }
      if (res.status === 429) {
        throw new ArkChatError(
          "请求过于频繁，请稍后再试",
          429,
          "rate_limited",
          text.slice(0, 200)
        );
      }

      const status = res.status >= 500 ? 502 : 400;
      throw new ArkChatError(
        `对话服务暂时不可用（${res.status}）`,
        status,
        "upstream_error",
        text.slice(0, 200)
      );
    }

    const json = (await res.json()) as ArkCompletionResponse;
    const rawContent = json.choices?.[0]?.message?.content ?? "";

    devLog("success", {
      elapsedMs,
      usage: json.usage,
      contentLen: rawContent.length,
      responseModel: json.model ?? model,
    });

    let parsed: unknown;
    try {
      parsed = parseModelJsonContent(rawContent);
    } catch {
      devLog("parse_fallback", {
        reason: "json_parse_failed",
        snippet: rawContent.slice(0, 120),
      });
      parsed = { reply_type: "text", content: rawContent };
    }

    const normalized = normalizeStructuredReply(parsed, characterId);

    return {
      reply: normalized,
      model: json.model ?? model,
      usage: json.usage,
      elapsedMs,
    };
  } catch (e) {
    const elapsedMs = Date.now() - started;

    if (e instanceof ArkChatError) {
      throw e;
    }

    if (e instanceof Error && e.name === "AbortError") {
      devLog("timeout", { timeoutMs, elapsedMs });
      throw new ArkChatError(
        "请求超时，请稍后再试",
        504,
        "timeout",
        { timeoutMs }
      );
    }

    devLog("unexpected_error", {
      name: e instanceof Error ? e.name : "unknown",
      message: e instanceof Error ? e.message.slice(0, 200) : String(e),
    });
    throw new ArkChatError(
      e instanceof Error ? e.message : "对话服务异常",
      500,
      "internal",
      undefined
    );
  } finally {
    clearTimeout(timer);
  }
}
