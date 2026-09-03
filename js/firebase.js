// Firebase 初始化 + 匯出資料庫參照與常用 Firestore 函式
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ✅ Firebase 設定（公開沒關係，安全靠 Firestore Rules）
const firebaseConfig = {
  apiKey: "AIzaSyA0gCb7A7YPareF8esh8ct-rj955CjCPZM",
  authDomain: "my-test-db-b9117.firebaseapp.com",
  projectId: "my-test-db-b9117",
  storageBucket: "my-test-db-b9117.firebasestorage.app",
  messagingSenderId: "279887826419",
  appId: "1:279887826419:web:0b9fdbc1883533ace81686",
  measurementId: "G-EGC3BZZD3P"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const todosRef = collection(db, "todos");
export const vocabRef = collection(db, "vocabularies");
export const researchRef = collection(db, "research");

export { addDoc, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy };
