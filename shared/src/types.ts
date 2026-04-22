/**
 * 服务端返回的结构化回复类型（与前端展示一致）
 */
export type ReplyType =
  | "text"
  | "voice"
  | "image"
  | "text+image"
  | "text+voice";

/**
 * 单条助手消息的载荷
 */
export interface StructuredReply {
  reply_type: ReplyType;
  /** 主文字（必有的对话主体） */
  content: string;
  /** 语音朗读文本（reply_type 含 voice 时必填） */
  voice_text?: string;
  /** 预置素材 ID 或场景 key */
  image_ref?: string;
  /** 危机关怀时附加的安全提示（可选） */
  safety_note?: string;
}

/**
 * 客户端随请求上报的会话多模态统计，供模型遵守频率约束
 */
export interface SessionModalityStats {
  /** 自上次助手语音以来的助手消息条数（不含当前将生成的一条） */
  sinceLastAssistantVoice: number;
  /** 自上次助手图片以来的助手消息条数 */
  sinceLastAssistantImage: number;
  /** 当前连续助手语音条数（上限 2） */
  consecutiveAssistantVoice: number;
  /** 本会话内助手消息总数 */
  totalAssistantMessages: number;
  /** 是否首条打招呼（可触发立绘） */
  isFirstAssistantInThread: boolean;
}
