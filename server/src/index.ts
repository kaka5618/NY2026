import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const serverRoot = resolve(__dirname, "..");

/**
 * 优先读取仓库根目录 `.env.local`（不提交），其次兼容 `server/.env`；后者不覆盖前者已存在的键。
 */
loadEnv({ path: resolve(repoRoot, ".env.local") });
loadEnv({ path: resolve(serverRoot, ".env") });
import express from "express";
import OpenAI from "openai";
import {
  CHARACTERS,
  listPublicCharacters,
  normalizeStructuredReply,
  type CharacterId,
} from "@vb/shared";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT) || 8787;
const MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 OPENAI_API_KEY，请在仓库根目录 .env.local 或 server/.env 中配置");
  }
  const baseURL = process.env.OPENAI_BASE_URL;
  return new OpenAI({ apiKey, baseURL: baseURL || undefined });
}

/**
 * 检测用户消息是否包含心理危机信号，用于追加服务端约束
 */
function detectCrisisSignals(text: string): boolean {
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/characters", (_req, res) => {
  res.json({ characters: listPublicCharacters() });
});

interface ChatBody {
  characterId: CharacterId;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  userMessage: string;
  stats?: {
    sinceLastAssistantVoice: number;
    sinceLastAssistantImage: number;
    consecutiveAssistantVoice: number;
    totalAssistantMessages: number;
    isFirstAssistantInThread: boolean;
  };
}

app.post("/api/chat", async (req, res) => {
  try {
    const body = req.body as ChatBody;
    const characterId = body.characterId;
    if (!characterId || !CHARACTERS[characterId]) {
      res.status(400).json({ error: "无效角色" });
      return;
    }
    const char = CHARACTERS[characterId];
    const userMessage = String(body.userMessage ?? "").trim();
    if (!userMessage) {
      res.status(400).json({ error: "消息不能为空" });
      return;
    }

    const history = (body.messages ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    const stats = body.stats;
    const statsHint =
      stats != null
        ? [
            "【当前会话多模态统计（仅供你决策 reply_type，勿原样复述）】",
            `自上次你的语音消息以来，你的回复条数：${stats.sinceLastAssistantVoice}`,
            `自上次你的图片消息以来，你的回复条数：${stats.sinceLastAssistantImage}`,
            `你当前连续语音条数：${stats.consecutiveAssistantVoice}（硬性≤2）`,
            `你在本会话中累计回复条数：${stats.totalAssistantMessages}`,
            `是否为本线程第一条你的回复：${stats.isFirstAssistantInThread ? "是（可酌情用 portrait 立绘）" : "否"}`,
          ].join("\n")
        : "";

    const crisis = detectCrisisSignals(userMessage);
    const crisisHint = crisis
      ? "【重要】用户表述可能涉及心理危机，你必须温柔关怀，并明确建议其联系亲友或专业心理援助，不可说教指责。"
      : "";

    const imageKeysHint = `【可用 image_ref 素材 key】${Object.keys(char.imageLibrary).join(", ")}`;

    const openai = getClient();

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.85,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: char.systemPrompt },
        {
          role: "system",
          content: [imageKeysHint, statsHint, crisisHint].filter(Boolean).join("\n\n"),
        },
        ...history,
        { role: "user", content: userMessage },
      ],
    });

    const rawText = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { reply_type: "text", content: rawText };
    }

    const normalized = normalizeStructuredReply(parsed, characterId);

    res.json({
      reply: normalized,
      characterId,
      model: MODEL,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "服务器错误";
    console.error(e);
    res.status(500).json({ error: msg });
  }
});

interface TtsBody {
  characterId: CharacterId;
  text: string;
}

app.post("/api/tts", async (req, res) => {
  try {
    const { characterId, text } = req.body as TtsBody;
    if (!characterId || !CHARACTERS[characterId]) {
      res.status(400).json({ error: "无效角色" });
      return;
    }
    const t = String(text ?? "").trim();
    if (!t) {
      res.status(400).json({ error: "文本为空" });
      return;
    }
    const openai = getClient();
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: CHARACTERS[characterId].ttsVoice,
      input: t.slice(0, 1200),
    });
    const buf = Buffer.from(await mp3.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "TTS 失败";
    console.error(e);
    res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`API 监听 http://127.0.0.1:${PORT}`);
});
