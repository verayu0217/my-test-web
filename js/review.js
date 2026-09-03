// 複習模式（全螢幕抽卡）
import { db, doc, updateDoc } from './firebase.js';
import { speakText, localToday } from './util.js';
import { getAllVocabularies } from './vocab.js';

const reviewModal = document.getElementById('review-modal');
const reviewStartScreen = document.getElementById('review-start');
const reviewCardScreen = document.getElementById('review-card-screen');
const reviewDoneScreen = document.getElementById('review-done');
const reviewProgressBar = document.getElementById('review-progress-bar');
const reviewProgressText = document.getElementById('review-progress-text');
const reviewCard = document.getElementById('review-card');
const reviewWordEl = document.getElementById('review-word');
const reviewPosEl = document.getElementById('review-pos');
const reviewMeaningEl = document.getElementById('review-meaning');
const reviewExampleEl = document.getElementById('review-example');
const reviewBackEl = document.getElementById('review-back');
const reviewHintEl = document.getElementById('review-hint');
const reviewAnswerBtns = document.getElementById('review-answer-btns');
const reviewEmptyMsg = document.getElementById('review-empty-msg');

let reviewDeck = [];
let reviewIndex = 0;
let reviewStats = { known: 0, again: 0 };
let reviewAgainList = [];

function buildDeck(scope) {
  let pool = getAllVocabularies().slice();
  if (scope === 'due') {
    pool = pool.filter(v => v.lastReviewDate !== localToday());
  }
  pool.sort((a, b) => {
    const ra = a.reviewCount || 0, rb = b.reviewCount || 0;
    if (ra !== rb) return ra - rb;
    const da = a.lastReviewDate || '', dbb = b.lastReviewDate || '';
    return da < dbb ? -1 : da > dbb ? 1 : 0;
  });
  if (scope === 'least') pool = pool.slice(0, 20);
  return pool;
}

function showReviewScreen(which) {
  reviewStartScreen.classList.toggle('hidden', which !== 'start');
  reviewCardScreen.classList.toggle('hidden', which !== 'card');
  reviewDoneScreen.classList.toggle('hidden', which !== 'done');
}

function openReview() {
  const all = getAllVocabularies();
  reviewEmptyMsg.classList.add('hidden');
  document.getElementById('review-due-count').textContent =
    all.filter(v => v.lastReviewDate !== localToday()).length;
  document.getElementById('review-all-count').textContent = all.length;
  reviewProgressText.textContent = '';
  reviewProgressBar.style.width = '0%';
  showReviewScreen('start');
  reviewModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeReview() {
  reviewModal.classList.add('hidden');
  document.body.style.overflow = '';
}

function startReview(scope) {
  reviewDeck = buildDeck(scope);
  if (reviewDeck.length === 0) {
    reviewEmptyMsg.textContent = scope === 'due'
      ? '今天的單字都複習完了 🎉'
      : '單字庫還沒有單字。';
    reviewEmptyMsg.classList.remove('hidden');
    return;
  }
  reviewIndex = 0;
  reviewStats = { known: 0, again: 0 };
  reviewAgainList = [];
  showReviewScreen('card');
  showReviewCard();
}

function showReviewCard() {
  const item = reviewDeck[reviewIndex];
  reviewWordEl.textContent = item.word || '';
  reviewPosEl.textContent = item.pos || '';
  reviewMeaningEl.textContent = item.meaning || '';
  reviewExampleEl.textContent = item.example ? `"${item.example}"` : '';
  reviewBackEl.classList.add('hidden');
  reviewAnswerBtns.classList.add('hidden');
  reviewHintEl.classList.remove('hidden');
  reviewProgressText.textContent = `${reviewIndex + 1} / ${reviewDeck.length}`;
  reviewProgressBar.style.width = `${(reviewIndex / reviewDeck.length) * 100}%`;
}

function flipReviewCard() {
  if (!reviewBackEl.classList.contains('hidden')) return;
  reviewBackEl.classList.remove('hidden');
  reviewHintEl.classList.add('hidden');
  reviewAnswerBtns.classList.remove('hidden');
}

async function answerReview(known) {
  if (reviewBackEl.classList.contains('hidden')) return;
  const item = reviewDeck[reviewIndex];
  if (known) reviewStats.known++;
  else { reviewStats.again++; reviewAgainList.push(item); }

  const current = getAllVocabularies().find(v => v.id === item.id) || item;
  updateDoc(doc(db, "vocabularies", item.id), {
    reviewCount: (current.reviewCount || 0) + 1,
    lastReviewDate: localToday()
  }).catch(err => console.error('複習記錄失敗：', err));

  reviewIndex++;
  if (reviewIndex >= reviewDeck.length) showReviewDone();
  else showReviewCard();
}

function showReviewDone() {
  reviewProgressBar.style.width = '100%';
  reviewProgressText.textContent = `${reviewDeck.length} / ${reviewDeck.length}`;
  document.getElementById('review-done-total').textContent = reviewStats.known + reviewStats.again;
  document.getElementById('review-done-known').textContent = reviewStats.known;
  document.getElementById('review-done-again').textContent = reviewStats.again;
  document.getElementById('review-redo-again').classList.toggle('hidden', reviewAgainList.length === 0);
  showReviewScreen('done');
}

document.getElementById('start-review-btn').addEventListener('click', openReview);
document.getElementById('review-close').addEventListener('click', closeReview);
document.getElementById('review-finish').addEventListener('click', closeReview);
document.querySelectorAll('.review-scope-btn').forEach(btn => {
  btn.addEventListener('click', () => startReview(btn.dataset.scope));
});
document.getElementById('review-redo-again').addEventListener('click', () => {
  reviewDeck = reviewAgainList.slice();
  reviewIndex = 0;
  reviewStats = { known: 0, again: 0 };
  reviewAgainList = [];
  showReviewScreen('card');
  showReviewCard();
});
reviewCard.addEventListener('click', flipReviewCard);
document.getElementById('review-speak').addEventListener('click', (e) => {
  e.stopPropagation();
  if (reviewDeck[reviewIndex]) speakText(reviewDeck[reviewIndex].word);
});
document.getElementById('review-again').addEventListener('click', () => answerReview(false));
document.getElementById('review-known').addEventListener('click', () => answerReview(true));
document.addEventListener('keydown', (e) => {
  if (reviewModal.classList.contains('hidden')) return;
  if (e.key === 'Escape') { closeReview(); return; }
  if (reviewCardScreen.classList.contains('hidden')) return;
  const flipped = !reviewBackEl.classList.contains('hidden');
  if (!flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); flipReviewCard(); }
  else if (flipped && (e.key === '1' || e.key === 'ArrowLeft')) answerReview(false);
  else if (flipped && (e.key === '2' || e.key === 'ArrowRight')) answerReview(true);
});
