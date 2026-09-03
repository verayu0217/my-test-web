// 單字庫：新增 / 搜尋 / A-Z / 類型篩選 / 分頁 / 編輯 / 「今天複習」統計
import { db, vocabRef, addDoc, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from './firebase.js';
import { escapeHtml, speakText, localToday } from './util.js';
import { askConfirm } from './confirm.js';

const vocabForm = document.getElementById('vocab-form');
const vocabList = document.getElementById('vocab-list');
const vocabTotalCount = document.getElementById('vocab-total-count');
const alphaFilterContainer = document.getElementById('alpha-filter');
const paginationControls = document.getElementById('pagination-controls');
const vocabStatus = document.getElementById('vocab-status');
const vocabSearchInput = document.getElementById('vocab-search');
const vocabSearchClear = document.getElementById('vocab-search-clear');
const typeFilterContainer = document.getElementById('type-filter');
const reviewedTodayCountEl = document.getElementById('reviewed-today-count');

let allVocabularies = [];
let selectedLetter = 'ALL';
let selectedType = 'ALL';
let searchTerm = '';
let currentPage = 1;
const ITEMS_PER_PAGE = 15;

// 讓其他模組（複習模式、文章分析）取得目前的單字清單
export function getAllVocabularies() {
  return allVocabularies;
}

// 生成 A-Z 標籤（ALL 獨立一行，A-Z 排成一列並可自動換行）
function initAlphaFilter() {
  const azLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const btnClass = (active) =>
    `alpha-btn px-2.5 py-1 rounded-lg border transition-all ${active
      ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
      : 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600'}`;

  alphaFilterContainer.innerHTML = `
    <div>
      <button data-letter="ALL" class="${btnClass(true)}">ALL</button>
    </div>
    <div class="flex flex-wrap gap-1.5">
      ${azLetters.map(l => `<button data-letter="${l}" class="${btnClass(false)}">${l}</button>`).join('')}
    </div>
  `;

  alphaFilterContainer.querySelectorAll('.alpha-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      selectedLetter = e.target.dataset.letter;
      currentPage = 1;

      alphaFilterContainer.querySelectorAll('.alpha-btn').forEach(b => {
        b.className = "alpha-btn px-2.5 py-1 rounded-lg border transition-all bg-white text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600";
      });
      e.target.className = "alpha-btn px-2.5 py-1 rounded-lg border transition-all bg-indigo-600 text-white border-indigo-600 font-bold";

      renderVocabularies();
    });
  });
}

initAlphaFilter();

// 搜尋
vocabSearchInput.addEventListener('input', () => {
  searchTerm = vocabSearchInput.value.trim().toLowerCase();
  vocabSearchClear.classList.toggle('hidden', searchTerm === '');
  currentPage = 1;
  renderVocabularies();
});
vocabSearchClear.addEventListener('click', () => {
  vocabSearchInput.value = '';
  searchTerm = '';
  vocabSearchClear.classList.add('hidden');
  currentPage = 1;
  renderVocabularies();
  vocabSearchInput.focus();
});

// 類型篩選（全部 / 單字 / 片語）
typeFilterContainer.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedType = btn.dataset.type;
    currentPage = 1;
    typeFilterContainer.querySelectorAll('.type-btn').forEach(b => {
      const active = b === btn;
      b.classList.toggle('bg-white', active);
      b.classList.toggle('text-indigo-600', active);
      b.classList.toggle('shadow-sm', active);
      b.classList.toggle('text-slate-500', !active);
    });
    renderVocabularies();
  });
});

vocabForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const word = document.getElementById('vocab-word').value.trim();
  const pos = document.getElementById('vocab-pos').value;
  const meaning = document.getElementById('vocab-meaning').value.trim();
  const example = document.getElementById('vocab-example').value.trim();

  if (!word || !meaning) return;

  // ✅ 儲存前去重複（不分大小寫）
  const duplicate = allVocabularies.find(
    v => (v.word || '').trim().toLowerCase() === word.toLowerCase()
  );
  if (duplicate) {
    showVocabStatus(`「${word}」已經在單字庫裡了。`, 'error');
    return;
  }

  try {
    await addDoc(vocabRef, {
      word,
      pos,
      meaning,
      example,
      createdAt: serverTimestamp()
    });
    vocabForm.reset();
    showVocabStatus(`已新增「${word}」`, 'success');
  } catch (err) {
    console.error("新增失敗：", err);
    showVocabStatus('新增失敗，請稍後再試。', 'error');
  }
});

