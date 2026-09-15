// AWS 筆記：快速記錄（服務 + 選填分類 + 內容）
// 清單 / 依服務 / 依 AWS 類型 / 非服務筆記整理，可搜尋、篩選、行內編輯
import { db, awsNotesRef, addDoc, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from './firebase.js';
import { escapeHtml } from './util.js';
import { askConfirm } from './confirm.js';

const form = document.getElementById('aws-form');
const serviceInput = document.getElementById('aws-service');
const categoryInput = document.getElementById('aws-category');
const noteInput = document.getElementById('aws-note');
const listEl = document.getElementById('aws-list');
const filterInfo = document.getElementById('aws-filter-info');
const searchInput = document.getElementById('aws-search');
const searchClear = document.getElementById('aws-search-clear');
const viewBtns = document.querySelectorAll('.aws-view-btn');

// 服務 -> AWS 官方分類（概略對照，找不到的視為非服務筆記，歸進「筆記」視圖）
// 儲存 (Storage) 跟 資料庫 (Database) 是分開的兩類：EBS/S3/EFS 這種塊狀或檔案儲存算儲存，
// RDS/Aurora/DynamoDB 這種資料庫服務算資料庫。
const SERVICE_TYPE_MAP = {
  'EC2': '運算', 'Auto Scaling': '運算', 'App Runner': '運算', 'Batch': '運算',
  'Elastic Beanstalk': '運算', 'Lightsail': '運算',
  'Fargate': '容器', 'ECS': '容器', 'EKS': '容器', 'ECR': '容器',
  'EBS': '儲存', 'S3': '儲存', 'EFS': '儲存', 'FSx': '儲存', 'Storage Gateway': '儲存', 'AWS Backup': '儲存',
  'RDS': '資料庫', 'Aurora': '資料庫', 'Aurora Serverless': '資料庫', 'DynamoDB': '資料庫',
  'ElastiCache': '資料庫', 'DocumentDB': '資料庫', 'Neptune': '資料庫', 'MemoryDB': '資料庫',
  'VPC': '網路', 'Route 53': '網路', 'CloudFront': '網路', 'API Gateway': '網路',
  'Direct Connect': '網路', 'Global Accelerator': '網路', 'PrivateLink': '網路',
  'Transit Gateway': '網路', 'ELB': '網路',
  'IAM': '安全', 'IAM Identity Center': '安全', 'Cognito': '安全', 'KMS': '安全',
  'Secrets Manager': '安全', 'ACM': '安全', 'WAF': '安全', 'Shield': '安全',
  'GuardDuty': '安全', 'Security Hub': '安全', 'Inspector': '安全', 'Macie': '安全',
  'CloudWatch': '監控', 'CloudTrail': '監控', 'X-Ray': '監控',
  'Organizations': '帳戶管理', 'Control Tower': '帳戶管理', 'Cost Explorer': '帳戶管理', 'Budgets': '帳戶管理',
  'Config': '管理與治理', 'CloudFormation': '管理與治理', 'CDK': '管理與治理',
  'Systems Manager': '管理與治理', 'Service Catalog': '管理與治理',
  'SNS': '應用整合', 'SQS': '應用整合', 'EventBridge': '應用整合', 'Step Functions': '應用整合', 'AppSync': '應用整合',
  'Kinesis': '分析', 'MSK': '分析', 'Glue': '分析', 'Athena': '分析', 'EMR': '分析',
  'OpenSearch': '分析', 'QuickSight': '分析', 'Data Firehose': '分析', 'Lake Formation': '分析', 'Redshift': '分析',
  'SageMaker': '機器學習', 'Bedrock': '機器學習', 'Comprehend': '機器學習', 'Rekognition': '機器學習', 'Textract': '機器學習',
  'CodePipeline': '開發工具', 'CodeBuild': '開發工具', 'CodeDeploy': '開發工具',
  'CodeCommit': '開發工具', 'CodeArtifact': '開發工具', 'Amplify': '開發工具',
  'SES': '客戶互動', 'Pinpoint': '客戶互動',
  'DMS': '遷移', 'Transfer Family': '遷移', 'DataSync': '遷移'
};
// 分類的中文 <-> 英文對照，「類型」視圖標題會兩個一起顯示
const TYPE_LABEL_EN = {
  '運算': 'Compute', '容器': 'Containers', '儲存': 'Storage', '資料庫': 'Database',
  '網路': 'Networking', '安全': 'Security', '監控': 'Monitoring',
  '帳戶管理': 'Account Management', '管理與治理': 'Management & Governance',
  '應用整合': 'Application Integration', '分析': 'Analytics', '機器學習': 'Machine Learning',
  '開發工具': 'Developer Tools', '客戶互動': 'Customer Engagement', '遷移': 'Migration'
};
function awsType(service) {
  return SERVICE_TYPE_MAP[service] || null;
}
// 服務名稱有沒有對到已知的 AWS 服務——對不到的（像自己打的「部屬」）就不是服務，算「筆記」
function isKnownService(service) {
  return Object.prototype.hasOwnProperty.call(SERVICE_TYPE_MAP, service);
}

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

// 編輯表單一律直向排列——卡片格寬受 grid 欄數限制，並排容易被擠壓破版
function editHtml(n) {
  return `
    <form class="aws-edit-form bg-[#2a3a4a] border border-[#FF9900]/40 rounded-xl p-3.5 flex flex-col gap-2" data-id="${n.id}">
      <input class="e-service w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-[#c25e00] focus:outline-none focus:ring-2 focus:ring-[#FF9900]" list="aws-service-list" value="${escapeHtml(n.service || '')}" placeholder="服務" required>
      <input class="e-category w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-sky-700 focus:outline-none focus:ring-2 focus:ring-[#FF9900]" list="aws-category-list" value="${escapeHtml(n.category || '')}" placeholder="分類 (選填)">
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

// items-start：避免同一 grid row 因編輯中的卡片變高，把其他卡片一起撐開變形
const GRID_CLS = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-start';
const SCROLL_CLS = 'max-h-[65vh] overflow-y-auto pr-1';

function groupSection(title, subtitle, count, items) {
  return `
    <div>
      <div class="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-white/10">
        <h3 class="text-sm font-bold text-slate-100">${escapeHtml(title)}</h3>
        ${subtitle ? `<span class="text-[11px] text-slate-500 font-medium">${escapeHtml(subtitle)}</span>` : ''}
        <span class="text-[11px] font-semibold text-slate-400 bg-white/10 px-1.5 rounded-full">${count}</span>
      </div>
      <div class="${GRID_CLS}">
        ${items.map(cardHtml).join('')}
      </div>
    </div>`;
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

  // 「類型」只看得出來是哪個 AWS 服務的筆記；「筆記」專門收沒對到已知服務的（例如自己打的「部屬」）
  let viewItems = items;
  if (view === 'type') viewItems = items.filter((n) => isKnownService(n.service));
  else if (view === 'misc') viewItems = items.filter((n) => !isKnownService(n.service));

  const chips = [];
  if (serviceFilter) chips.push(chip(`服務：${serviceFilter}`, 'aws-clear-service'));
  if (categoryFilter) chips.push(chip(`分類：${categoryFilter}`, 'aws-clear-category'));
  filterInfo.innerHTML = chips.length
    ? `<div class="flex flex-wrap items-center gap-1.5">${chips.join('')}<span class="text-slate-500">· ${viewItems.length} 筆</span></div>`
    : `${viewItems.length} 筆筆記${searchTerm ? '（符合搜尋）' : ''}`;

  if (viewItems.length === 0) {
    listEl.className = 'block';
    listEl.innerHTML = `<p class="text-center text-slate-400 text-xs py-8">${
      notes.length === 0 ? '還沒有 AWS 筆記，記一筆吧...' : '沒有符合的筆記'
    }</p>`;
  } else if (view === 'list') {
    listEl.className = `${GRID_CLS} ${SCROLL_CLS}`;
    listEl.innerHTML = viewItems.map(cardHtml).join('');
  } else {
    const groupKey = view === 'type' ? (n) => awsType(n.service) : (n) => n.service;
    const groups = {};
    viewItems.forEach((n) => {
      const key = groupKey(n);
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });
    const keys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    listEl.className = `flex flex-col gap-6 ${SCROLL_CLS}`;
    listEl.innerHTML = keys
      .map((k) => groupSection(k, view === 'type' ? TYPE_LABEL_EN[k] : '', groups[k].length, groups[k]))
      .join('');
  }

  wireEvents();
}

function wireEvents() {
  listEl.querySelectorAll('.aws-del').forEach((b) => {
    b.addEventListener('click', async () => {
      const n = notes.find((x) => x.id === b.dataset.id);
      const label = n ? `${n.service}${n.note ? '：' + n.note.slice(0, 20) : ''}` : '這筆筆記';
      if (await askConfirm(`確定要刪除「${label}」嗎？此動作無法復原。`)) {
        deleteDoc(doc(db, 'awsNotes', b.dataset.id));
      }
    });
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
