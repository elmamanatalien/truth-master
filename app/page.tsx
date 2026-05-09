'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Search,
  CheckCircle2,
  AlertTriangle,
  Share2,
  RotateCcw,
  Newspaper,
  Heart,
  XCircle,
  HelpCircle,
} from 'lucide-react';

// ============================================
// 型別
// ============================================
type Verdict = 'true' | 'mostly_true' | 'mostly_false' | 'false' | 'unverifiable';

interface AnalysisPart {
  title: string;
  detail: string;
}

interface AnalysisResult {
  verdict: Verdict;
  verdictTitle: string;
  verdictMessage: string;
  correctParts: AnalysisPart[];
  warningParts: AnalysisPart[];
  suggestion: { title: string; detail: string } | null;
}

// ============================================
// 顏色與紅綠燈對照
// ============================================
const APPLE_GREEN = '#7CB342';
const TRUST_BLUE = '#2E7BC4';
const SOFT_GREEN = '#E8F5E9';
const SOFT_BLUE = '#E3F2FD';
const WARM_ORANGE = '#FB8C00';
const SOFT_ORANGE = '#FFF3E0';
const RED_LIGHT = '#E53935';
const GRAY_LIGHT = '#9E9E9E';

function getVerdictStyle(v: Verdict) {
  switch (v) {
    case 'true':
      return {
        color: APPLE_GREEN,
        bg: SOFT_GREEN,
        border: APPLE_GREEN,
        light: '#C8E6C9',
        Icon: CheckCircle2,
        light1: APPLE_GREEN,
        light2: '#E0E0E0',
        light3: '#E0E0E0',
      };
    case 'mostly_true':
      return {
        color: APPLE_GREEN,
        bg: SOFT_GREEN,
        border: APPLE_GREEN,
        light: '#C8E6C9',
        Icon: CheckCircle2,
        light1: APPLE_GREEN,
        light2: '#FFE082',
        light3: '#E0E0E0',
      };
    case 'mostly_false':
      return {
        color: WARM_ORANGE,
        bg: SOFT_ORANGE,
        border: WARM_ORANGE,
        light: '#FFCC80',
        Icon: AlertTriangle,
        light1: '#E0E0E0',
        light2: WARM_ORANGE,
        light3: '#E0E0E0',
      };
    case 'false':
      return {
        color: RED_LIGHT,
        bg: '#FFEBEE',
        border: RED_LIGHT,
        light: '#FFCDD2',
        Icon: XCircle,
        light1: '#E0E0E0',
        light2: '#E0E0E0',
        light3: RED_LIGHT,
      };
    default:
      return {
        color: GRAY_LIGHT,
        bg: '#F5F5F5',
        border: GRAY_LIGHT,
        light: '#E0E0E0',
        Icon: HelpCircle,
        light1: '#E0E0E0',
        light2: '#E0E0E0',
        light3: '#E0E0E0',
      };
  }
}

