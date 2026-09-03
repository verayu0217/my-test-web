// 進入點：載入各功能模組，並處理頂部分頁切換
import './vocab.js';
import './review.js';
import './tasks.js';
import './memo.js';
import './article.js';

// ==================== 主分頁切換 (單字&分析 / Tasks / Memo) ====================
document.querySelectorAll('.main-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.maintab;
    document.querySelectorAll('.main-tab-btn').forEach(b => {
      const active = b === btn;
      b.classList.toggle('bg-indigo-600', active);
      b.classList.toggle('text-white', active);
      b.classList.toggle('text-slate-500', !active);
      b.classList.toggle('hover:bg-slate-100', !active);
    });
    document.querySelectorAll('.main-panel').forEach(p => {
      p.classList.toggle('hidden', p.id !== `main-panel-${target}`);
    });
  });
});
