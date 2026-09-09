// AWS 筆記：快速記錄 + 清單 / 依服務整理成卡片牆
import { db, awsNotesRef, addDoc, onSnapshot, doc, deleteDoc, serverTimestamp, query, orderBy } from './firebase.js';
import { escapeHtml } from './util.js';

const form = document.getElementById('aws-form');
const serviceInput = document.getElementById('aws-service');
const noteInput = document.getElementById('aws-note');
const listEl = document.getElementById('aws-list');
const filterInfo = document.getElementById('aws-filter-info');
const viewBtns = document.querySelectorAll('.aws-view-btn');

let notes = [];
let view = 'list';
let serviceFilter = null;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const service = serviceInput.value.trim();
  const note = noteInput.value.trim();
  if (!service || !note) return;

  try {
    await addDoc(awsNotesRef, {
      service,
      note,
      createdAt: serverTimestamp()
    });
    noteInput.value = '';
    serviceInput.focus();
  } catch (err) {
    console.error('新增失敗：', err);
  }
});

viewBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    view = btn.dataset.view;
    viewBtns.forEach((b) => {
      const active = b === btn;
      b.classList.toggle('bg-white', active);
      b.classList.toggle('text-orange-600', active);
      b.classList.toggle('shadow-sm', active);
      b.classList.toggle('text-slate-500', !active);
      b.classList.toggle('hover:text-slate-700', !active);
    });
    render();
  });
});

onSnapshot(query(awsNotesRef, orderBy('createdAt', 'desc')), (snapshot) => {
  notes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  render();
});

function cardHtml(n) {
  return `
    <div class="group relative bg-white border border-slate-200 rounded-xl p-3.5 hover:shadow-md hover:border-orange-200 transition-all">
      <div class="flex items-center gap-2 mb-1.5 flex-wrap">
        <button class="aws-badge text-[11px] font-bold text-orange-700 bg-orange-100/80 hover:bg-orange-200/80 px-2 py-0.5 rounded transition-colors" data-service="${escapeHtml(n.service)}">${escapeHtml(n.service)}</button>
      </div>
      <p class="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(n.note)}</p>
      <button class="aws-del absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all" data-id="${n.id}" title="刪除">
        <i class="fa-solid fa-xmark text-xs"></i>
      </button>
    </div>`;
}

function render() {
  let items = notes;
  if (serviceFilter) items = items.filter((n) => n.service === serviceFilter);

  filterInfo.innerHTML = serviceFilter
    ? `篩選：<span class="font-semibold text-orange-600">${escapeHtml(serviceFilter)}</span> <button id="aws-clear-filter" class="text-slate-400 hover:text-slate-600 ml-1">✕ 清除</button>`
    : `${notes.length} 筆筆記`;

  if (items.length === 0) {
    listEl.className = 'block';
    listEl.innerHTML = `<p class="text-center text-slate-400 text-xs py-8">${
      notes.length === 0 ? '還沒有 AWS 筆記，記一筆吧...' : '這個服務沒有筆記'
    }</p>`;
  } else if (view === 'list') {
    listEl.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3';
    listEl.innerHTML = items.map(cardHtml).join('');
  } else {
    const groups = {};
    items.forEach((n) => {
      if (!groups[n.service]) groups[n.service] = [];
      groups[n.service].push(n);
    });
    const services = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    listEl.className = 'flex gap-4 overflow-x-auto pb-2';
    listEl.innerHTML = services
      .map(
        (s) => `
      <div class="shrink-0 w-72">
        <div class="flex items-center gap-2 mb-2 px-1">
          <h3 class="text-sm font-bold text-slate-700">${escapeHtml(s)}</h3>
          <span class="text-[11px] font-semibold text-slate-400 bg-slate-100 px-1.5 rounded-full">${groups[s].length}</span>
        </div>
        <div class="flex flex-col gap-2.5">
          ${groups[s].map(cardHtml).join('')}
        </div>
      </div>`
      )
      .join('');
  }

  listEl.querySelectorAll('.aws-del').forEach((b) => {
    b.addEventListener('click', () => deleteDoc(doc(db, 'awsNotes', b.dataset.id)));
  });
  listEl.querySelectorAll('.aws-badge').forEach((b) => {
    b.addEventListener('click', () => {
      serviceFilter = b.dataset.service;
      render();
    });
  });
  const clr = document.getElementById('aws-clear-filter');
  if (clr) clr.addEventListener('click', () => { serviceFilter = null; render(); });
}
