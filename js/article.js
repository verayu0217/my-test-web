// 文章分析（前端）：呼叫 /api/analyze，顯示翻譯與核心單字片語
import { vocabRef, addDoc, serverTimestamp } from './firebase.js';
import { escapeHtml, speakText } from './util.js';
import { getAllVocabularies } from './vocab.js';

const articleInput = document.getElementById('article-input');
const analyzeBtn = document.getElementById('analyze-btn');
const analyzeStatus = document.getElementById('analyze-status');
const analyzeResult = document.getElementById('analyze-result');
const translationBody = document.getElementById('translation-body');
const translationChevron = document.getElementById('translation-chevron');
const toggleTranslationBtn = document.getElementById('toggle-translation');
const analyzeVocabList = document.getElementById('analyze-vocab-list');

let analyzedItems = [];

toggleTranslationBtn.addEventListener('click', () => {
  const hidden = translationBody.classList.toggle('hidden');
  translationChevron.style.transform = hidden ? 'rotate(-90deg)' : '';
});

articleInput.addEventListener('input', () => {
  if (articleInput.value.trim() === '') {
    resetAnalysis();
  }
});

function resetAnalysis() {
  analyzeResult.classList.add('hidden');
  translationBody.textContent = '';
  translationBody.classList.remove('hidden');
  translationChevron.style.transform = '';
  analyzeVocabList.innerHTML = '';
  analyzedItems = [];
  analyzeStatus.textContent = '';
}

analyzeBtn.addEventListener('click', async () => {
  const text = articleInput.value.trim();
  if (text.length < 20) {
    analyzeStatus.textContent = '請貼上較完整的文章。';
    return;
  }
  analyzeBtn.disabled = true;
  analyzeStatus.textContent = '分析中，約需 10~20 秒...';
  try {
    const resp = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `伺服器錯誤 (${resp.status})`);
    renderAnalysis(data);
    analyzeStatus.textContent = '';
  } catch (err) {
    console.error('分析失敗：', err);
    analyzeStatus.textContent = '分析失敗：' + err.message;
  } finally {
    analyzeBtn.disabled = false;
  }
});

function renderAnalysis(data) {
  translationBody.textContent = data.translation || '（無翻譯結果）';
  translationBody.classList.remove('hidden');
  translationChevron.style.transform = '';

  analyzedItems = [
    ...(data.vocab || []),
    ...(data.phrases || [])
  ];

  const existing = new Set(getAllVocabularies().map(v => (v.word || '').trim().toLowerCase()));
  analyzeVocabList.innerHTML = '';

  if (analyzedItems.length === 0) {
    analyzeVocabList.innerHTML = `<li class="text-xs text-slate-400 py-3">沒有擷取到單字。</li>`;
  }

  analyzedItems.forEach((item) => {
    const isDup = existing.has(item.word.trim().toLowerCase());
    const li = document.createElement('li');
    li.className = "flex items-start gap-2.5 bg-slate-50/80 border border-slate-200/60 rounded-xl p-3";
    li.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline gap-2 flex-wrap">
          <span class="font-extrabold text-indigo-600 text-sm">${escapeHtml(item.word)}</span>
          <span class="text-[11px] font-bold text-purple-700 bg-purple-100/80 px-1.5 py-0.5 rounded">${escapeHtml(item.pos)}</span>
          <button type="button" class="speak-analyze text-indigo-400 hover:text-indigo-600 text-xs" title="發音">
            <i class="fa-solid fa-volume-high"></i>
          </button>
          ${isDup ? '<span class="text-[10px] text-amber-600 font-semibold">已在單字庫</span>' : ''}
        </div>
        <p class="text-xs text-slate-700 font-semibold mt-1">${escapeHtml(item.meaning)}</p>
        ${item.example ? `<p class="text-[11px] text-slate-500 italic mt-0.5">"${escapeHtml(item.example)}"</p>` : ''}
      </div>
      <button
        type="button"
        class="add-analyze-item shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${isDup ? 'text-slate-300 border-slate-200 cursor-not-allowed' : 'text-indigo-500 border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600'}"
        title="${isDup ? '已在單字庫' : '加入單字庫'}"
        ${isDup ? 'disabled' : ''}
      >
        <i class="fa-solid fa-plus text-xs"></i>
      </button>
    `;
    li.querySelector('.speak-analyze').addEventListener('click', () => speakText(item.word));

    const addBtn = li.querySelector('.add-analyze-item');
    if (!isDup) {
      addBtn.addEventListener('click', async () => {
        addBtn.disabled = true;
        try {
          await addDoc(vocabRef, {
            word: item.word,
            pos: item.pos,
            meaning: item.meaning,
            example: item.example || '',
            createdAt: serverTimestamp()
          });
          existing.add(item.word.trim().toLowerCase());
          addBtn.innerHTML = '<i class="fa-solid fa-check text-xs"></i>';
          addBtn.title = '已加入';
          addBtn.className = "add-analyze-item shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center text-emerald-500 border-emerald-200";
        } catch (err) {
          console.error('加入失敗：', err);
          analyzeStatus.textContent = '加入失敗：' + err.message;
          addBtn.disabled = false;
        }
      });
    }

    analyzeVocabList.appendChild(li);
  });

  analyzeResult.classList.remove('hidden');
}
