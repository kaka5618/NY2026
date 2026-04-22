import {
  CHARACTERS,
  normalizeStructuredReply,
  type CharacterId,
} from "@vb/shared";
import { detectCrisisSignals } from "@/server/lib/crisis";

export interface PlaceholderReplyResult {
  reply: ReturnType<typeof normalizeStructuredReply>;
  model: string;
}

/**
 * 无方舟 Key 或显式关闭 USE_ARK_CHAT 时的本地占位回复（与 Route 原逻辑一致）
 */
export function buildPlaceholderReply(
  characterId: CharacterId,
  userMessage: string
): PlaceholderReplyResult {
  const char = CHARACTERS[characterId];
  const crisis = detectCrisisSignals(userMessage);
  const preview =
    userMessage.length > 120 ? `${userMessage.slice(0, 120)}…` : userMessage;

  const content = crisis
    ? `${char.name}在这里。你刚才说的那些，让我有点担心你。此刻最重要的是你的安全——如果可以，请尽量联系你信任的亲友，或当地的心理援助热线、专业机构。我会陪着你把这句话说完，但我没法替代真正的帮助。`
    : `【占位】${char.name}：我读到你说的是「${preview}」。未配置方舟 API 或已关闭 USE_ARK_CHAT；配置 ARK_API_KEY 后可使用真实模型。`;

  const raw = {
    reply_type: "text" as const,
    content,
    safety_note: crisis ? "若你感到难以承受，请优先寻求现实支持与专业帮助。" : undefined,
  };

  return {
    reply: normalizeStructuredReply(raw, characterId),
    model: "placeholder",
  };
}
