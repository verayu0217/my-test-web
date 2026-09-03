// 共用工具函式

// HTML 轉義，避免使用者輸入被當成標記
export function escapeHtml(text) {
  return text ? text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : '';
}

// 英文發音
export function speakText(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } else {
    alert("您的瀏覽器不支援語音發音。");
  }
}

// 本地日期字串 YYYY-MM-DD（不受時區影響，跨日自動更新）
export function localToday() {
  return daysFromToday(0);
}

// 從今天算起 n 天後的本地日期字串（n 可為負）
export function daysFromToday(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
