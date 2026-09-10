// AWS 筆記：快速記錄（服務 + 選填分類 + 內容）
// 清單 / 依服務整理（直向堆疊），可搜尋、篩選、行內編輯
import { db, awsNotesRef, addDoc, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from './firebase.js';
import { escapeHtml } from './util.js';

const form = document.getElementById('aws-form');
const serviceInput = document.getElementById('aws-service');
const categoryInput = document.getElementById('aws-category');
const noteInput = document.getElementById('aws-note');
const listEl = document.getElementById('aws-list');
const filterInfo = document.getElementById('aws-filter-info');
const searchInput = document.getElementById('aws-search');
const searchClear = document.getElementById('aws-search-clear');
const viewBtns = document.querySelectorAll('.aws-view-btn');

let notes = [];
let view = 'list';
let serviceFilter = null;
let categoryFilter = null;
let searchTerm = '';
let editingId = null;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const service = serviceInput.value.trim();
  const note = noteInput.value.trim();
  if (!service || !note) return;

  try {
    await addDoc(awsNotesRef, {
      service,
      category: categoryInput.value.trim(),
      note,
      createdAt: serverTimestamp()
    });
    categoryInput.value = '';
    noteInput.value = '';
    serviceInput.focus();
  } catch (err) {
    console.error('新增失敗：', err);
  }
});

searchInput.addEventListener('input', () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  searchClear.classList.toggle('hidden', !searchInput.value);
  render();
});
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchTerm = '';
  searchClear.classList.add('hidden');
  render();
});

viewBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    view = btn.dataset.view;
    viewBtns.forEach((b) => {
      const active = b === btn;
      b.classList.toggle('bg-[#FF9900]', active);
      b.classList.toggle('text-[#232F3E]', active);
      b.classList.toggle('shadow-sm', active);
      b.classList.toggle('text-slate-400', !active);
      b.classList.toggle('hover:text-white', !active);
    });
    render();
  });
});

onSnapshot(query(awsNotesRef, orderBy('createdAt', 'desc')), (snapshot) => {
  notes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  render();
});

function badge(text, kind, dataAttr) {
  const cls = kind === 'service'
    ? 'text-[#FFB259] bg-[#FF9900]/20 hover:bg-[#FF9900]/30'
    : 'text-sky-300 bg-sky-400/15 hover:bg-sky-400/25';
  return `<button class="aws-badge text-[11px] font-bold ${cls} px-2 py-0.5 rounded transition-colors" ${dataAttr}="${escapeHtml(text)}">${escapeHtml(text)}</button>`;
}

function cardHtml(n) {
  if (editingId === n.id) return editHtml(n);
  return `
    <div class="group relative bg-[#2a3a4a] border border-white/10 rounded-xl p-3.5 hover:border-[#FF9900]/50 transition-all">
      <div class="flex items-center gap-1.5 mb-1.5 flex-wrap pr-12">
        ${badge(n.service, 'service', 'data-service')}
        ${n.category ? badge(n.category, 'category', 'data-cat') : ''}
      </div>
      <p class="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(n.note)}</p>
      <div class="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
        <button class="aws-edit text-slate-500 hover:text-[#FF9900] transition-colors p-1" data-id="${n.id}" title="編輯">
          <i class="fa-regular fa-pen-to-square text-xs"></i>
        </button>
        <button class="aws-del text-slate-500 hover:text-rose-400 transition-colors p-1" data-id="${n.id}" title="刪除">
          <i class="fa-regular fa-trash-can text-xs"></i>
        </button>
      </div>
    </div>`;
}

function editHtml(n) {
  return `
    <form class="aws-edit-form bg-[#2a3a4a] border border-[#FF9900]/40 rounded-xl p-3.5 flex flex-col gap-2" data-id="${n.id}">
      <div class="flex flex-col sm:flex-row gap-2">
        <input class="e-service sm:w-40 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-[#c25e00] focus:outline-none focus:ring-2 focus:ring-[#FF9900]" list="aws-service-list" value="${escapeHtml(n.service || '')}" placeholder="服務" required>
        <input class="e-category flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-sky-700 focus:outline-none focus:ring-2 focus:ring-[#FF9900]" list="aws-category-list" value="${escapeHtml(n.category || '')}" placeholder="分類 (選填)">
      </div>
      <textarea class="e-note w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF9900] resize-y leading-relaxed" rows="3" required>${escapeHtml(n.note || '')}</textarea>
      <div class="flex justify-end gap-1.5">
        <button type="button" class="e-cancel px-3 py-1.5 rounded-lg border border-white/15 text-slate-300 hover:text-white hover:border-white/30 text-xs font-semibold transition-all">取消</button>
        <button type="submit" class="px-3 py-1.5 rounded-lg bg-[#FF9900] hover:bg-[#ec7211] text-[#232F3E] text-xs font-bold transition-all active:scale-95">儲存</button>
      </div>
    </form>`;
}

