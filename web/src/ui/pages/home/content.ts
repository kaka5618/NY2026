/**
 * 首页文案与 UI 文本配置。
 * 后续需要改首页文案时，优先修改这个文件。
 */
export const homePageContent = {
  brand: "Virtual Boyfriend",
  title: "虚拟男友 · 陪伴聊天",
  subtitle: "选一个让你心安的人，慢慢聊。无付费墙、无好感度，只有对话本身。",
  envHint:
    "对话：配置根目录 .env.local 中 ARK_API_KEY 后走火山方舟。语音：配置 XFYUN_APP_ID / XFYUN_API_KEY / XFYUN_API_SECRET 后可播放角色语音。USE_ARK_CHAT=false 或 USE_XFYUN_TTS=false 可分别关闭对应能力。",
  enterChatCta: "进入聊天 →",
  registerCta: "去注册页",
  footer: "聊天记录仅保存在本机浏览器。请遵守内容安全与理性使用提示。",
} as const;
