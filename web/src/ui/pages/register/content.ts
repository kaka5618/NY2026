/**
 * 注册页文案与 UI 文本配置。
 * 后续注册页 UI 调整优先改这里与对应 View 组件。
 */
export const registerPageContent = {
  brand: "心动日常",
  title: "注册账号",
  subtitle: "创建一个账号，保存你和他的专属陪伴时刻。（暂不验证邮箱）",
  usernameLabel: "用户名",
  usernameHint: "3–32 位字母、数字或下划线",
  passwordLabel: "密码",
  passwordHint: "至少 8 位",
  emailLabel: "邮箱",
  nicknameLabel: "昵称",
  nicknameHint: "1–32 个字符，将用于问候语",
  turnstileLabel: "人机验证",
  submitCta: "创建账号",
  submittingCta: "提交中…",
  loginHint: "已有账号？去登录",
} as const;
