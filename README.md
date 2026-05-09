# 真假大師 (Truth Master)

> 為 70 歲以上長輩設計的網路訊息查證工具,由「艾瑪大師」用白話文幫您看懂網路上的真假消息。

採用 **Next.js 14 + Tailwind + Gemini API + Web Speech API**,完全免費部署到 Vercel。

---

## ✨ 功能

- 🟢 **紅綠燈式判讀** — 一眼看出訊息可信度
- 🎙️ **語音輸入** — 不用打字,按住麥克風講話即可(中文支援)
- 💚 **長輩聽得懂的語氣** — 不用「資訊來源不明」這種冷冰冰的話
- 📤 **一鍵轉發給孩子** — 自動整理成 Markdown,LINE 貼給家人
- 📱 **可加到主畫面** — PWA 支援,像 App 一樣使用
- 🔒 **防刷流量** — 內建每 IP 每小時 20 次速率限制

---

## 🚀 5 分鐘部署到 Vercel(完整步驟)

### 步驟 1:取得 Gemini API Key(免費)

1. 開啟 https://aistudio.google.com/app/apikey
2. 用 Google 帳號登入
3. 點 **「Create API key」**
4. 複製產生的 Key(長得像 `AIzaSy...`),先存著

> 💡 **免費額度**:Gemini Free Tier 約每分鐘 15 次、每天 1500 次,給家人用綽綽有餘。

### 步驟 2:把專案放上 GitHub

```bash
# 在這個資料夾裡執行
git init
git add .
git commit -m "Initial commit: Truth Master"

# 到 https://github.com/new 開一個新的 repo(名字隨意,例如 truth-master)
git remote add origin https://github.com/你的帳號/truth-master.git
git branch -M main
git push -u origin main
```

### 步驟 3:部署到 Vercel

1. 開啟 https://vercel.com/new
2. 用 GitHub 登入,選擇剛剛建立的 `truth-master` repo
3. 在 **Environment Variables** 區塊加入:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** 步驟 1 拿到的 Key
4. 按 **Deploy**(約 2 分鐘完成)
5. 部署完成會給你一個網址,例如 `https://truth-master-xxx.vercel.app`

✅ **完成!把這個網址傳給長輩就能用。**

### 步驟 4(選用):換成好記的網址

Vercel 預設網址有點長,可以:
- 在 Vercel 專案設定 → **Domains** → 加上免費的子網域(例:`truth-master.vercel.app`)
- 或綁定自己買的網域(年費約 300-500 元)

---

## 📱 教長輩「加到主畫面」

部署完成後,把網址用 LINE 傳給長輩,並附上以下說明:

**iPhone 版:**
1. 用 Safari 打開網址
2. 點下方「分享」按鈕(向上箭頭)
3. 選「加入主畫面」
4. 桌面就會出現「真假大師」的綠色圖示,像 App 一樣

**Android 版:**
1. 用 Chrome 打開網址
2. 點右上角三個點
3. 選「加到主畫面」

---

## 💻 本地開發

```bash
# 1. 安裝套件
npm install

# 2. 複製環境變數檔案
cp .env.example .env.local

# 3. 編輯 .env.local,填入你的 Gemini API Key

# 4. 啟動開發伺服器
npm run dev

# 5. 開啟 http://localhost:3000
```

---

## 🛠️ 專案結構

```
truth-master/
├── app/
│   ├── api/analyze/route.ts    ← 後端 API:呼叫 Gemini 分析
│   ├── globals.css              ← 全域樣式
│   ├── layout.tsx               ← Root layout、字型、PWA 設定
│   └── page.tsx                 ← 主畫面(含語音、結果顯示)
├── public/
│   ├── manifest.json            ← PWA manifest
│   ├── icon-192.png             ← App 圖示
│   └── icon-512.png             ← App 圖示
├── .env.example                 ← 環境變數範本
├── package.json
├── tailwind.config.js
└── README.md
```

---

## 🎨 設計重點(銀髮族 UX)

- **字體**:全站基底 24px 起跳,內文 26px,行高 1.625
- **圖示**:lucide-react 粗線條,strokeWidth 2.5-3
- **配色**:蘋果綠 #7CB342 + 信任藍 #2E7BC4 + 警告橘 #FB8C00
- **觸控**:所有按鈕高度 56px+ 且寬度滿版
- **回饋**:點擊有震動 + 600Hz 柔和提示音
- **語氣**:艾瑪大師用「阿姨阿伯」「我們聽聽就好」「沒看過」

---

## ⚙️ 進階設定

### 調整速率限制
編輯 `app/api/analyze/route.ts`:
```ts
const RATE_LIMIT = 20;        // 改成你想要的次數
const RATE_WINDOW = 60 * 60 * 1000;  // 時間窗(毫秒)
```

### 改用更強的模型
編輯 `app/api/analyze/route.ts`,把:
```ts
model: 'gemini-2.0-flash'
```
改成:
```ts
model: 'gemini-2.5-pro'    // 更聰明但較慢、成本較高
```

### 加上 Google Search 增強事實查核
Gemini 支援 grounding,可以讓 AI 即時搜尋網路。在 `getGenerativeModel` 加入:
```ts
tools: [{ googleSearchRetrieval: {} }]
```

---

## ❓ 常見問題

**Q: 為什麼語音輸入按了沒反應?**
A: 需要瀏覽器允許麥克風權限。第一次用會跳出詢問視窗,選「允許」即可。iOS 必須用 Safari、Android 建議用 Chrome。

**Q: Gemini 免費額度用完了怎麼辦?**
A: 等隔天會自動重設;或在 Google Cloud Console 開啟付費(用量極低,通常一個月幾十元台幣)。

**Q: 可以改用 OpenAI / Claude 嗎?**
A: 可以。修改 `app/api/analyze/route.ts` 換成對應 SDK 即可,prompt 結構相同。

**Q: 長輩不會打字也不會貼連結怎麼辦?**
A: 用「語音輸入」按鈕。長輩只要按一下,然後對著手機說「我朋友傳這個給我,洋蔥水可以治感冒,是真的嗎?」,系統會自動辨識成文字並送出查證。

---

## 📜 授權

MIT License — 歡迎自由使用、修改、分享給更多需要的長輩家庭 💚
