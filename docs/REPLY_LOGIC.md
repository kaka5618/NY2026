# 回复类型决策逻辑实现说明

本文描述「虚拟男友陪伴聊天」产品中，多模态回复如何由模型决策、由服务端校验、由前端展示，以及如何与会话统计协同以贴近规格书中的频率建议。

## 1. 总体流程

1. 用户在聊天页发送文本；前端将**最近完整消息列表**（含本轮用户句）与 **SessionModalityStats** 一并 POST 至 `/api/chat`。
2. 服务端为当前角色注入 **System Prompt**（人设 + 安全与多模态规则 + 可用 `image_ref` key 列表），并附加一段「当前会话多模态统计」说明，供模型在输出 JSON 时参考。
3. 模型以 **`response_format: json_object`** 返回结构化字段：`reply_type`、`content`、`voice_text`、`image_ref`、`safety_note`（可选）。
4. 服务端使用 `normalizeStructuredReply`：**校验 `image_ref` 是否落在该角色 `imageLibrary`**；非法 key 则丢弃图片，仅保留文字（或语音），避免外链或幻觉路径。
5. 若 `reply_type` 含语音，前端在用户点击播放时请求 `/api/tts`，不在首包内阻塞整条回复（满足「首包文字先出」的体验目标；TTS 在交互时加载）。
6. 助手消息写入 **IndexedDB**；下轮请求的统计由前端根据已存助手消息的 `reply_type` **重新计算**。

## 2. `reply_type` 与 UI 映射

| reply_type | 前端展示 |
|------------|----------|
| `text` | 文本气泡 |
| `voice` | 文本气泡（`content`）+ 语音条（朗读 `voice_text`，缺省时回退为 `content`） |
| `image` | 文本 + 图片卡片（若仅有短说明亦显示文字） |
| `text+image` | 同 `image`，强调既有叙事又有画面 |
| `text+voice` | 文本 + 语音条 |

不允许三种模态在同一条消息内同时出现；该约束写在 System Prompt 中，由模型遵守。

## 3. 会话统计字段（SessionModalityStats）

由前端 `computeModalityStats` 根据**已持久化的助手消息**计算：

- `sinceLastAssistantVoice`：自上一次含语音的助手消息以来，又产生了多少条助手消息。
- `sinceLastAssistantImage`：自上一次含图片的助手消息以来的助手消息条数。
- `consecutiveAssistantVoice`：从最新助手消息往回数，连续含语音的条数（用于约束「连续语音 ≤ 2」）。
- `totalAssistantMessages`：本会话助手消息总数。
- `isFirstAssistantInThread`：当前是否即将产生该线程的**第一条**助手回复（用于首条问候时可选 `portrait` 立绘）。

这些数字**不直接硬编码替换模型输出**，而是作为提示注入，让主模型在遵守人设的前提下自行取舍，从而兼顾「紧扣用户当前句」与「频率建议」。

## 4. 内容安全与危机信号

- 通用安全边界（禁止违法、露骨色情、线下见面承诺、付费话题等）写在各角色共用的 Prompt 片段中。
- 服务端对用户输入做轻量关键词检测（如自残、轻生相关）；若命中，在请求中追加**额外 system 提示**，要求温柔回应并引导专业帮助，**不**替代心理咨询。

## 5. 上下文窗口

- 传给模型的历史消息取**最近 20 条**（user/assistant），与规格书「10–20 轮」一致，可按需改为配置项。

## 6. 扩展点

- **更严格的频率强制执行**：可在服务端解析模型 JSON 后，若违反连续语音条数或图片间隔，将 `reply_type` 降级为 `text` 并记录日志（当前版本以 Prompt + 统计提示为主，避免破坏对用户上一句的针对性）。
- **流式输出**：可在保持 JSON 完整可解析的前提下改为 SSE；前端先渲染 `content` 再补语音与图片。
- **素材库**：仅需维护 `shared/src/characters.ts` 中各角色的 `imageLibrary` 与 Prompt 中的 key 列表说明。