// ============================================
// 主元件
// ============================================
export default function TruthMaster() {
  const [inputText, setInputText] = useState('');
  const [stage, setStage] = useState<'input' | 'loading' | 'result' | 'error'>('input');
  const [isListening, setIsListening] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ============================================
  // 初始化:檢查瀏覽器是否支援語音辨識
  // ============================================
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceSupported(false);
    }
  }, []);

  // ============================================
  // 觸覺 + 聲音回饋
  // ============================================
  const giveFeedback = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([80, 40, 80]);
    }
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 600;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      /* ignore */
    }
  };

  // ============================================
  // 語音輸入(真實 Web Speech API)
  // ============================================
  const handleVoiceInput = () => {
    giveFeedback();
    if (!voiceSupported) {
      alert(
        '抱歉,您的瀏覽器不支援語音輸入。\n建議使用 Chrome 或 Safari 開啟。'
      );
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'zh-TW';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onstart = () => setIsListening(true);
    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === 'no-speech') {
        alert('沒有聽到您說話,請再試一次。');
      } else if (event.error === 'not-allowed') {
        alert('請允許網頁使用麥克風,才能使用語音輸入喔。');
      } else if (event.error !== 'aborted') {
        alert('語音輸入發生問題,請改用打字或再試一次。');
      }
    };
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      setInputText((prev) => {
        // 把 interim 顯示出來,但只保留 final 部分
        return (finalTranscript || interim).trim();
      });
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  // ============================================
  // 呼叫真正的 API
  // ============================================
  const handleAnalyze = async () => {
    giveFeedback();
    const text = inputText.trim();
    if (!text) {
      alert('請先貼上想查證的訊息,或按麥克風用講的。');
      textareaRef.current?.focus();
      return;
    }

    setStage('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || '艾瑪大師暫時不舒服,請等一下再試。');
        setStage('error');
        return;
      }
      setResult(data);
      setStage('result');
    } catch (e) {
      setErrorMsg('網路好像有點問題,請確認網路連線後再試。');
      setStage('error');
    }
  };

  const handleReset = () => {
    giveFeedback();
    setInputText('');
    setResult(null);
    setErrorMsg('');
    setStage('input');
  };

  // ============================================
  // 產生分享用 Markdown
  // ============================================
  const generateMarkdown = () => {
    if (!result) return '';
    const lines: string[] = [];
    lines.push('# 真假大師 — 查證結果\n');
    lines.push(`> **原始訊息**:\n> ${inputText}\n`);
    lines.push(`## 結論:${result.verdictTitle}\n`);
    if (result.verdictMessage) lines.push(`${result.verdictMessage}\n`);

    if (result.correctParts.length > 0) {
      lines.push(`## ✅ 正確的地方\n`);
      result.correctParts.forEach((p) => {
        lines.push(`- **${p.title}**\n  ${p.detail}\n`);
      });
    }
    if (result.warningParts.length > 0) {
      lines.push(`## ⚠️ 要小心的部分\n`);
      result.warningParts.forEach((p) => {
        lines.push(`- **${p.title}**\n  ${p.detail}\n`);
      });
    }
    if (result.suggestion) {
      lines.push(`## 💚 ${result.suggestion.title}\n`);
      lines.push(`${result.suggestion.detail}\n`);
    }
    lines.push('\n---\n*由「真假大師 Truth Master」協助查證*');
    return lines.join('\n');
  };

  const handleShare = async () => {
    giveFeedback();
    const md = generateMarkdown();
    // 優先用 Web Share API(手機原生分享)
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: '真假大師 — 查證結果',
          text: md,
        });
        return;
      } catch (e) {
        // 使用者取消分享或失敗,改用複製
      }
    }
    try {
      await navigator.clipboard.writeText(md);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2500);
    } catch (e) {
      alert('複製失敗,請長按下方文字手動複製。');
    }
  };

  const verdictStyle = result ? getVerdictStyle(result.verdict) : null;

  return (
    <div className="min-h-screen w-full bg-white">
      {/* 頂部品牌列 */}
      <header className="border-b-2 border-gray-100 bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md"
            style={{ background: `linear-gradient(135deg, ${APPLE_GREEN}, ${TRUST_BLUE})` }}
          >
            <Newspaper className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 leading-tight">真假大師</h1>
            <p className="text-lg text-gray-500 leading-tight">艾瑪大師為您查證</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* === 階段一:輸入 === */}
        {stage === 'input' && (
          <div className="space-y-8">
            <div
              className="rounded-3xl p-8 border-2"
              style={{ backgroundColor: SOFT_BLUE, borderColor: '#BBDEFB' }}
            >
              <div className="flex items-start gap-4">
                <Heart
                  className="w-10 h-10 flex-shrink-0 mt-1"
                  style={{ color: TRUST_BLUE }}
                  strokeWidth={2.5}
                />
                <div>
                  <p className="text-2xl font-semibold text-gray-800 leading-relaxed mb-2">
                    健康的長輩您好!
                  </p>
                  <p className="text-2xl text-gray-700 leading-relaxed">
                    收到不確定的訊息嗎?貼給我看看,我幫您查清楚。
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-2xl font-semibold text-gray-800 mb-4">
                請把影片連結或文字貼在這裡
              </label>
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="例如:朋友傳來的 LINE 訊息、YouTube 影片網址、或剛收到的健康小知識..."
                rows={6}
                className="w-full p-6 rounded-3xl border-2 border-gray-200 focus:outline-none transition-all leading-relaxed bg-gray-50"
                style={{
                  fontSize: '24px',
                  caretColor: TRUST_BLUE,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = TRUST_BLUE;
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.boxShadow = `0 0 0 4px ${SOFT_BLUE}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.backgroundColor = '#F9FAFB';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* 語音輸入按鈕 */}
            <button
              onClick={handleVoiceInput}
              className="w-full flex items-center justify-center gap-4 py-6 rounded-3xl transition-all active:scale-[0.98]"
              style={{
                backgroundColor: isListening ? '#FFEBEE' : '#FFFFFF',
                borderColor: isListening ? RED_LIGHT : TRUST_BLUE,
                borderWidth: '3px',
                borderStyle: 'solid',
                boxShadow: '0 4px 12px rgba(46, 123, 196, 0.15)',
              }}
            >
              {isListening ? (
                <>
                  <MicOff
                    className="w-9 h-9 animate-pulse"
                    style={{ color: RED_LIGHT }}
                    strokeWidth={2.5}
                  />
                  <span className="text-2xl font-semibold" style={{ color: RED_LIGHT }}>
                    正在聽您說...(再按一次停止)
                  </span>
                </>
              ) : (
                <>
                  <Mic
                    className="w-9 h-9"
                    style={{ color: TRUST_BLUE }}
                    strokeWidth={2.5}
                  />
                  <span className="text-2xl font-semibold" style={{ color: TRUST_BLUE }}>
                    {voiceSupported ? '用講的也可以(按這裡)' : '此瀏覽器不支援語音'}
                  </span>
                </>
              )}
            </button>

            {/* 主要 CTA */}
            <button
              onClick={handleAnalyze}
              className="w-full py-7 rounded-3xl text-white text-3xl font-bold flex items-center justify-center gap-4 transition-all active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${APPLE_GREEN}, #66A03F)`,
                boxShadow: '0 8px 20px rgba(124, 179, 66, 0.35), 0 2px 4px rgba(0,0,0,0.05)',
              }}
            >
              <Search className="w-9 h-9" strokeWidth={3} />
              幫我查查真假
            </button>

            <p className="text-center text-xl text-gray-500 leading-relaxed">
              💡 收到任何訊息覺得怪怪的,都可以貼上來問問
            </p>
          </div>
        )}

        {/* === 階段二:讀報中 === */}
        {stage === 'loading' && (
          <div className="flex flex-col items-center justify-center py-20 space-y-10">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full animate-ping"
                style={{ backgroundColor: SOFT_GREEN, animationDuration: '2s' }}
              />
              <div
                className="absolute inset-4 rounded-full animate-pulse"
                style={{ backgroundColor: SOFT_BLUE, animationDuration: '1.5s' }}
              />
              <div
                className="relative w-40 h-40 rounded-full flex items-center justify-center shadow-xl"
                style={{
                  background: `linear-gradient(135deg, ${APPLE_GREEN}, ${TRUST_BLUE})`,
                }}
              >
                <Newspaper className="w-20 h-20 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <div className="text-center space-y-3">
              <p className="text-3xl font-bold text-gray-800">艾瑪大師正在讀報中</p>
              <p className="text-2xl text-gray-500">請稍候,馬上就好...</p>
              <div className="flex justify-center gap-2 pt-4">
                <span
                  className="w-3 h-3 rounded-full animate-bounce"
                  style={{ backgroundColor: APPLE_GREEN, animationDelay: '0ms' }}
                />
                <span
                  className="w-3 h-3 rounded-full animate-bounce"
                  style={{ backgroundColor: TRUST_BLUE, animationDelay: '150ms' }}
                />
                <span
                  className="w-3 h-3 rounded-full animate-bounce"
                  style={{ backgroundColor: APPLE_GREEN, animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* === 階段三:錯誤 === */}
        {stage === 'error' && (
          <div className="space-y-6">
            <div
              className="rounded-3xl p-8 border-2 text-center"
              style={{ backgroundColor: SOFT_ORANGE, borderColor: WARM_ORANGE }}
            >
              <AlertTriangle
                className="w-16 h-16 mx-auto mb-4"
                style={{ color: WARM_ORANGE }}
                strokeWidth={2.5}
              />
              <p className="text-2xl font-bold text-gray-800 mb-3">遇到一點問題</p>
              <p className="text-2xl text-gray-700 leading-relaxed">{errorMsg}</p>
            </div>
            <button
              onClick={handleReset}
              className="w-full py-7 rounded-3xl text-white text-3xl font-bold flex items-center justify-center gap-4 transition-all active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${APPLE_GREEN}, #66A03F)`,
                boxShadow: '0 8px 20px rgba(124, 179, 66, 0.35)',
              }}
            >
              <RotateCcw className="w-9 h-9" strokeWidth={3} />
              再試一次
            </button>
          </div>
        )}

        {/* === 階段四:診斷結果 === */}
        {stage === 'result' && result && verdictStyle && (
          <div className="space-y-6">
            {/* 原始訊息回顧 */}
            <div className="rounded-3xl p-6 bg-gray-50 border-2 border-gray-200">
              <p className="text-xl text-gray-500 mb-2 font-semibold">您剛剛問的:</p>
              <p className="text-2xl text-gray-700 leading-relaxed break-words">
                「{inputText}」
              </p>
            </div>

            {/* 區塊 1:這是真的嗎?(紅綠燈) */}
            <div
              className="rounded-3xl p-8"
              style={{
                backgroundColor: verdictStyle.bg,
                borderColor: verdictStyle.border,
                borderWidth: '3px',
                borderStyle: 'solid',
                boxShadow: `0 4px 16px ${verdictStyle.border}33`,
              }}
            >
              <h2 className="text-2xl font-bold text-gray-700 mb-5">【這是真的嗎?】</h2>
              <div className="flex items-center gap-6">
                <div className="flex flex-col gap-2">
                  <div
                    className="w-14 h-14 rounded-full shadow-lg transition-all"
                    style={{
                      backgroundColor: verdictStyle.light1,
                      boxShadow:
                        verdictStyle.light1 !== '#E0E0E0'
                          ? `0 0 16px ${verdictStyle.light1}`
                          : 'none',
                    }}
                  />
                  <div
                    className="w-14 h-14 rounded-full shadow-lg transition-all"
                    style={{
                      backgroundColor: verdictStyle.light2,
                      boxShadow:
                        verdictStyle.light2 !== '#E0E0E0'
                          ? `0 0 16px ${verdictStyle.light2}`
                          : 'none',
                    }}
                  />
                  <div
                    className="w-14 h-14 rounded-full shadow-lg transition-all"
                    style={{
                      backgroundColor: verdictStyle.light3,
                      boxShadow:
                        verdictStyle.light3 !== '#E0E0E0'
                          ? `0 0 16px ${verdictStyle.light3}`
                          : 'none',
                    }}
                  />
                </div>
                <div className="flex-1">
                  <p
                    className="text-3xl font-bold mb-3"
                    style={{ color: verdictStyle.color }}
                  >
                    {result.verdictTitle}
                  </p>
                  {result.verdictMessage && (
                    <p className="text-2xl text-gray-700 leading-relaxed">
                      {result.verdictMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 區塊 2:正確的地方 */}
            {result.correctParts.length > 0 && (
              <div
                className="rounded-3xl p-8"
                style={{
                  backgroundColor: SOFT_GREEN,
                  borderColor: APPLE_GREEN,
                  borderWidth: '3px',
                  borderStyle: 'solid',
                  boxShadow: '0 4px 16px rgba(124, 179, 66, 0.15)',
                }}
              >
                <h2 className="text-2xl font-bold text-gray-700 mb-5 flex items-center gap-3">
                  <CheckCircle2
                    className="w-9 h-9"
                    style={{ color: APPLE_GREEN }}
                    strokeWidth={2.5}
                  />
                  【正確的地方】
                </h2>
                <div className="space-y-4">
                  {result.correctParts.map((part, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-2xl p-5 flex items-start gap-4 border-2"
                      style={{ borderColor: '#C5E1A5' }}
                    >
                      <CheckCircle2
                        className="w-10 h-10 flex-shrink-0 mt-1"
                        style={{ color: APPLE_GREEN }}
                        strokeWidth={2.5}
                      />
                      <div>
                        <p className="text-2xl font-bold text-gray-800 mb-2">
                          {part.title}
                        </p>
                        <p className="text-2xl text-gray-700 leading-relaxed">
                          {part.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 區塊 3:要小心的部分 */}
            {result.warningParts.length > 0 && (
              <div
                className="rounded-3xl p-8"
                style={{
                  backgroundColor: SOFT_ORANGE,
                  borderColor: WARM_ORANGE,
                  borderWidth: '3px',
                  borderStyle: 'solid',
                  boxShadow: '0 4px 16px rgba(251, 140, 0, 0.15)',
                }}
              >
                <h2 className="text-2xl font-bold text-gray-700 mb-5 flex items-center gap-3">
                  <AlertTriangle
                    className="w-9 h-9"
                    style={{ color: WARM_ORANGE }}
                    strokeWidth={2.5}
                  />
                  【要小心的部分】
                </h2>
                <div className="space-y-4">
                  {result.warningParts.map((part, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-2xl p-5 flex items-start gap-4 border-2"
                      style={{ borderColor: '#FFCC80' }}
                    >
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: WARM_ORANGE }}
                      >
                        <AlertTriangle
                          className="w-7 h-7 text-white"
                          strokeWidth={3}
                        />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-800 mb-2">
                          {part.title}
                        </p>
                        <p className="text-2xl text-gray-700 leading-relaxed">
                          {part.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 艾瑪大師小提醒 */}
            {result.suggestion && (
              <div
                className="rounded-3xl p-7 border-2"
                style={{ backgroundColor: SOFT_BLUE, borderColor: '#90CAF9' }}
              >
                <div className="flex items-start gap-4">
                  <Heart
                    className="w-10 h-10 flex-shrink-0 mt-1"
                    style={{ color: TRUST_BLUE }}
                    strokeWidth={2.5}
                    fill={SOFT_BLUE}
                  />
                  <div>
                    <p className="text-2xl font-bold text-gray-800 mb-2">
                      {result.suggestion.title}
                    </p>
                    <p className="text-2xl text-gray-700 leading-relaxed">
                      {result.suggestion.detail}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 行動按鈕區 */}
            <div className="space-y-4 pt-4">
              <button
                onClick={handleShare}
                className="w-full py-7 rounded-3xl text-white text-3xl font-bold flex items-center justify-center gap-4 transition-all active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${TRUST_BLUE}, #1565C0)`,
                  boxShadow:
                    '0 8px 20px rgba(46, 123, 196, 0.35), 0 2px 4px rgba(0,0,0,0.05)',
                }}
              >
                {showCopied ? (
                  <>
                    <CheckCircle2 className="w-9 h-9" strokeWidth={3} />
                    已複製!可以貼給孩子囉
                  </>
                ) : (
                  <>
                    <Share2 className="w-9 h-9" strokeWidth={3} />
                    轉發給孩子
                  </>
                )}
              </button>

              <button
                onClick={handleReset}
                className="w-full py-6 rounded-3xl text-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] bg-white"
                style={{
                  borderColor: APPLE_GREEN,
                  borderWidth: '3px',
                  borderStyle: 'solid',
                  color: APPLE_GREEN,
                  boxShadow: '0 4px 12px rgba(124, 179, 66, 0.15)',
                }}
              >
                <RotateCcw className="w-8 h-8" strokeWidth={2.5} />
                再查一個訊息
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-6 py-10 text-center">
        <p className="text-xl text-gray-400 leading-relaxed">
          祝福你每天平安喜樂、活力健康 💚
        </p>
      </footer>
    </div>
  );
}