let vocabStatusTimer;
function showVocabStatus(message, type) {
  clearTimeout(vocabStatusTimer);
  vocabStatus.textContent = message;
  vocabStatus.classList.remove('hidden', 'text-rose-600', 'text-emerald-600');
  vocabStatus.classList.add(type === 'error' ? 'text-rose-600' : 'text-emerald-600');
  vocabStatusTimer = setTimeout(() => vocabStatus.classList.add('hidden'), 3000);
}

function updateReviewedTodayCount() {
  const t = localToday();
  reviewedTodayCountEl.textContent = allVocabularies.filter(v => v.lastReviewDate === t).length;
}

onSnapshot(query(vocabRef, orderBy("createdAt", "desc")), (snapshot) => {
  allVocabularies = snapshot.docs.map(docSnapshot => ({
    id: docSnapshot.id,
    ...docSnapshot.data()
  }));
  vocabTotalCount.textContent = allVocabularies.length;
  updateReviewedTodayCount();
  renderVocabularies();
});

function renderVocabularies() {
  let filtered = allVocabularies;

  if (selectedType === 'PHRASE') {
    filtered = filtered.filter(item => item.pos === 'phr.');
  } else if (selectedType === 'WORD') {
    filtered = filtered.filter(item => item.pos !== 'phr.');
  }

  if (selectedLetter !== 'ALL') {
    filtered = filtered.filter(item =>
      item.word && item.word.trim().toUpperCase().startsWith(selectedLetter)
    );
  }

  if (searchTerm) {
    filtered = filtered.filter(item =>
      (item.word || '').toLowerCase().includes(searchTerm) ||
      (item.meaning || '').toLowerCase().includes(searchTerm) ||
      (item.example || '').toLowerCase().includes(searchTerm)
    );
  }

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  renderPagination(totalPages);

  vocabList.innerHTML = '';
  if (paginatedItems.length === 0) {
    vocabList.innerHTML = `<p class="col-span-full text-center text-slate-400 text-xs py-8">目前無資料。</p>`;
    return;
  }

  paginatedItems.forEach((item) => {
    const li = document.createElement('li');
    li.className = "group bg-slate-50/80 hover:bg-white p-4 rounded-xl border border-indigo-100/80 hover:border-indigo-300 shadow-2xs hover:shadow-sm flex flex-col justify-between transition-all relative";

    li.innerHTML = `
      <div>
        <div class="flex items-baseline gap-2 flex-wrap pr-16">
          <span class="font-extrabold text-indigo-600 text-base sm:text-lg tracking-wide break-words">${escapeHtml(item.word)}</span>
          <span class="text-xs font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md">${escapeHtml(item.pos)}</span>
          <button class="speak-vocab text-indigo-400 hover:text-indigo-600 text-sm ml-1 transition-colors" title="發音">
            <i class="fa-solid fa-volume-high"></i>
          </button>
        </div>
        <p class="text-sm text-slate-800 font-bold mt-1.5 break-words">${escapeHtml(item.meaning)}</p>
      </div>
      <div class="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
        <button class="edit-vocab text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-md p-1.5 leading-none text-xs" title="編輯">
          <i class="fa-regular fa-pen-to-square"></i>
        </button>
        <button class="delete-vocab text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md p-1.5 leading-none text-xs" title="刪除">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </div>
      ${item.example ? `<p class="text-xs text-slate-500 italic border-l-2 border-indigo-400/60 pl-2 mt-2 whitespace-pre-wrap break-words font-normal">"${escapeHtml(item.example)}"</p>` : ''}
    `;

    li.querySelector('.speak-vocab').addEventListener('click', () => speakText(item.word));
    li.querySelector('.edit-vocab').addEventListener('click', () => openVocabEdit(item));
    li.querySelector('.delete-vocab').addEventListener('click', async () => {
      if (await askConfirm(`確定要刪除單字「${item.word}」嗎？`)) {
        deleteDoc(doc(db, "vocabularies", item.id));
      }
    });
    vocabList.appendChild(li);
  });
}

