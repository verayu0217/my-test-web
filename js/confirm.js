// 共用：確認視窗（回傳 Promise<boolean>）

const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
let confirmResolver = null;

export function askConfirm(message) {
  confirmMessage.textContent = message || '確定要刪除嗎？此動作無法復原。';
  confirmModal.classList.remove('hidden');
  return new Promise((resolve) => { confirmResolver = resolve; });
}

function settleConfirm(result) {
  confirmModal.classList.add('hidden');
  if (confirmResolver) { confirmResolver(result); confirmResolver = null; }
}

document.getElementById('confirm-ok').addEventListener('click', () => settleConfirm(true));
document.getElementById('confirm-cancel').addEventListener('click', () => settleConfirm(false));
confirmModal.addEventListener('click', (e) => {
  if (e.target === confirmModal) settleConfirm(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !confirmModal.classList.contains('hidden')) settleConfirm(false);
});
