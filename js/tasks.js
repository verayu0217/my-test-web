// 待辦事項：新增 / 完成切換 / 行內編輯 / 刪除
import { db, todosRef, addDoc, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from './firebase.js';
import { escapeHtml } from './util.js';

const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoDateInput = document.getElementById('todo-date');
const todoList = document.getElementById('todo-list');
const completedCountEl = document.getElementById('completed-count');
const totalCountEl = document.getElementById('total-count');

// 顯示今日日期
const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
document.getElementById('date-display').textContent = new Date().toLocaleDateString('zh-TW', dateOptions);

const todayStr = new Date().toISOString().split('T')[0];
todoDateInput.value = todayStr;

todoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();
  const dueDate = todoDateInput.value;
  if (!text || !dueDate) return;

  try {
    await addDoc(todosRef, {
      text: text,
      dueDate: dueDate,
      completed: false,
      createdAt: serverTimestamp()
    });
    todoInput.value = '';
    todoDateInput.value = todayStr;
  } catch (err) {
    console.error("新增失敗：", err);
  }
});

function getDueDateBadge(dueDateStr, isCompleted) {
  if (!dueDateStr) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dueDateStr + 'T00:00:00');
  const diffDays = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));

  let badgeClass = "text-slate-500 bg-slate-100";
  let labelText = dueDateStr;

  if (diffDays === 0) {
    labelText = "今天";
    badgeClass = "text-indigo-700 bg-indigo-100 font-semibold";
  } else if (diffDays === 1) {
    labelText = "明天";
    badgeClass = "text-sky-700 bg-sky-100 font-medium";
  } else if (diffDays < 0 && !isCompleted) {
    labelText = `已逾期`;
    badgeClass = "text-rose-600 bg-rose-100 font-bold";
  }

  return `<span class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${badgeClass}">
    ${labelText}
  </span>`;
}

onSnapshot(query(todosRef, orderBy("createdAt", "desc")), (snapshot) => {
  todoList.innerHTML = '';
  let completedCount = 0;
  const totalCount = snapshot.docs.length;

  if (totalCount === 0) {
    todoList.innerHTML = `<div class="text-center py-4 text-slate-400 text-xs"><p>無待辦事項</p></div>`;
  }

  snapshot.docs.forEach((docSnapshot) => {
    const todo = docSnapshot.data();
    const id = docSnapshot.id;
    if (todo.completed) completedCount++;

    const li = document.createElement('li');
    li.className = `group flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200/60 transition-all ${todo.completed ? 'opacity-50' : ''}`;

    function renderTodoView() {
      li.innerHTML = `
        <div class="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
          <button class="toggle-btn w-4 h-4 rounded border ${todo.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 hover:border-indigo-500'} flex items-center justify-center shrink-0 transition-colors">
            <i class="fa-solid fa-check text-[8px] ${todo.completed ? 'block' : 'hidden'}"></i>
          </button>
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-xs text-slate-800 font-medium truncate ${todo.completed ? 'line-through text-slate-400' : ''}">
              ${escapeHtml(todo.text)}
            </span>
            ${getDueDateBadge(todo.dueDate, todo.completed)}
          </div>
        </div>
        <div class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
          <button class="edit-todo text-slate-400 hover:text-indigo-500 transition-colors p-1" title="編輯">
            <i class="fa-regular fa-pen-to-square text-xs"></i>
          </button>
          <button class="delete-btn text-slate-400 hover:text-rose-500 transition-colors p-1" title="刪除">
            <i class="fa-regular fa-trash-can text-xs"></i>
          </button>
        </div>
      `;
      li.querySelector('.toggle-btn').addEventListener('click', () => updateDoc(doc(db, "todos", id), { completed: !todo.completed }));
      li.querySelector('.delete-btn').addEventListener('click', () => deleteDoc(doc(db, "todos", id)));
      li.querySelector('.edit-todo').addEventListener('click', renderTodoEdit);
    }

    function renderTodoEdit() {
      li.innerHTML = `
        <form class="todo-edit-form flex items-center gap-1.5 w-full">
          <input type="text" class="edit-text flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-800" required>
          <input type="date" class="edit-date px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer" required>
          <button type="submit" class="text-emerald-500 hover:text-emerald-600 p-1.5" title="儲存"><i class="fa-solid fa-check text-xs"></i></button>
          <button type="button" class="cancel-todo-edit text-slate-400 hover:text-slate-600 p-1.5" title="取消"><i class="fa-solid fa-xmark text-xs"></i></button>
        </form>
      `;
      const textEl = li.querySelector('.edit-text');
      const dateEl = li.querySelector('.edit-date');
      textEl.value = todo.text || '';
      dateEl.value = todo.dueDate || '';
      textEl.focus();
      li.querySelector('.todo-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = textEl.value.trim();
        const dueDate = dateEl.value;
        if (!text || !dueDate) return;
        try {
          await updateDoc(doc(db, "todos", id), { text, dueDate });
        } catch (err) {
          console.error('更新失敗：', err);
        }
        renderTodoView();
      });
      li.querySelector('.cancel-todo-edit').addEventListener('click', renderTodoView);
      textEl.addEventListener('keydown', (e) => { if (e.key === 'Escape') renderTodoView(); });
    }

    renderTodoView();
    todoList.appendChild(li);
  });

  completedCountEl.textContent = completedCount;
  totalCountEl.textContent = totalCount;
});
