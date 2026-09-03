# my-test-web

英文學習儀表板：單字庫（含複習模式）、文章分析、待辦、備忘。
純前端 + Firebase Firestore，AI 分析走一支 Vercel serverless function。

## 結構

```
index.html        畫面 markup，載入 /js/main.js
js/
  firebase.js     Firebase 初始化，匯出 db / collection ref / Firestore 函式
  util.js         escapeHtml、speakText、localToday
  confirm.js      共用確認視窗
  vocab.js        單字庫：表單 / 搜尋 / A-Z / 分頁 / 編輯 / 今日複習統計
  review.js       複習模式（全螢幕抽卡）
  tasks.js        待辦
  memo.js         備忘
  article.js      文章分析（前端）
  main.js         進入點：載入模組 + 頂部分頁切換
api/
  analyze.js      Vercel function：收文章 → Gemini → 翻譯 + 核心單字片語
```

## 本機開發

JS 用原生 ES modules，**不能直接用瀏覽器開 `index.html`**（`file://` 會被 CORS 擋）。
起一個靜態 server：

```
python -m http.server 8000
# 然後開 http://localhost:8000
```

文章分析要打 `/api/analyze`，本機測那一段用 `vercel dev`。

## 部署

推到 GitHub，Vercel 自動部署。需要在 Vercel 專案設定環境變數 `GEMINI_API_KEY`。
