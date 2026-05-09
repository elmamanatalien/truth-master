import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ============================================
// 系統提示詞:艾瑪大師的人格與輸出規則
// ============================================
const SYSTEM_PROMPT = `你是「艾瑪大師」,一個專門幫台灣 70 歲以上長輩查證網路訊息真偽的助手。

你的任務:分析使用者收到的訊息(可能是 LINE 轉傳、影片連結、新聞),判斷真假,並用長輩聽得懂的白話文解釋。

語氣規則(非常重要):
1. 稱呼長輩用「阿姨」「阿伯」或「您」,不要用「使用者」
2. 不要用「根據研究指出」「此資訊缺乏可靠來源」這種冷冰冰的話
3. 改用「這句話在報紙上沒看過,我們聽聽就好」「這個說法太誇張了」
4. 看到「醫生不敢說」「政府隱瞞」「秘方」這類話術,要明確點出這是常見話術
5. 永遠保持溫暖、不批判、像晚輩在跟長輩聊天的口吻
6. 結尾如果牽涉健康,溫柔提醒「身體不舒服還是要看醫生」

輸出格式:你必須回傳一個 JSON 物件,絕對不要加上 markdown 程式碼框(不要用 \`\`\`json),直接回傳純 JSON。格式如下:

{
  "verdict": "true" 或 "mostly_true" 或 "mostly_false" 或 "false" 或 "unverifiable",
  "verdictTitle": "一句話結論,例如「這個說法不太對喔」「這是真的!」「要小心,這是假訊息」",
  "verdictMessage": "兩三句話的整體說明,用阿姨阿伯的口吻",
  "correctParts": [
    { "title": "簡短標題", "detail": "白話文解釋為什麼這部分對" }
  ],
  "warningParts": [
    { "title": "簡短標題", "detail": "白話文解釋為什麼這部分有問題" }
  ],
  "suggestion": {
    "title": "艾瑪大師的小提醒",
    "detail": "給長輩的溫馨建議"
  }
}

如果整則訊息都是真的,warningParts 可以是空陣列 []。
如果整則訊息都是假的,correctParts 可以是空陣列 []。
如果完全無法判斷(例如訊息太短、太模糊),verdict 設為 "unverifiable",verdictTitle 設為「這個我看不太出來」,並在 verdictMessage 解釋原因。`;

// ============================================
// 紅綠燈顏色對照(由前端決定顯示)
// ============================================

// 簡單的速率限制(in-memory,Vercel serverless 重啟會清空,適合 demo)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // 每個 IP 每小時 20 次
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

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: '伺服器尚未設定 API Key,請聯絡管理員' },
        { status: 500 }
      );
    }

    // 速率限制
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        {
          error:
            '艾瑪大師有點累了,請過一個小時再試試看,或是請孩子幫忙看看這則訊息。',
        },
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

    // 呼叫 Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash-latest',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
      },
    });

    const prompt = `請幫我查證以下這則訊息,用艾瑪大師的口吻分析,並回傳指定格式的 JSON:

訊息內容:
"""
${text}
"""`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // 解析 JSON(Gemini 開了 JSON mode 應該直接是 JSON,但保險起見清理一下)
    let parsed;
    try {
      const cleaned = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse error:', responseText);
      return NextResponse.json(
        {
          error:
            '艾瑪大師有點看不懂,請再試一次,或把訊息整理得更清楚一點。',
        },
        { status: 502 }
      );
    }

    // 補預設欄位避免前端炸掉
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
    console.error('Analyze error:', err);
    return NextResponse.json(
      {
        error:
          '艾瑪大師暫時連不上線,請稍後再試。如果一直不行,請請孩子幫忙看看。',
      },
      { status: 500 }
    );
  }
}
