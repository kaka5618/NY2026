import { CHARACTERS, type CharacterId } from "@vb/shared";

/**
 * 生图统一风格锚点，保证不同角色和场景输出风格一致
 */
const STYLE_SUFFIX =
  "中国都市恋爱陪伴向半写实剧照风，男性青年主角，自然肤色与柔和肤质，电影感自然光，浅景深，画面干净高级，温柔浪漫氛围，构图留出聊天界面安全边距，避免夸张二次元比例，避免科幻机甲赛博朋克，避免血腥恐怖，避免画面内出现任何文字或水印字样";

const SHENYU_PROMPTS: Record<string, string> = {
  portrait:
    "28岁东亚男性，大学文学系青年讲师气质，黑短发，米白针织开衫叠穿白衬衫，半身肖像，书房窗边柔光，背后书架与茶具虚化，温柔平静",
  tea: "青瓷盖碗与茶杯，木茶盘与书页，窗边柔光，静谧治愈",
  bookstore: "旧书店高书架夹道，木地板与台灯暖光，文艺胶片感",
  rain_window: "雨天窗玻璃水珠，室内暖灯倒影，安静陪伴氛围",
  desk_poetry: "书桌俯拍，钢笔信纸与绿植，台灯暖光，文学氛围",
};

const LUSHIYAN_PROMPTS: Record<string, string> = {
  portrait:
    "30岁东亚男性，成熟克制气质，清爽短发，深灰西装外套叠白衬衫，半身商务肖像，高层办公室夜景虚化，冷暖对比光",
  office_night: "深夜办公室空镜，双显示器冷蓝光，咖啡杯与记事本，城市夜景虚化",
  gym: "健身房镜面与器械区，冷色顶光，力量感但克制",
  cooking: "开放式厨房做饭中景，锅中热气，台面整洁，生活感强",
  city_window: "高层落地窗前城市夜景，室内暖灯与外景冷色对比",
};

const JIANGYUBAI_PROMPTS: Record<string, string> = {
  portrait:
    "22岁东亚男性，音乐学院学生与乐队主唱气质，少年感清爽，牛仔外套或乐队T恤，半身像，livehouse门外霓虹虚化，笑容明亮",
  livehouse: "livehouse演出现场，麦克风与吉他局部特写，追光与彩色灯斑",
  motorcycle_night: "城市夜景道路与摩托车金属反光，青春夜骑氛围",
  street_food: "夜市小吃摊暖光，蒸汽升腾与街头烟火气",
  guitar: "排练室原木吉他与按弦手部特写，音乐创作感",
};

const HUOYANCHEN_PROMPTS: Record<string, string> = {
  portrait:
    "32岁东亚男性，家族企业继承人气质，深色定制西装，半身肖像，挑高客厅背景虚化，琥珀与墨色对比光，眼神笃定",
  wine: "醒酒器与高脚杯静物，大理石台面，暗金侧光，高级克制",
  watch: "古董机械腕表静物，丝绒衬底，精致细节特写",
  horse: "户外马场下午阳光，骏马与围栏，优雅运动感",
  penthouse_view: "顶层落地窗城市天际线，室内暖光与远景层次分明",
};

const PROMPT_MAP: Record<CharacterId, Record<string, string>> = {
  shenyu: SHENYU_PROMPTS,
  lushiyan: LUSHIYAN_PROMPTS,
  jiangyubai: JIANGYUBAI_PROMPTS,
  huoyanchen: HUOYANCHEN_PROMPTS,
};

/**
 * 清洗文本，避免控制字符污染提示词
 */
function sanitizeSegment(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

/**
 * 构建角色图片生成提示词
 */
export function buildCharacterImagePrompt(params: {
  characterId: CharacterId;
  imageRef: string;
  userMessage: string;
  assistantContent: string;
}): string {
  const { characterId, imageRef, userMessage, assistantContent } = params;
  const character = CHARACTERS[characterId];
  const scenePrompt = PROMPT_MAP[characterId][imageRef] ?? `${character.name}生活场景写真`;
  const userHint = sanitizeSegment(userMessage);
  const replyHint = sanitizeSegment(assistantContent);

  return [
    `${character.name}，${character.role}，${character.personalityTag}`,
    scenePrompt,
    userHint ? `结合用户当前语境：${userHint}` : "",
    replyHint ? `画面情绪参考回复语气：${replyHint}` : "",
    STYLE_SUFFIX,
  ]
    .filter(Boolean)
    .join("，");
}
