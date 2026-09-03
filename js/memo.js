// 備忘：新增 / 刪除
import { db, researchRef, addDoc, onSnapshot, doc, deleteDoc, serverTimestamp, query, orderBy } from './firebase.js';
import { escapeHtml } from './util.js';

const researchForm = document.getElementById('research-form');
const researchInput = document.getElementById('research-input');
const researchList = document.getElementById('research-list');

researchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const topic = researchInput.value.trim();
  if (!topic) return;

  try {
    await addDoc(researchRef, {
      topic,
      createdAt: serverTimestamp()
    });
    researchInput.value = '';
  } catch (err) {
    console.error("新增失敗：", err);
  }
});

onSnapshot(query(researchRef, orderBy("createdAt", "desc")), (snapshot) => {
  researchList.innerHTML = '';
  if (snapshot.docs.length === 0) {
    researchList.innerHTML = `<p class="text-center text-slate-400 text-xs w-full py-2">記錄幾筆筆記吧...</p>`;
  }

  snapshot.docs.forEach((docSnapshot) => {
    const item = docSnapshot.data();
    const id = docSnapshot.id;

    const li = document.createElement('li');
    li.className = "group inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-200/70 px-2.5 py-1 rounded-md text-xs font-semibold transition-all";

    li.innerHTML = `
      <span>${escapeHtml(item.topic)}</span>
      <button class="delete-research opacity-0 group-hover:opacity-100 text-amber-500 hover:text-rose-500 transition-all">
        <i class="fa-solid fa-xmark text-xs"></i>
      </button>
    `;

    li.querySelector('.delete-research').addEventListener('click', () => {
      deleteDoc(doc(db, "research", id));
    });
    researchList.appendChild(li);
  });
});
