/**
 * 检测用户消息是否包含心理危机相关表述（用于追加服务端约束）
 */
export function detectCrisisSignals(text: string): boolean {
  const patterns = [
    /自残/,
    /轻生/,
    /不想活/,
    /结束生命/,
    /割腕/,
    /跳楼/,
    /死了算了/,
  ];
  return patterns.some((p) => p.test(text));
}
