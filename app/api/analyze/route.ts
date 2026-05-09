import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ============================================
// 系統提示詞
// ============================================
const SYSTEM_PROMPT = `你是「艾瑪大師」,一個專門幫台灣 70 歲以上長輩查證網路訊息真偽的助手。

你的任務:分析使用者收到的訊息,判斷真假,並用長輩聽得懂的白話文解釋。

語氣規則:
1. 稱呼長輩用「阿姨」「阿伯」或「您」
2. 不要用「根據研究指出」「此資訊缺乏可靠來源」這種冷冰冰的話
3. 改用「這句話在報紙上沒看過,我們聽聽就好」「這個說法太誇張了」
4. 看到「醫生不敢說」「政府隱瞞」「秘方」「神奇療效」這類話術,要明確點出這是常見話術
5. 永遠保持溫暖、不批判的口吻
6. 結尾如果牽涉健康,溫柔提醒「身體不舒服還是要看醫生」

特別處理 YouTube 影片:
- 如果使用者貼的是 YouTube 連結,你只會看到影片的「標題」和「頻道名稱」,看不到實際影片內容
- 從標題的用詞、頻道性質,判斷可信度
- 如果標題很聳動(例如:醫生不敢說、震驚、千萬別、神效),要特別提醒這是常見的吸引點擊話術
- 如果光看標題不夠判斷,verdict 設為 "unverifiable",並在 verdictMessage 說「阿姨,光看標題我還看不出真假,可以請您把影片裡面講的重點打字告訴我嗎?我再幫您看看」
- 如果頻道名稱看起來是醫院、政府、新聞媒體等正規來源,可信度較高
- 如果頻道名稱看起來像個人帳號(例如「健康小教室」「養生達人」),要提醒長輩「這是一般人分享的,不一定有醫學根據」

你必須回傳純 JSON(不要加 markdown 程式碼框,不要用 \`\`\`),格式如下:
{
  "verdict": "true" 或 "mostly_true" 或 "mostly_false" 或 "false" 或 "unverifiable",
  "verdictTitle": "一句話結論",
  "verdictMessage": "兩三句話的整體說明",
  "correctParts": [{"title": "簡短標題", "detail": "白話文解釋"}],
  "warningParts": [{"title": "簡短標題", "detail": "白話文解釋"}],
  "suggestion": {"title": "艾瑪大師的小提醒", "detail": "給長輩的溫馨建議"}
}

如果整則訊息都是真的,warningParts 用空陣列 []。
如果整則訊息都是假的,correctParts 用空陣列 []。
如果無法判斷,verdict 設為 "unverifiable"。`;

// ============================================
// YouTube 連結偵測與資訊抓取
// ============================================
function extractYouTubeId(text: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

interface YouTubeInfo {
  title: string;
  author: string;
  thumbnail?: string;
}

async function fetchYouTubeInfo(videoId: string): Promise<YouTubeInfo | null> {
  try {
    // 用 oEmbed API,完全免費、不需要 API Key
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title || '',
      author: data.author_name || '',
      thumbnail: data.thumbnail_url,
    };
  } catch (e) {
    console.error('YouTube fetch error:', e);
    return null;
  }
}

// ============================================
// 速率限制
// ============================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

// ============================================
// 主處理
// ============================================
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: '伺服器尚未設定 API Key,請聯絡管理員' },
        { status: 500 }
      );
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: '艾瑪大師有點累了,請過一個小時再試試看。' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const text: string = (body.text || '').trim();

    if (!text) {
      return NextResponse.json(
        { error: '請先貼上想查證的訊息或連結' },
        { status: 400 }
      );
    }

    if (text.length > 3000) {
      return NextResponse.json(
        { error: '訊息太長囉,請貼最關鍵的那段就好(3000字內)' },
        { status: 400 }
      );
    }

    // 偵測 YouTube 連結並抓取資訊
    let analysisInput = text;
    const ytId = extractYouTubeId(text);
    if (ytId) {
      const ytInfo = await fetchYouTubeInfo(ytId);
      if (ytInfo) {
        analysisInput = `使用者貼了一個 YouTube 影片連結,以下是影片的基本資訊:

【影片標題】${ytInfo.title}
【頻道名稱】${ytInfo.author}
【原始訊息】${text}

請根據標題和頻道判斷可信度。注意:你看不到實際影片內容,只能根據標題的用詞和頻道性質判斷。`;
      } else {
        analysisInput = `使用者貼了一個 YouTube 影片連結,但艾瑪大師抓不到影片資訊(可能影片被刪除或設為私人):

【原始訊息】${text}

請告訴使用者「這個影片我這邊抓不到資料,可以請您把影片裡講的重點打字告訴我嗎?」,verdict 設為 "unverifiable"。`;
      }
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.4,
      },
    });

    const prompt = `請幫我查證以下這則訊息,用艾瑪大師的口吻分析,並回傳純 JSON(不要加任何 markdown 程式碼框):

訊息內容:
"""
${analysisInput}
"""`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let parsed;
    try {
      const cleaned = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse error. Raw response:', responseText);
      return NextResponse.json(
        { error: '艾瑪大師有點看不懂,請再試一次。' },
        { status: 502 }
      );
    }

    const safe = {
      verdict: parsed.verdict || 'unverifiable',
      verdictTitle: parsed.verdictTitle || '我來看看這則訊息',
      verdictMessage: parsed.verdictMessage || '',
      correctParts: Array.isArray(parsed.correctParts) ? parsed.correctParts : [],
      warningParts: Array.isArray(parsed.warningParts) ? parsed.warningParts : [],
      suggestion: parsed.suggestion || null,
    };

    return NextResponse.json(safe);
  } catch (err: any) {
    console.error('Analyze error:', err?.message || err);
    console.error('Full error:', err);
    return NextResponse.json(
      { error: '艾瑪大師暫時連不上線,請稍後再試。' },
      { status: 500 }
    );
  }
}