function chip(label, onclearId) {
  return `<span class="inline-flex items-center gap-1 bg-white/10 text-slate-200 px-2 py-0.5 rounded-full">${escapeHtml(label)}<button id="${onclearId}" class="text-slate-400 hover:text-white">✕</button></span>`;
}

function render() {
  let items = notes;
  if (serviceFilter) items = items.filter((n) => n.service === serviceFilter);
  if (categoryFilter) items = items.filter((n) => (n.category || '') === categoryFilter);
  if (searchTerm) {
    items = items.filter((n) =>
      (n.service || '').toLowerCase().includes(searchTerm) ||
      (n.category || '').toLowerCase().includes(searchTerm) ||
      (n.note || '').toLowerCase().includes(searchTerm)
    );
  }

  const chips = [];
  if (serviceFilter) chips.push(chip(`服務：${serviceFilter}`, 'aws-clear-service'));
  if (categoryFilter) chips.push(chip(`分類：${categoryFilter}`, 'aws-clear-category'));
  filterInfo.innerHTML = chips.length
    ? `<div class="flex flex-wrap items-center gap-1.5">${chips.join('')}<span class="text-slate-500">· ${items.length} 筆</span></div>`
    : `${items.length} 筆筆記${searchTerm ? '（符合搜尋）' : ''}`;

  const gridCls = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3';

  if (items.length === 0) {
    listEl.className = 'block';
    listEl.innerHTML = `<p class="text-center text-slate-400 text-xs py-8">${
      notes.length === 0 ? '還沒有 AWS 筆記，記一筆吧...' : '沒有符合的筆記'
    }</p>`;
  } else if (view === 'list') {
    listEl.className = gridCls;
    listEl.innerHTML = items.map(cardHtml).join('');
  } else {
    const groups = {};
    items.forEach((n) => {
      if (!groups[n.service]) groups[n.service] = [];
      groups[n.service].push(n);
    });
    const services = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    listEl.className = 'flex flex-col gap-6';
    listEl.innerHTML = services
      .map(
        (s) => `
      <div>
        <div class="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-white/10">
          <h3 class="text-sm font-bold text-slate-100">${escapeHtml(s)}</h3>
          <span class="text-[11px] font-semibold text-slate-400 bg-white/10 px-1.5 rounded-full">${groups[s].length}</span>
        </div>
        <div class="${gridCls}">
          ${groups[s].map(cardHtml).join('')}
        </div>
      </div>`
      )
      .join('');
  }

  wireEvents();
}

function wireEvents() {
  listEl.querySelectorAll('.aws-del').forEach((b) => {
    b.addEventListener('click', () => deleteDoc(doc(db, 'awsNotes', b.dataset.id)));
  });
  listEl.querySelectorAll('.aws-edit').forEach((b) => {
    b.addEventListener('click', () => { editingId = b.dataset.id; render(); });
  });
  listEl.querySelectorAll('.aws-badge').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.service !== undefined) serviceFilter = b.dataset.service;
      if (b.dataset.cat !== undefined) categoryFilter = b.dataset.cat;
      render();
    });
  });
  listEl.querySelectorAll('.aws-edit-form').forEach((f) => {
    f.querySelector('.e-cancel').addEventListener('click', () => { editingId = null; render(); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = f.dataset.id;
      const service = f.querySelector('.e-service').value.trim();
      const category = f.querySelector('.e-category').value.trim();
      const note = f.querySelector('.e-note').value.trim();
      if (!service || !note) return;
      editingId = null;
      try {
        await updateDoc(doc(db, 'awsNotes', id), { service, category, note });
      } catch (err) {
        console.error('更新失敗：', err);
      }
      render();
    });
  });

  const cs = document.getElementById('aws-clear-service');
  if (cs) cs.addEventListener('click', () => { serviceFilter = null; render(); });
  const cc = document.getElementById('aws-clear-category');
  if (cc) cc.addEventListener('click', () => { categoryFilter = null; render(); });
}