// 產生帶省略號的頁碼清單，例如 [1, '...', 4, 5, 6, '...', 20]
function buildPageList(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('...');
  pages.push(total);
  return pages;
}

function goToPage(page, total) {
  const target = Math.min(Math.max(1, page), total);
  if (target === currentPage) return;
  currentPage = target;
  renderVocabularies();
}

function renderPagination(totalPages) {
  paginationControls.innerHTML = '';
  if (totalPages <= 1) return;

  const navBtn = (label, page, disabled) => {
    const btn = document.createElement('button');
    btn.className = "px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium";
    btn.innerHTML = label;
    btn.disabled = disabled;
    if (!disabled) btn.addEventListener('click', () => goToPage(page, totalPages));
    return btn;
  };

  paginationControls.appendChild(navBtn('<i class="fa-solid fa-chevron-left"></i>', currentPage - 1, currentPage === 1));

  buildPageList(currentPage, totalPages).forEach(p => {
    if (p === '...') {
      const span = document.createElement('span');
      span.className = "px-1.5 text-slate-400";
      span.textContent = '…';
      paginationControls.appendChild(span);
      return;
    }
    const btn = document.createElement('button');
    const active = p === currentPage;
    btn.className = active
      ? "min-w-[32px] px-2.5 py-1.5 rounded-lg border border-indigo-600 bg-indigo-600 text-white font-bold transition-all"
      : "min-w-[32px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 transition-all font-medium";
    btn.textContent = p;
    if (!active) btn.addEventListener('click', () => goToPage(p, totalPages));
    paginationControls.appendChild(btn);
  });

  paginationControls.appendChild(navBtn('<i class="fa-solid fa-chevron-right"></i>', currentPage + 1, currentPage === totalPages));
}


// ==================== 編輯單字 ====================
const vocabEditModal = document.getElementById('vocab-edit-modal');
const vocabEditForm = document.getElementById('vocab-edit-form');
const editWord = document.getElementById('edit-word');
const editPos = document.getElementById('edit-pos');
const editMeaning = document.getElementById('edit-meaning');
const editExample = document.getElementById('edit-example');
const vocabEditStatus = document.getElementById('vocab-edit-status');
let editingId = null;

function openVocabEdit(item) {
  editingId = item.id;
  editWord.value = item.word || '';
  editPos.value = item.pos || 'n.';
  editMeaning.value = item.meaning || '';
  editExample.value = item.example || '';
  vocabEditStatus.classList.add('hidden');
  vocabEditModal.classList.remove('hidden');
  editWord.focus();
}

function closeVocabEdit() {
  vocabEditModal.classList.add('hidden');
  editingId = null;
}

document.getElementById('vocab-edit-close').addEventListener('click', closeVocabEdit);
document.getElementById('vocab-edit-cancel').addEventListener('click', closeVocabEdit);
vocabEditModal.addEventListener('click', (e) => {
  if (e.target === vocabEditModal) closeVocabEdit();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !vocabEditModal.classList.contains('hidden')) closeVocabEdit();
});

vocabEditForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!editingId) return;
  const word = editWord.value.trim();
  const meaning = editMeaning.value.trim();
  if (!word || !meaning) return;

  // 改名時避免與其他單字重複
  const dup = allVocabularies.find(v =>
    v.id !== editingId && (v.word || '').trim().toLowerCase() === word.toLowerCase()
  );
  if (dup) {
    vocabEditStatus.textContent = `「${word}」已經在單字庫裡了。`;
    vocabEditStatus.classList.remove('hidden');
    return;
  }

  try {
    await updateDoc(doc(db, "vocabularies", editingId), {
      word,
      pos: editPos.value,
      meaning,
      example: editExample.value.trim()
    });
    closeVocabEdit();
  } catch (err) {
    console.error('更新失敗：', err);
    vocabEditStatus.textContent = '更新失敗，請稍後再試。';
    vocabEditStatus.classList.remove('hidden');
  }
});
