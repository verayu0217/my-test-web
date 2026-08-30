// Vercel Serverless Function: /api/analyze
// 接收一篇英文文章，回傳繁體中文翻譯 + 核心單字 + 核心片語。
// 需要在 Vercel 專案設定 Environment Variables 加入 GEMINI_API_KEY。

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const MAX_CHARS = 10000;

const SYSTEM_PROMPT = `你是專業的英文閱讀教學助手，服務對象是中高級的台灣英文學習者。
使用者會貼上一篇英文文章，請你完成三件事：

1. translation：把文章翻譯成流暢自然的繁體中文（台灣用語），保留段落。
2. vocab：挑出 8~15 個對中高級學習者最有價值的核心單字。避開過於簡單的字（the, good, make, people 之類）。
3. phrases：挑出 5~10 個實用的片語、慣用語或搭配詞（collocation）。

每個 vocab / phrases 項目都要提供：
- word：單字或片語的原形（動詞用原形、名詞用單數）
- pos：詞性，只能是 "v." "n." "adj." "adv." "phr." 其中之一；phrases 一律用 "phr."
- meaning：繁體中文解釋，可用空格分隔多個近義（例：「空缺 職缺」）
- example：一個例句，優先直接引用文章中出現的句子；若原句太長可適度精簡，但要保持自然完整。

只輸出 JSON，不要加任何說明文字。`;

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    word: { type: "string" },
    pos: { type: "string", enum: ["v.", "n.", "adj.", "adv.", "phr."] },
    meaning: { type: "string" },
    example: { type: "string" },
  },
  required: ["word", "pos", "meaning", "example"],
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    translation: { type: "string" },
    vocab: { type: "array", items: ITEM_SCHEMA },
    phrases: { type: "array", items: ITEM_SCHEMA },
  },
  required: ["translation", "vocab", "phrases"],
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "只接受 POST" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "伺服器未設定 GEMINI_API_KEY" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const text = (body && body.text ? String(body.text) : "").trim();

  if (text.length < 20) {
    res.status(400).json({ error: "文章內容太短" });
    return;
  }
  if (text.length > MAX_CHARS) {
    res.status(400).json({ error: `文章太長，請控制在 ${MAX_CHARS} 字以內（目前 ${text.length} 字）` });
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.3,
      maxOutputTokens: 8192,
    },
  };

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = (data && data.error && data.error.message) || `Gemini API 錯誤 (${geminiRes.status})`;
      res.status(502).json({ error: msg });
      return;
    }

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) {
      res.status(502).json({ error: "Gemini 沒有回傳內容（可能觸發內容過濾或超出長度）" });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(502).json({ error: "無法解析 Gemini 回傳的 JSON" });
      return;
    }

    const allowedPos = new Set(["v.", "n.", "adj.", "adv.", "phr."]);
    const clean = (arr, forcePhrase) =>
      (Array.isArray(arr) ? arr : [])
        .map((it) => ({
          word: String(it.word || "").trim(),
          pos: forcePhrase ? "phr." : (allowedPos.has(it.pos) ? it.pos : "n."),
          meaning: String(it.meaning || "").trim(),
          example: String(it.example || "").trim(),
        }))
        .filter((it) => it.word && it.meaning);

    res.status(200).json({
      translation: String(parsed.translation || "").trim(),
      vocab: clean(parsed.vocab, false),
      phrases: clean(parsed.phrases, true),
    });
  } catch (err) {
    res.status(500).json({ error: "分析時發生錯誤：" + (err && err.message ? err.message : String(err)) });
  }
};
