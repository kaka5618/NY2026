import type { SessionModalityStats } from "@vb/shared";
import type { StoredChatMessage } from "./db";

function assistantHasVoice(replyType: string | undefined): boolean {
  const rt = replyType ?? "text";
  return rt === "voice" || rt === "text+voice";
}

function assistantHasImage(replyType: string | undefined): boolean {
  const rt = replyType ?? "text";
  return rt === "image" || rt === "text+image";
}

/**
 * 根据已存储的助手消息计算多模态统计，供下轮 API 约束模型
 */
export function computeModalityStats(
  messages: StoredChatMessage[],
  isAboutToAddFirstAssistant: boolean
): SessionModalityStats {
  const assistantMsgs = messages.filter((m) => m.role === "assistant");
  const totalAssistantMessages = assistantMsgs.length;

  let sinceLastAssistantVoice = 0;
  for (let i = assistantMsgs.length - 1; i >= 0; i--) {
    const m = assistantMsgs[i]!;
    if (assistantHasVoice(m.reply_type)) break;
    sinceLastAssistantVoice++;
  }

  let sinceLastAssistantImage = 0;
  for (let i = assistantMsgs.length - 1; i >= 0; i--) {
    const m = assistantMsgs[i]!;
    if (assistantHasImage(m.reply_type)) break;
    sinceLastAssistantImage++;
  }

  let consecutiveAssistantVoice = 0;
  for (let i = assistantMsgs.length - 1; i >= 0; i--) {
    const m = assistantMsgs[i]!;
    if (assistantHasVoice(m.reply_type)) consecutiveAssistantVoice++;
    else break;
  }

  return {
    sinceLastAssistantVoice,
    sinceLastAssistantImage,
    consecutiveAssistantVoice,
    totalAssistantMessages,
    isFirstAssistantInThread: isAboutToAddFirstAssistant && totalAssistantMessages === 0,
  };
}
