/**
 * 服务端返回的结构化回复类型（与前端展示一致）
 */
export type ReplyType =
  | "text"
  | "image"
  | "text+image";

/**
 * 单条助手消息的载荷
 */
export interface StructuredReply {
  reply_type: ReplyType;
  /** 主文字（必有的对话主体） */
  content: string;
  /** 预置素材 ID 或场景 key */
  image_ref?: string;
  /** 危机关怀时附加的安全提示（可选） */
  safety_note?: string;
}

/**
 * 客户端随请求上报的会话多模态统计，供模型遵守频率约束
 */
export interface SessionModalityStats {
  /** 自上次助手图片以来的助手消息条数 */
  sinceLastAssistantImage: number;
  /** 本会话内助手消息总数 */
  totalAssistantMessages: number;
  /** 是否首条打招呼（可触发立绘） */
  isFirstAssistantInThread: boolean;
}
