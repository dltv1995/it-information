// assets/js/projects.js
// Ready-to-replace file: Projects + Fiscal Year + Section Filter + Delete permissions
// Version: projects-section-budget-allocation-visible-v24-ready

import { db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log('projects.js loaded: projects-section-budget-allocation-visible-v24-ready');
console.log('projects section budget allocation ready: visible-v24-ready');

const DEFAULT_TOTAL_BUDGET = 1500000;
const PROJECTS_COLLECTION = 'projects';
const FISCAL_YEARS_COLLECTION = 'fiscal_years';
const USERS_COLLECTION = 'users';
const BUDGET_REF = doc(db, 'settings', 'budget');
const REJECTED_AUTO_DELETE_DAYS = 30;

const SECTION_LABELS = {
  technical: 'งานเทคนิค',
  information: 'งานสารสนเทศ',
  corporate_communication: 'งานสื่อสารองค์กร'
};

const ROLE_LABELS = {
  admin: 'ผู้ดูแลระบบ',
  administrator: 'ผู้ดูแลระบบ',
  manager: 'หัวหน้าฝ่าย',
  head: 'หัวหน้าฝ่าย',
  department_head: 'หัวหน้าฝ่าย',
  head_department: 'หัวหน้าฝ่าย',
  section_head: 'หัวหน้างาน',
  supervisor: 'หัวหน้างาน',
  director: 'หัวหน้าฝ่าย',
  secretary: 'เลขาฯ',
  staff: 'เจ้าหน้าที่',
  employee: 'เจ้าหน้าที่'
};

const ALLOWED_ROLES = new Set([
  'admin', 'administrator', 'manager', 'head', 'department_head', 'head_department',
  'section_head', 'supervisor', 'director', 'teacher_head', 'deputy_director', 'principal', 'ผู้ดูแลระบบ', 'หัวหน้าฝ่าย', 'หัวหน้างาน', 'หัวหน้ากลุ่ม', 'หัวหน้าส่วน', 'ผู้อำนวยการ', 'รองผู้อำนวยการ'
]);

const CREATOR_ROLES = new Set([
  'admin', 'administrator', 'manager', 'head', 'department_head', 'head_department',
  'section_head', 'supervisor', 'director', 'secretary', 'staff', 'employee',
  'ผู้ดูแลระบบ', 'หัวหน้าฝ่าย', 'หัวหน้างาน', 'หัวหน้ากลุ่ม', 'หัวหน้าส่วน', 'ผู้อำนวยการ', 'รองผู้อำนวยการ', 'เลขาฯ', 'เจ้าหน้าที่'
]);

let currentUser = null;
let currentUserUid = null;
let isMockMode = false;
let canApprove = false;
let totalBudgetLimit = DEFAULT_TOTAL_BUDGET;
let lastApprovedBudgetTotal = 0;
let unsubscribeProjects = null;
let unsubscribeBudget = null;
let unsubscribeFiscalYears = null;
let currentActionProjectId = null;
let currentActionProject = null;
let currentEditProjectId = null;
let usersCache = [];
let fiscalYearsCache = [];
let selectedFiscalYear = localStorage.getItem('selectedFiscalYear') || getDefaultFiscalYear();
let selectedSectionFilter = localStorage.getItem('selectedProjectSectionFilter') || 'all';

window.projectsMap = new Map();

bootProjectsPage();

function bootProjectsPage() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupSharedUI();
      initAuth();
    }, { once: true });
  } else {
    setupSharedUI();
    initAuth();
  }
}

window.addEventListener('app:navigate-away', () => {
  if (unsubscribeProjects) { unsubscribeProjects(); unsubscribeProjects = null; }
  if (unsubscribeBudget) { unsubscribeBudget(); unsubscribeBudget = null; }
  if (unsubscribeFiscalYears) { unsubscribeFiscalYears(); unsubscribeFiscalYears = null; }
}, { once: true });

function setupSharedUI() {
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn && !themeToggleBtn.dataset.boundProjects) {
    themeToggleBtn.dataset.boundProjects = '1';
    themeToggleBtn.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem('color-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });
  }

  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  const sidebar = document.getElementById('sidebar');
  const mobileOverlay = document.getElementById('mobileOverlay');
  function toggleMenu() {
    if (!sidebar || !mobileOverlay) return;
    sidebar.classList.toggle('-translate-x-full');
    mobileOverlay.classList.toggle('hidden');
    setTimeout(() => mobileOverlay.classList.toggle('opacity-0'), 10);
  }
  if (mobileMenuBtn && !mobileMenuBtn.dataset.boundProjects) {
    mobileMenuBtn.dataset.boundProjects = '1';
    mobileMenuBtn.addEventListener('click', toggleMenu);
  }
  if (closeSidebarBtn && !closeSidebarBtn.dataset.boundProjects) {
    closeSidebarBtn.dataset.boundProjects = '1';
    closeSidebarBtn.addEventListener('click', toggleMenu);
  }
  if (mobileOverlay && !mobileOverlay.dataset.boundProjects) {
    mobileOverlay.dataset.boundProjects = '1';
    mobileOverlay.addEventListener('click', toggleMenu);
  }
}

async function initAuth() {
  const mockUserStr = localStorage.getItem('mockUser');
  if (mockUserStr) {
    isMockMode = true;
    currentUser = JSON.parse(mockUserStr);
    currentUserUid = currentUser.uid || 'mock-uid';
    initPage();
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    currentUserUid = user.uid;
    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      currentUser = userSnap.exists()
        ? { uid: user.uid, email: user.email, ...userSnap.data() }
        : { uid: user.uid, email: user.email, role: '' };
    } catch (error) {
      console.error('Load user profile error:', error);
      currentUser = { uid: user.uid, email: user.email, role: '' };
    }
    initPage();
  });
}

async function initPage() {
  document.getElementById('appBody')?.classList.remove('hidden');
  setupUserHeader();
  canApprove = await canApproveBudgetAndProjects();
  await loadProjectUsers();

  if (canCreateProject()) document.getElementById('createProjectBtn')?.classList.remove('hidden');

  ensureProjectFiscalYearField();
  ensureProjectDurationFields();
  ensureProjectFormButtons();
  ensureActionBudgetFields();
  ensureGlobalBudgetButtonAndModal();
  ensureFiscalYearAndFilterControls();
  updateFiscalControlsVisibility();

  if (canApprove) {
    document.getElementById('editGlobalBudgetBtn')?.classList.remove('hidden');
    document.getElementById('allocateSectionBudgetBtn')?.classList.remove('hidden');
    document.getElementById('sectionBudgetAllocationInlineWrapper')?.classList.remove('hidden');
  }

  setupProjectModal();
  setupActionModal();
  setupGlobalBudgetModal();
  listenFiscalYears();
  listenGlobalBudget();
  listenProjects();
}

function setupUserHeader() {
  setText('userName', currentUser?.name || currentUser?.email || 'ผู้ใช้งานระบบ');
  setText('userRole', getRoleLabel(currentUser?.role) || 'เจ้าหน้าที่');
  if (isAdminLike(currentUser?.role)) document.getElementById('adminMenu')?.classList.remove('hidden');
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      if (isMockMode) {
        localStorage.removeItem('mockUser');
        window.location.href = 'login.html';
        return;
      }
      signOut(auth).then(() => window.location.href = 'login.html');
    };
  }
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function isAllowedRole(role) {
  const raw = String(role || '').trim();
  const lower = normalizeRole(raw);
  return ALLOWED_ROLES.has(raw) || ALLOWED_ROLES.has(lower);
}

function isAdminLike(role) {
  const raw = String(role || '').trim();
  const lower = normalizeRole(raw);
  return raw === 'ผู้ดูแลระบบ' || lower === 'admin' || lower === 'administrator';
}

function canCreateProject() {
  const raw = String(currentUser?.role || '').trim();
  const lower = normalizeRole(raw);
  return CREATOR_ROLES.has(raw) || CREATOR_ROLES.has(lower) || true;
}

async function canApproveBudgetAndProjects() {
  if (isAllowedRole(currentUser?.role)) return true;
  try {
    if (!isMockMode && currentUserUid) {
      const overrideSnap = await getDoc(doc(db, 'user_overrides', currentUserUid));
      const override = overrideSnap.exists() ? overrideSnap.data()?.overrides?.approve_project : null;
      if (override === 'allow') return true;
      if (override === 'deny') return false;
    }
  } catch (error) {
    console.warn('Override permission check error:', error);
  }
  const visibleRole = document.getElementById('userRole')?.textContent || '';
  return isAllowedRole(visibleRole);
}

async function loadProjectUsers() {
  try {
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    usersCache.sort((a, b) => String(a.name || a.email || '').localeCompare(String(b.name || b.email || ''), 'th'));
  } catch (error) {
    console.warn('Load project users failed:', error);
    usersCache = [];
  }
}

function getSectionLabel(section) {
  return SECTION_LABELS[section] || section || '-';
}

function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || '-';
}

function getOwnerId(project) {
  return project?.ownerId || project?.createdBy || '';
}

function isProjectVisibleToCurrentUser(project) {
  if (canApprove) return true;
  return getOwnerId(project) === currentUserUid;
}

function getCurrentOwnerPayload() {
  return {
    ownerId: currentUserUid,
    ownerName: currentUser?.name || currentUser?.email || 'Unknown',
    ownerEmail: currentUser?.email || '',
    ownerSection: currentUser?.section || '',
    ownerRole: currentUser?.role || ''
  };
}

function getSelectedOwnerPayload() {
  const select = document.getElementById('projectOwnerSelect');
  const selectedId = select?.value || getOwnerId(currentActionProject) || currentUserUid;
  const user = usersCache.find(u => u.id === selectedId);
  if (user) {
    return {
      ownerId: user.id,
      ownerName: user.name || user.email || 'Unknown',
      ownerEmail: user.email || '',
      ownerSection: user.section || '',
      ownerRole: user.role || ''
    };
  }
  return {
    ownerId: selectedId,
    ownerName: currentActionProject?.ownerName || currentActionProject?.creatorName || 'Unknown',
    ownerEmail: currentActionProject?.ownerEmail || '',
    ownerSection: currentActionProject?.ownerSection || '',
    ownerRole: currentActionProject?.ownerRole || ''
  };
}

function getDefaultFiscalYear() {
  const now = new Date();
  const thaiYear = now.getFullYear() + 543;
  return String(now.getMonth() >= 9 ? thaiYear + 1 : thaiYear);
}

function getSelectedFiscalYear() {
  return selectedFiscalYear || getDefaultFiscalYear();
}


function getFiscalYearDocRef(year = getSelectedFiscalYear()) {
  return doc(db, FISCAL_YEARS_COLLECTION, String(year));
}

function getFiscalYearBudgetValue(year = getSelectedFiscalYear()) {
  const item = fiscalYearsCache.find(y => String(y.year || y.id || '') === String(year));
  const value = Number(item?.totalBudget ?? item?.budget ?? item?.budgetLimit ?? NaN);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_TOTAL_BUDGET;
}


function getCurrentFiscalYearData(year = getSelectedFiscalYear()) {
  return fiscalYearsCache.find(item => String(item.year || item.id || '') === String(year)) || null;
}

function getSectionBudgetAllocations(year = getSelectedFiscalYear()) {
  const data = getCurrentFiscalYearData(year) || {};
  const sectionBudgets = data.sectionBudgets || {};
  return {
    technical: Number(sectionBudgets.technical ?? data.technicalBudget ?? data.budgetTechnical ?? 0),
    information: Number(sectionBudgets.information ?? data.informationBudget ?? data.budgetInformation ?? 0),
    corporate_communication: Number(sectionBudgets.corporate_communication ?? data.corporateCommunicationBudget ?? data.communicationBudget ?? data.budgetCorporateCommunication ?? 0)
  };
}

function getSectionBudgetTotal(allocations = getSectionBudgetAllocations()) {
  return Number(allocations.technical || 0)
    + Number(allocations.information || 0)
    + Number(allocations.corporate_communication || 0);
}

function getSectionBudgetRemaining(allocations = getSectionBudgetAllocations()) {
  return Number(totalBudgetLimit || 0) - getSectionBudgetTotal(allocations);
}

function setSectionBudgetInputValues(allocations = getSectionBudgetAllocations()) {
  setValue('sectionBudgetTechnical', allocations.technical || '');
  setValue('sectionBudgetInformation', allocations.information || '');
  setValue('sectionBudgetCorporate', allocations.corporate_communication || '');
  updateSectionBudgetAllocationPreview();
}

function ensureFiscalYearAndFilterControls() {
  if (document.getElementById('projectFiscalControls')) return;
  const grid = document.getElementById('projectsGrid');
  const card = grid?.closest('.clean-card');
  if (!card) return;

  const controls = document.createElement('div');
  controls.id = 'projectFiscalControls';
  controls.className = 'mb-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-4 items-end';
  controls.innerHTML = `
    <div>
      <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">ปีงบประมาณ</label>
      <select id="fiscalYearFilter" class="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"></select>
    </div>
    <div id="sectionFilterWrapper" class="hidden">
      <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">กรองโครงการตามส่วนงาน</label>
      <select id="projectSectionFilter" class="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none">
        <option value="all">ทั้งหมด</option>
        <option value="information">สารสนเทศ</option>
        <option value="technical">เทคนิค</option>
        <option value="corporate_communication">สื่อสารองค์กร</option>
      </select>
    </div>
    <div id="filterApprovedTotalWrapper" class="hidden">
      <div id="filterApprovedTotalCard" class="w-full min-h-[48px] rounded-lg border px-4 py-2.5 bg-slate-50/70 dark:bg-slate-900/30 flex items-center justify-between gap-3 transition-colors duration-200">
        <div class="min-w-0">
          <div id="filterApprovedTotalLabel" class="text-xs font-bold truncate">ทั้งหมด</div>
          <div id="filterApprovedTotalHint" class="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">อนุมัติแล้ว</div>
        </div>
        <strong id="filterApprovedTotal" class="text-base font-extrabold whitespace-nowrap">0 THB</strong>
      </div>
    </div>
    <div id="sectionBudgetAllocationInlineWrapper" class="hidden">
      <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">กระจายงบส่วนงาน</label>
      <button type="button" id="sectionBudgetAllocationInlineBtn" class="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors">
        <i class="ph ph-chart-pie-slice"></i>
        <span>แบ่งงบให้ 3 ส่วนงาน</span>
      </button>
    </div>
    <div id="fiscalYearCreateWrapper" class="hidden lg:justify-self-end">
      <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">เพิ่มปีงบประมาณ</label>
      <div class="flex gap-2">
        <input type="number" id="newFiscalYearInput" placeholder="เช่น 2569" class="w-32 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none">
        <button type="button" id="addFiscalYearBtn" class="px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 dark:bg-sky-600 dark:hover:bg-sky-700 text-white text-sm font-semibold shadow-sm">สร้างปี</button>
      </div>
    </div>
  `;
  card.insertBefore(controls, grid);

  document.getElementById('fiscalYearFilter')?.addEventListener('change', (event) => {
    selectedFiscalYear = event.target.value || getDefaultFiscalYear();
    localStorage.setItem('selectedFiscalYear', selectedFiscalYear);
    populateFiscalYearSelects();
    listenGlobalBudget();
    listenProjects();
  });

  const sectionSelect = document.getElementById('projectSectionFilter');
  if (sectionSelect) {
    sectionSelect.value = selectedSectionFilter;
    sectionSelect.addEventListener('change', () => {
      selectedSectionFilter = sectionSelect.value || 'all';
      localStorage.setItem('selectedProjectSectionFilter', selectedSectionFilter);
      listenProjects();
    });
  }

  document.getElementById('addFiscalYearBtn')?.addEventListener('click', addFiscalYearFromInput);
  document.getElementById('sectionBudgetAllocationInlineBtn')?.addEventListener('click', openSectionBudgetAllocationModal);
  updateFiscalControlsVisibility();
  populateFiscalYearSelects();
}

function updateFiscalControlsVisibility() {
  document.getElementById('sectionFilterWrapper')?.classList.toggle('hidden', !canApprove);
  document.getElementById('filterApprovedTotalWrapper')?.classList.toggle('hidden', !canApprove);
  document.getElementById('sectionBudgetAllocationInlineWrapper')?.classList.toggle('hidden', !canApprove);
  document.getElementById('fiscalYearCreateWrapper')?.classList.toggle('hidden', !canApprove);
}

function ensureProjectFiscalYearField() {
  if (document.getElementById('projFiscalYear')) return;
  const budgetInput = document.getElementById('projBudget');
  const budgetWrapper = budgetInput?.closest('div');
  if (!budgetWrapper) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ปีงบประมาณ</label>
    <select id="projFiscalYear" required class="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"></select>
  `;
  budgetWrapper.insertAdjacentElement('beforebegin', wrapper);
  populateFiscalYearSelects();
}

function populateFiscalYearSelects() {
  const defaultYear = getDefaultFiscalYear();
  const years = [...new Set([defaultYear, selectedFiscalYear, ...fiscalYearsCache.map(y => String(y.year || y.id || y))])]
    .filter(Boolean)
    .sort((a, b) => Number(b) - Number(a));
  const options = years.map(y => `<option value="${escapeHtml(y)}">ปีงบประมาณ ${escapeHtml(y)}</option>`).join('');

  const fiscalYearFilter = document.getElementById('fiscalYearFilter');
  if (fiscalYearFilter) {
    fiscalYearFilter.innerHTML = options;
    fiscalYearFilter.value = selectedFiscalYear || defaultYear;
  }

  const projFiscalYear = document.getElementById('projFiscalYear');
  if (projFiscalYear) {
    const current = projFiscalYear.value || selectedFiscalYear || defaultYear;
    projFiscalYear.innerHTML = options;
    projFiscalYear.value = current;
  }
}

function refreshSectionBudgetAllocationUiIfOpen() {
  const modal = document.getElementById('sectionBudgetAllocationModal');
  if (!modal || modal.classList.contains('hidden')) return;
  setSectionBudgetInputValues();
}

function listenFiscalYears() {
  if (unsubscribeFiscalYears) unsubscribeFiscalYears();
  unsubscribeFiscalYears = onSnapshot(collection(db, FISCAL_YEARS_COLLECTION), (snapshot) => {
    fiscalYearsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!fiscalYearsCache.length) fiscalYearsCache = [{ id: getDefaultFiscalYear(), year: getDefaultFiscalYear(), totalBudget: DEFAULT_TOTAL_BUDGET }];
    populateFiscalYearSelects();
    refreshSectionBudgetAllocationUiIfOpen();
  }, (error) => {
    console.warn('Fiscal year listener error:', error);
    fiscalYearsCache = [{ id: getDefaultFiscalYear(), year: getDefaultFiscalYear(), totalBudget: DEFAULT_TOTAL_BUDGET }];
    populateFiscalYearSelects();
  });
}

async function addFiscalYearFromInput() {
  if (!canApprove) return alert('บัญชีนี้ไม่มีสิทธิ์สร้างปีงบประมาณ');
  const input = document.getElementById('newFiscalYearInput');
  const year = String(input?.value || '').trim();
  if (!/^\d{4}$/.test(year)) return alert('กรุณาระบุปีงบประมาณเป็นตัวเลข 4 หลัก เช่น 2569');
  try {
    await setDoc(doc(db, FISCAL_YEARS_COLLECTION, year), {
      year,
      label: `ปีงบประมาณ ${year}`,
      totalBudget: Number(totalBudgetLimit || DEFAULT_TOTAL_BUDGET),
      sectionBudgets: { technical: 0, information: 0, corporate_communication: 0 },
      sectionBudgetTotal: 0,
      sectionBudgetRemaining: Number(totalBudgetLimit || DEFAULT_TOTAL_BUDGET),
      createdBy: currentUserUid,
      createdByName: currentUser?.name || currentUser?.email || 'Unknown',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    selectedFiscalYear = year;
    localStorage.setItem('selectedFiscalYear', selectedFiscalYear);
    if (input) input.value = '';
    populateFiscalYearSelects();
    listenGlobalBudget();
    listenProjects();
  } catch (error) {
    console.error('Add fiscal year error:', error);
    alert(`สร้างปีงบประมาณไม่สำเร็จ: ${error.code || error.message || error}`);
  }
}

function projectMatchesFiscalYear(project) {
  const targetYear = getSelectedFiscalYear();
  const projectYear = String(project.fiscalYear || targetYear);
  return projectYear === targetYear;
}

function projectMatchesSectionFilter(project) {
  if (!canApprove) return true;
  if (!selectedSectionFilter || selectedSectionFilter === 'all') return true;
  return String(project.ownerSection || project.section || '') === selectedSectionFilter;
}

function ensureOwnerSelectField() {
  if (!canApprove) return;
  if (document.getElementById('projectOwnerSelect')) return;
  const approveBudget = document.getElementById('approveBudget');
  const target = approveBudget?.closest('div');
  if (!target) return;
  const wrapper = document.createElement('div');
  wrapper.id = 'projectOwnerSelectWrapper';
  wrapper.innerHTML = `
    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ผู้รับผิดชอบโครงการ</label>
    <select id="projectOwnerSelect" class="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"></select>
    <div class="mt-3 flex justify-end">
      <button type="button" id="btnUpdateOwnerOnly" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/50 text-xs font-semibold transition-colors">
        <i class="ph ph-user-switch"></i><span>บันทึกผู้รับผิดชอบ</span>
      </button>
    </div>
    <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">แอดมิน/หัวหน้าสามารถเปลี่ยนผู้รับผิดชอบได้ รายการจะย้ายไปอยู่กับผู้ใช้ใหม่ โดยไม่จำเป็นต้องกดอนุมัติซ้ำ</p>
  `;
  target.insertAdjacentElement('beforebegin', wrapper);
}

function populateOwnerSelect(project) {
  const select = document.getElementById('projectOwnerSelect');
  const wrapper = document.getElementById('projectOwnerSelectWrapper');
  if (wrapper) wrapper.classList.toggle('hidden', !canApprove);
  if (!select) return;
  const currentOwnerId = getOwnerId(project);
  const options = usersCache.map(u => {
    const label = `${u.name || u.email || 'Unknown'} • ${getSectionLabel(u.section)} • ${getRoleLabel(u.role)}`;
    return `<option value="${escapeHtml(u.id)}">${escapeHtml(label)}</option>`;
  }).join('');
  select.innerHTML = options || `<option value="${escapeHtml(currentOwnerId)}">${escapeHtml(project.ownerName || project.creatorName || 'Unknown')}</option>`;
  select.value = currentOwnerId || currentUserUid;
}

function ensureProjectDurationFields() {
  if (document.getElementById('projNoDeadline')) return;
  const budgetInput = document.getElementById('projBudget');
  const budgetWrapper = budgetInput?.closest('div');
  if (!budgetWrapper) return;
  const box = document.createElement('div');
  box.className = 'space-y-4';
  box.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">วันที่เริ่มต้น</label>
        <input type="date" id="projStartDate" class="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none">
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">วันที่สิ้นสุด</label>
        <input type="date" id="projEndDate" class="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none">
      </div>
    </div>
    <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 select-none">
      <input type="checkbox" id="projNoDeadline" class="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500">
      <span>ไม่มีกำหนดเวลา</span>
    </label>
  `;
  budgetWrapper.insertAdjacentElement('afterend', box);
  document.getElementById('projNoDeadline')?.addEventListener('change', toggleProjectDates);
}

function ensureProjectFormButtons() {
  const saveBtn = document.getElementById('saveProjectBtn');
  if (!saveBtn) return;
  saveBtn.dataset.action = 'draft';
  const span = saveBtn.querySelector('span');
  if (span) span.textContent = 'บันทึกร่าง';
  let existingSubmitBtn = document.getElementById('submitProjectNowBtn');
  if (existingSubmitBtn) {
    if (!existingSubmitBtn.dataset.bound) {
      existingSubmitBtn.dataset.bound = '1';
      existingSubmitBtn.addEventListener('click', () => submitProjectForm('pending'));
    }
    return;
  }
  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.id = 'submitProjectNowBtn';
  submitBtn.className = 'px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center';
  submitBtn.innerHTML = '<span>บันทึกและส่ง</span>';
  submitBtn.addEventListener('click', () => submitProjectForm('pending'));
  saveBtn.insertAdjacentElement('afterend', submitBtn);
}

function toggleProjectDates() {
  const checked = document.getElementById('projNoDeadline')?.checked;
  const start = document.getElementById('projStartDate');
  const end = document.getElementById('projEndDate');
  if (start) { start.disabled = Boolean(checked); if (checked) start.value = ''; }
  if (end) { end.disabled = Boolean(checked); if (checked) end.value = ''; }
}

function ensureActionBudgetFields() {
  if (document.getElementById('approveBudget')) return;
  const actionProjName = document.getElementById('actionProjName');
  const buttonRow = document.getElementById('btnRejectProj')?.parentElement;
  if (!actionProjName || !buttonRow) return;
  const box = document.createElement('div');
  box.className = 'text-left space-y-4 my-5';
  box.innerHTML = `
    <div class="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-4 space-y-2">
      <div><div class="text-xs text-slate-500 dark:text-slate-400 mb-1">งบประมาณที่ผู้เสนอขอ</div><div class="font-bold text-brand-600 dark:text-sky-400"><span id="actionRequestedBudget">0</span> THB</div></div>
      <div><div class="text-xs text-slate-500 dark:text-slate-400 mb-1">ระยะเวลาโครงการ</div><div class="font-medium text-slate-700 dark:text-slate-200" id="actionProjectDuration">-</div></div>
    </div>
    <div>
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">งบประมาณที่หัวหน้าอนุมัติ / ปรับแก้ (บาท)</label>
      <input type="number" id="approveBudget" min="0" step="1000" class="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none">
    </div>
    <div>
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">คอมเมนต์ถึงเจ้าหน้าที่</label>
      <textarea id="approveNote" rows="3" placeholder="ใช้เมื่อขอแก้ไขหรือแจ้งเหตุผลไม่อนุมัติ" class="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"></textarea>
    </div>
  `;
  buttonRow.insertAdjacentElement('beforebegin', box);
  const approveBtn = document.getElementById('btnApproveProj');
  const rejectBtn = document.getElementById('btnRejectProj');
  if (approveBtn) approveBtn.textContent = 'อนุมัติ';
  if (rejectBtn) rejectBtn.textContent = 'ไม่อนุมัติ';
  if (!document.getElementById('btnRequestEditProj')) {
    const requestEditBtn = document.createElement('button');
    requestEditBtn.id = 'btnRequestEditProj';
    requestEditBtn.type = 'button';
    requestEditBtn.className = 'px-4 py-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 font-medium transition-colors';
    requestEditBtn.textContent = 'ขอแก้ไข';
    requestEditBtn.addEventListener('click', () => requestEditProject(closeActionModal));
    rejectBtn?.insertAdjacentElement('afterend', requestEditBtn);
  }
}

function ensureGlobalBudgetButtonAndModal() {
  ensureGlobalBudgetButton();
  ensureGlobalBudgetModal();
  ensureSectionBudgetAllocationModal();
}

function ensureGlobalBudgetButton() {
  if (document.getElementById('editGlobalBudgetBtn')) return;
  const title = findBudgetTitle();
  if (!title) return;
  title.id = 'globalBudgetTitle';
  const row = document.createElement('div');
  row.id = 'globalBudgetTitleRow';
  row.className = 'relative z-10 flex justify-between items-start gap-4 flex-wrap mb-6';
  const parent = title.parentElement;
  parent.insertBefore(row, title);
  row.appendChild(title);
  title.classList.remove('mb-6');
  const btn = document.createElement('button');
  btn.id = 'editGlobalBudgetBtn';
  btn.type = 'button';
  btn.className = 'hidden inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm transition-colors';
  btn.innerHTML = '<i class="ph ph-pencil-simple"></i><span>แก้งบรวม</span>';
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'flex flex-wrap gap-2 justify-end';
  buttonGroup.appendChild(btn);

  const allocateBtn = document.createElement('button');
  allocateBtn.id = 'allocateSectionBudgetBtn';
  allocateBtn.type = 'button';
  allocateBtn.className = 'hidden inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors';
  allocateBtn.innerHTML = '<i class="ph ph-chart-pie-slice"></i><span>กระจายงบส่วนงาน</span>';
  buttonGroup.appendChild(allocateBtn);

  row.appendChild(buttonGroup);
}

function findBudgetTitle() {
  const idEl = document.getElementById('globalBudgetTitle');
  if (idEl) return idEl;
  return Array.from(document.querySelectorAll('h1,h2,h3,h4,p,div'))
    .find(el => String(el.textContent || '').includes('ภาพรวมงบประมาณ')) || null;
}

function ensureGlobalBudgetModal() {
  if (document.getElementById('globalBudgetModal')) return;
  const modal = document.createElement('div');
  modal.id = 'globalBudgetModal';
  modal.className = 'fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-[90] hidden flex items-center justify-center p-4 opacity-0 transition-opacity duration-300';
  modal.innerHTML = `
    <div id="globalBudgetModalContent" class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden transform scale-95 transition-transform duration-300">
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
        <h3 class="text-lg font-bold text-slate-800 dark:text-white">แก้ไขงบประมาณรวมฝ่าย</h3>
        <button id="closeGlobalBudgetModalBtn" class="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"><i class="ph ph-x text-xl"></i></button>
      </div>
      <div class="p-6 space-y-4">
        <div id="globalBudgetError" class="hidden bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg border border-red-100 dark:border-red-800/50"></div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">งบประมาณรวมของปีงบประมาณที่เลือก (บาท)</label>
          <input type="number" id="globalBudgetInput" min="0" step="1000" class="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none">
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400">บันทึกที่ Firestore: <code>fiscal_years/{ปี}.totalBudget</code></p>
        <div class="pt-2 flex justify-end gap-3">
          <button type="button" id="cancelGlobalBudgetBtn" class="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">ยกเลิก</button>
          <button type="button" id="saveGlobalBudgetBtn" class="px-5 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"><span>บันทึกงบรวม</span><span id="saveGlobalBudgetSpinner" class="hidden inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span></button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}


function ensureSectionBudgetAllocationModal() {
  if (document.getElementById('sectionBudgetAllocationModal')) return;
  const modal = document.createElement('div');
  modal.id = 'sectionBudgetAllocationModal';
  modal.className = 'fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-[91] hidden flex items-center justify-center p-4 opacity-0 transition-opacity duration-300';
  modal.innerHTML = `
    <div id="sectionBudgetAllocationModalContent" class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 overflow-hidden transform scale-95 transition-transform duration-300">
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
        <div>
          <h3 class="text-lg font-bold text-slate-800 dark:text-white">กระจายงบประมาณไปยังส่วนงาน</h3>
          <p id="sectionBudgetAllocationSubtitle" class="text-xs text-slate-500 dark:text-slate-400 mt-1">กำหนดวงเงินของแต่ละส่วนงาน โดยไม่เปลี่ยนงบรวมทั้งฝ่าย</p>
        </div>
        <button id="closeSectionBudgetAllocationModalBtn" class="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"><i class="ph ph-x text-xl"></i></button>
      </div>
      <div class="p-6 space-y-5">
        <div id="sectionBudgetAllocationError" class="hidden bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg border border-red-100 dark:border-red-800/50"></div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
            <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">งบรวมที่ได้รับ</div>
            <div id="sectionBudgetGrandTotal" class="text-xl font-extrabold text-slate-900 dark:text-white">0 THB</div>
          </div>
          <div class="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-900/20 p-4">
            <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">กระจายแล้ว</div>
            <div id="sectionBudgetAllocatedTotal" class="text-xl font-extrabold text-sky-600 dark:text-sky-300">0 THB</div>
          </div>
          <div class="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/20 p-4">
            <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">ยังไม่กระจาย</div>
            <div id="sectionBudgetRemainingTotal" class="text-xl font-extrabold text-emerald-600 dark:text-emerald-300">0 THB</div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-semibold text-blue-600 dark:text-blue-300 mb-1">งานเทคนิค</label>
            <input type="number" id="sectionBudgetTechnical" min="0" step="1000" class="w-full px-4 py-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0">
          </div>
          <div>
            <label class="block text-sm font-semibold text-emerald-600 dark:text-emerald-300 mb-1">งานสารสนเทศ</label>
            <input type="number" id="sectionBudgetInformation" min="0" step="1000" class="w-full px-4 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0">
          </div>
          <div>
            <label class="block text-sm font-semibold text-amber-600 dark:text-amber-300 mb-1">งานสื่อสารองค์กร</label>
            <input type="number" id="sectionBudgetCorporate" min="0" step="1000" class="w-full px-4 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none" placeholder="0">
          </div>
        </div>

        <div class="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 p-4 text-xs text-slate-500 dark:text-slate-400">
          ระบบจะบันทึกไว้ที่ <code>fiscal_years/{ปี}.sectionBudgets</code> โดยยอดงบรวม <code>totalBudget</code> ยังอยู่เหมือนเดิม
        </div>

        <div class="pt-2 flex justify-end gap-3">
          <button type="button" id="cancelSectionBudgetAllocationBtn" class="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">ยกเลิก</button>
          <button type="button" id="saveSectionBudgetAllocationBtn" class="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"><span>บันทึกการกระจายงบ</span><span id="saveSectionBudgetAllocationSpinner" class="hidden inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span></button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  ['sectionBudgetTechnical', 'sectionBudgetInformation', 'sectionBudgetCorporate'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateSectionBudgetAllocationPreview);
  });
}

function openSectionBudgetAllocationModal() {
  ensureSectionBudgetAllocationModal();
  const modal = document.getElementById('sectionBudgetAllocationModal');
  const content = document.getElementById('sectionBudgetAllocationModalContent');
  const error = document.getElementById('sectionBudgetAllocationError');
  const subtitle = document.getElementById('sectionBudgetAllocationSubtitle');
  if (subtitle) subtitle.textContent = `ปีงบประมาณ ${getSelectedFiscalYear()} • งบรวมยังคงอยู่ที่ ${formatNumber(totalBudgetLimit)} บาท`;
  error?.classList.add('hidden');
  setSectionBudgetInputValues();
  modal.classList.remove('hidden');
  setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
}

function closeSectionBudgetAllocationModal() {
  const modal = document.getElementById('sectionBudgetAllocationModal');
  const content = document.getElementById('sectionBudgetAllocationModalContent');
  if (!modal || !content) return;
  modal.classList.add('opacity-0');
  content.classList.add('scale-95');
  setTimeout(() => modal.classList.add('hidden'), 250);
}

function updateSectionBudgetAllocationPreview() {
  const allocations = {
    technical: Number(document.getElementById('sectionBudgetTechnical')?.value || 0),
    information: Number(document.getElementById('sectionBudgetInformation')?.value || 0),
    corporate_communication: Number(document.getElementById('sectionBudgetCorporate')?.value || 0)
  };
  const allocated = getSectionBudgetTotal(allocations);
  const remaining = Number(totalBudgetLimit || 0) - allocated;
  setText('sectionBudgetGrandTotal', `${formatNumber(totalBudgetLimit)} THB`);
  setText('sectionBudgetAllocatedTotal', `${formatNumber(allocated)} THB`);
  setText('sectionBudgetRemainingTotal', `${formatNumber(remaining)} THB`);
  const remainingEl = document.getElementById('sectionBudgetRemainingTotal');
  if (remainingEl) {
    remainingEl.className = remaining < 0
      ? 'text-xl font-extrabold text-red-600 dark:text-red-300'
      : 'text-xl font-extrabold text-emerald-600 dark:text-emerald-300';
  }
}

async function saveSectionBudgetAllocation() {
  if (!canApprove) return showSectionBudgetAllocationError('บัญชีนี้ไม่มีสิทธิ์กระจายงบประมาณ');
  const allocations = {
    technical: Number(document.getElementById('sectionBudgetTechnical')?.value || 0),
    information: Number(document.getElementById('sectionBudgetInformation')?.value || 0),
    corporate_communication: Number(document.getElementById('sectionBudgetCorporate')?.value || 0)
  };
  if (Object.values(allocations).some(value => !Number.isFinite(value) || value < 0)) {
    return showSectionBudgetAllocationError('กรุณาระบุจำนวนงบเป็นตัวเลขที่ไม่ติดลบ');
  }
  const allocated = getSectionBudgetTotal(allocations);
  const remaining = Number(totalBudgetLimit || 0) - allocated;
  if (remaining < 0) {
    return showSectionBudgetAllocationError(`ยอดกระจายงบเกินงบรวม ${formatNumber(Math.abs(remaining))} บาท`);
  }
  const saveBtn = document.getElementById('saveSectionBudgetAllocationBtn');
  const spinner = document.getElementById('saveSectionBudgetAllocationSpinner');
  try {
    if (saveBtn) saveBtn.disabled = true;
    spinner?.classList.remove('hidden');
    const year = String(getSelectedFiscalYear());
    await setDoc(getFiscalYearDocRef(year), {
      year,
      label: `ปีงบประมาณ ${year}`,
      totalBudget: Number(totalBudgetLimit || 0),
      sectionBudgets: allocations,
      sectionBudgetTotal: allocated,
      sectionBudgetRemaining: remaining,
      sectionBudgetUpdatedBy: currentUserUid,
      sectionBudgetUpdatedByName: currentUser?.name || currentUser?.email || 'Unknown',
      sectionBudgetUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    closeSectionBudgetAllocationModal();
  } catch (error) {
    console.error('Save section budget allocation error:', error);
    showSectionBudgetAllocationError(`บันทึกการกระจายงบไม่สำเร็จ: ${error.code || error.message || error}`);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    spinner?.classList.add('hidden');
  }
}

function showSectionBudgetAllocationError(message) {
  const error = document.getElementById('sectionBudgetAllocationError');
  if (!error) return alert(message);
  error.textContent = message;
  error.classList.remove('hidden');
}

function setupProjectModal() {
  const modal = document.getElementById('projectModal');
  const content = document.getElementById('projectModalContent');
  const form = document.getElementById('projectForm');
  function toggle(show, project = null) {
    if (!modal || !content || !form) return;
    if (show) {
      ensureProjectFiscalYearField();
      ensureProjectDurationFields();
      ensureProjectFormButtons();
      fillProjectForm(project);
      modal.classList.remove('hidden');
      setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
    } else {
      modal.classList.add('opacity-0');
      content.classList.add('scale-95');
      setTimeout(() => modal.classList.add('hidden'), 250);
      currentEditProjectId = null;
      form.reset();
      document.getElementById('projectModalError')?.classList.add('hidden');
      const start = document.getElementById('projStartDate');
      const end = document.getElementById('projEndDate');
      if (start) start.disabled = false;
      if (end) end.disabled = false;
    }
  }
  window.openProjectDraftModal = () => toggle(true, null);
  window.openProjectEditModal = (id) => {
    const project = window.projectsMap.get(id);
    if (!project) return;
    toggle(true, project);
  };
  document.getElementById('createProjectBtn')?.addEventListener('click', () => toggle(true, null));
  document.getElementById('closeProjectModalBtn')?.addEventListener('click', () => toggle(false));
  document.getElementById('cancelProjectModalBtn')?.addEventListener('click', () => toggle(false));
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitProjectForm('draft');
  });
}

function fillProjectForm(project) {
  currentEditProjectId = project?.id || null;
  setValue('projTitle', project?.title || '');
  setValue('projDesc', project?.description || '');
  setValue('projBudget', project?.requestedBudget || '');
  setValue('projFiscalYear', project?.fiscalYear || getSelectedFiscalYear());
  setValue('projStartDate', project?.startDate || '');
  setValue('projEndDate', project?.endDate || '');
  const noDeadline = document.getElementById('projNoDeadline');
  if (noDeadline) noDeadline.checked = Boolean(project?.noDeadline);
  toggleProjectDates();
}

async function submitProjectForm(nextStatus) {
  const errorEl = document.getElementById('projectModalError');
  const saveBtn = document.getElementById('saveProjectBtn');
  const submitBtn = document.getElementById('submitProjectNowBtn');
  const spinner = document.getElementById('saveProjectSpinner');
  errorEl?.classList.add('hidden');
  if (saveBtn) saveBtn.disabled = true;
  if (submitBtn) submitBtn.disabled = true;
  spinner?.classList.remove('hidden');

  const title = document.getElementById('projTitle')?.value.trim();
  const description = document.getElementById('projDesc')?.value.trim();
  const requestedBudget = Number(document.getElementById('projBudget')?.value || 0);
  const fiscalYear = document.getElementById('projFiscalYear')?.value || getSelectedFiscalYear();
  const noDeadline = Boolean(document.getElementById('projNoDeadline')?.checked);
  const startDate = document.getElementById('projStartDate')?.value || '';
  const endDate = document.getElementById('projEndDate')?.value || '';

  if (!title || !description || requestedBudget < 0) {
    showFormError(errorEl, 'กรุณากรอกข้อมูลให้ครบถ้วน และงบประมาณต้องไม่ติดลบ');
    resetSubmit(saveBtn, submitBtn, spinner);
    return;
  }
  if (!fiscalYear) {
    showFormError(errorEl, 'กรุณาเลือกปีงบประมาณ');
    resetSubmit(saveBtn, submitBtn, spinner);
    return;
  }
  if (!noDeadline && (!startDate || !endDate)) {
    showFormError(errorEl, 'กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุด หรือเลือกไม่มีกำหนดเวลา');
    resetSubmit(saveBtn, submitBtn, spinner);
    return;
  }
  if (!noDeadline && startDate > endDate) {
    showFormError(errorEl, 'วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น');
    resetSubmit(saveBtn, submitBtn, spinner);
    return;
  }

  const basePayload = {
    title,
    name: title,
    description,
    requestedBudget,
    fiscalYear,
    noDeadline,
    startDate: noDeadline ? null : startDate,
    endDate: noDeadline ? null : endDate,
    durationLabel: noDeadline ? 'ไม่มีกำหนดเวลา' : formatProjectDuration(startDate, endDate),
    updatedAt: serverTimestamp()
  };

  try {
    if (currentEditProjectId) {
      const existing = window.projectsMap.get(currentEditProjectId);
      await updateDoc(doc(db, PROJECTS_COLLECTION, currentEditProjectId), {
        ...basePayload,
        status: nextStatus,
        submittedAt: nextStatus === 'pending' ? serverTimestamp() : (existing?.submittedAt || null),
        revisionResolvedAt: existing?.status === 'revision_requested' && nextStatus === 'pending' ? serverTimestamp() : null
      });
    } else {
      await addDoc(collection(db, PROJECTS_COLLECTION), {
        ...basePayload,
        budgetAllocated: 0,
        budgetSpent: 0,
        totalBudget: 0,
        usedBudget: 0,
        progress: 0,
        code: 'งา',
        accent: '#3b82f6',
        status: nextStatus,
        createdBy: currentUserUid,
        creatorName: currentUser?.name || currentUser?.email || 'Unknown',
        ...getCurrentOwnerPayload(),
        createdAt: serverTimestamp(),
        submittedAt: nextStatus === 'pending' ? serverTimestamp() : null
      });
    }
    closeProjectModal();
  } catch (error) {
    console.error('Save project error:', error);
    showFormError(errorEl, `เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${error.code || error.message || error}`);
  } finally {
    resetSubmit(saveBtn, submitBtn, spinner);
  }
}

function closeProjectModal() {
  const modal = document.getElementById('projectModal');
  const content = document.getElementById('projectModalContent');
  const form = document.getElementById('projectForm');
  if (!modal || !content) return;
  modal.classList.add('opacity-0');
  content.classList.add('scale-95');
  setTimeout(() => modal.classList.add('hidden'), 250);
  currentEditProjectId = null;
  form?.reset();
}

function resetSubmit(saveBtn, submitBtn, spinner) {
  if (saveBtn) saveBtn.disabled = false;
  if (submitBtn) submitBtn.disabled = false;
  spinner?.classList.add('hidden');
}

function setupActionModal() {
  const modal = document.getElementById('actionModal');
  const content = document.getElementById('actionModalContent');
  window.openActionModal = (id) => {
    ensureActionBudgetFields();
    ensureOwnerSelectField();
    const updateOwnerOnlyBtn = document.getElementById('btnUpdateOwnerOnly');
    if (updateOwnerOnlyBtn && !updateOwnerOnlyBtn.dataset.bound) {
      updateOwnerOnlyBtn.dataset.bound = '1';
      updateOwnerOnlyBtn.addEventListener('click', updateProjectOwnerOnly);
    }
    const project = window.projectsMap.get(id);
    if (!project) return;
    currentActionProjectId = id;
    currentActionProject = project;
    setText('actionProjName', project.title || project.name || 'ไม่ระบุชื่อโครงการ');
    setText('actionRequestedBudget', formatNumber(project.requestedBudget || 0));
    setText('actionProjectDuration', project.durationLabel || getProjectDurationText(project));
    const approveBudget = document.getElementById('approveBudget');
    if (approveBudget) approveBudget.value = Number(project.totalBudget || project.budgetAllocated || project.requestedBudget || 0);
    const note = document.getElementById('approveNote');
    if (note) note.value = project.managerComment || project.approveNote || '';
    populateOwnerSelect(project);
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
  };
  window.closeActionModal = closeActionModal;
  document.getElementById('closeActionModal')?.addEventListener('click', closeActionModal);
  document.getElementById('btnApproveProj')?.addEventListener('click', () => approveProject(closeActionModal));
  document.getElementById('btnRejectProj')?.addEventListener('click', () => rejectProject(closeActionModal));
  document.getElementById('btnRequestEditProj')?.addEventListener('click', () => requestEditProject(closeActionModal));
}

function closeActionModal() {
  const modal = document.getElementById('actionModal');
  const content = document.getElementById('actionModalContent');
  if (!modal || !content) return;
  modal.classList.add('opacity-0');
  content.classList.add('scale-95');
  setTimeout(() => modal.classList.add('hidden'), 250);
  currentActionProjectId = null;
  currentActionProject = null;
}

async function updateProjectOwnerOnly() {
  if (!currentActionProjectId) return;
  if (!canApprove) return alert('บัญชีนี้ไม่มีสิทธิ์เปลี่ยนผู้รับผิดชอบโครงการ');
  const ownerPayload = getSelectedOwnerPayload();
  const oldOwnerId = getOwnerId(currentActionProject);
  if (!ownerPayload.ownerId) return alert('กรุณาเลือกผู้รับผิดชอบโครงการ');
  if (ownerPayload.ownerId === oldOwnerId) return alert('ผู้รับผิดชอบโครงการเป็นคนเดิมอยู่แล้ว');
  try {
    await updateDoc(doc(db, PROJECTS_COLLECTION, currentActionProjectId), {
      ...ownerPayload,
      updatedAt: serverTimestamp()
    });
    currentActionProject = { ...currentActionProject, ...ownerPayload };
    alert('บันทึกผู้รับผิดชอบโครงการเรียบร้อยแล้ว');
  } catch (error) {
    console.error('Update owner error:', error);
    alert(`อัปเดตผู้รับผิดชอบไม่สำเร็จ: ${error.code || error.message || error}`);
  }
}

async function approveProject(closeModal) {
  if (!currentActionProjectId) return;
  if (!canApprove) return alert('บัญชีนี้ไม่มีสิทธิ์อนุมัติหรือแก้งบประมาณ');
  const budget = Number(document.getElementById('approveBudget')?.value || 0);
  const comment = document.getElementById('approveNote')?.value.trim() || '';
  const ownerPayload = getSelectedOwnerPayload();
  if (budget < 0) return alert('งบประมาณต้องไม่ติดลบ');
  try {
    await updateDoc(doc(db, PROJECTS_COLLECTION, currentActionProjectId), {
      status: 'approved',
      budgetAllocated: budget,
      totalBudget: budget,
      usedBudget: Number(currentActionProject?.usedBudget || currentActionProject?.budgetSpent || 0),
      approverId: currentUserUid,
      approverName: currentUser?.name || currentUser?.email || 'Unknown',
      ...ownerPayload,
      managerComment: comment,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      rejectedAt: null,
      autoDeleteAt: null
    });
    closeModal();
  } catch (error) {
    console.error('Approve error:', error);
    alert(`อัปเดตไม่สำเร็จ: ${error.code || error.message || error}`);
  }
}

async function rejectProject(closeModal) {
  if (!currentActionProjectId) return;
  if (!canApprove) return alert('บัญชีนี้ไม่มีสิทธิ์ไม่อนุมัติโครงการ');
  const comment = document.getElementById('approveNote')?.value.trim() || '';
  const ownerPayload = getSelectedOwnerPayload();
  try {
    const rejectedAtDate = new Date();
    const autoDeleteAtDate = addDays(rejectedAtDate, REJECTED_AUTO_DELETE_DAYS);
    await updateDoc(doc(db, PROJECTS_COLLECTION, currentActionProjectId), {
      status: 'rejected',
      totalBudget: 0,
      budgetAllocated: 0,
      approverId: currentUserUid,
      approverName: currentUser?.name || currentUser?.email || 'Unknown',
      ...ownerPayload,
      managerComment: comment,
      rejectedAt: serverTimestamp(),
      autoDeleteAt: autoDeleteAtDate,
      updatedAt: serverTimestamp()
    });
    closeModal();
  } catch (error) {
    console.error('Reject error:', error);
    alert(`อัปเดตไม่สำเร็จ: ${error.code || error.message || error}`);
  }
}

async function requestEditProject(closeModal) {
  if (!currentActionProjectId) return;
  if (!canApprove) return alert('บัญชีนี้ไม่มีสิทธิ์ขอแก้ไขโครงการ');
  const comment = document.getElementById('approveNote')?.value.trim() || '';
  const ownerPayload = getSelectedOwnerPayload();
  if (!comment) return alert('กรุณาใส่คอมเมนต์เพื่อแจ้งเจ้าหน้าที่ว่าต้องแก้ไขอะไร');
  try {
    await updateDoc(doc(db, PROJECTS_COLLECTION, currentActionProjectId), {
      status: 'revision_requested',
      ...ownerPayload,
      managerComment: comment,
      revisionRequestedBy: currentUserUid,
      revisionRequestedByName: currentUser?.name || currentUser?.email || 'Unknown',
      revisionRequestedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      rejectedAt: null,
      autoDeleteAt: null
    });
    closeModal();
  } catch (error) {
    console.error('Request edit error:', error);
    alert(`อัปเดตไม่สำเร็จ: ${error.code || error.message || error}`);
  }
}

function setupGlobalBudgetModal() {
  document.getElementById('editGlobalBudgetBtn')?.addEventListener('click', openGlobalBudgetModal);
  document.getElementById('allocateSectionBudgetBtn')?.addEventListener('click', openSectionBudgetAllocationModal);
  document.getElementById('sectionBudgetAllocationInlineBtn')?.addEventListener('click', openSectionBudgetAllocationModal);
  document.getElementById('closeGlobalBudgetModalBtn')?.addEventListener('click', closeGlobalBudgetModal);
  document.getElementById('cancelGlobalBudgetBtn')?.addEventListener('click', closeGlobalBudgetModal);
  document.getElementById('saveGlobalBudgetBtn')?.addEventListener('click', saveGlobalBudget);
  document.getElementById('closeSectionBudgetAllocationModalBtn')?.addEventListener('click', closeSectionBudgetAllocationModal);
  document.getElementById('cancelSectionBudgetAllocationBtn')?.addEventListener('click', closeSectionBudgetAllocationModal);
  document.getElementById('saveSectionBudgetAllocationBtn')?.addEventListener('click', saveSectionBudgetAllocation);
}

function openGlobalBudgetModal() {
  ensureGlobalBudgetModal();
  const modal = document.getElementById('globalBudgetModal');
  const content = document.getElementById('globalBudgetModalContent');
  const input = document.getElementById('globalBudgetInput');
  const error = document.getElementById('globalBudgetError');
  if (input) input.value = Number(totalBudgetLimit || DEFAULT_TOTAL_BUDGET);
  error?.classList.add('hidden');
  modal.classList.remove('hidden');
  setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }, 10);
}

function closeGlobalBudgetModal() {
  const modal = document.getElementById('globalBudgetModal');
  const content = document.getElementById('globalBudgetModalContent');
  if (!modal || !content) return;
  modal.classList.add('opacity-0');
  content.classList.add('scale-95');
  setTimeout(() => modal.classList.add('hidden'), 250);
}

async function saveGlobalBudget() {
  if (!canApprove) {
    showGlobalBudgetError('บัญชีนี้ไม่มีสิทธิ์แก้ไขงบประมาณรวม');
    return;
  }

  const value = Number(document.getElementById('globalBudgetInput')?.value || 0);
  const saveBtn = document.getElementById('saveGlobalBudgetBtn');
  const spinner = document.getElementById('saveGlobalBudgetSpinner');

  if (!Number.isFinite(value) || value < 0) {
    showGlobalBudgetError('กรุณาระบุงบประมาณรวมให้ถูกต้อง');
    return;
  }

  try {
    if (saveBtn) saveBtn.disabled = true;
    spinner?.classList.remove('hidden');

    const year = String(getSelectedFiscalYear());
    await setDoc(getFiscalYearDocRef(year), {
      year,
      label: `ปีงบประมาณ ${year}`,
      totalBudget: value,
      updatedBy: currentUserUid,
      updatedByName: currentUser?.name || currentUser?.email || 'Unknown',
      updatedAt: serverTimestamp()
    }, { merge: true });

    totalBudgetLimit = value;
    updateGlobalBudget(lastApprovedBudgetTotal);
    closeGlobalBudgetModal();
  } catch (error) {
    console.error('Save fiscal year budget error:', error);
    showGlobalBudgetError(`บันทึกไม่สำเร็จ: ${error.code || error.message || error}`);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    spinner?.classList.add('hidden');
  }
}

function showGlobalBudgetError(message) {
  const error = document.getElementById('globalBudgetError');
  if (!error) return;
  error.textContent = message;
  error.classList.remove('hidden');
}

function listenGlobalBudget() {
  if (unsubscribeBudget) unsubscribeBudget();

  const year = String(getSelectedFiscalYear());
  const yearBudgetRef = getFiscalYearDocRef(year);

  unsubscribeBudget = onSnapshot(yearBudgetRef, async (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const value = Number(data.totalBudget ?? data.budget ?? data.budgetLimit ?? NaN);
      totalBudgetLimit = Number.isFinite(value) && value >= 0 ? value : DEFAULT_TOTAL_BUDGET;
      updateGlobalBudget(lastApprovedBudgetTotal);
      return;
    }

    // Fallback สำหรับปีที่ยังไม่มีงบใน fiscal_years/{year}
    let fallbackBudget = DEFAULT_TOTAL_BUDGET;
    try {
      const budgetSnap = await getDoc(BUDGET_REF);
      fallbackBudget = budgetSnap.exists()
        ? Number(budgetSnap.data().totalBudget || DEFAULT_TOTAL_BUDGET)
        : DEFAULT_TOTAL_BUDGET;
    } catch (error) {
      console.warn('Read fallback settings/budget failed:', error);
    }

    totalBudgetLimit = Number.isFinite(fallbackBudget) && fallbackBudget >= 0
      ? fallbackBudget
      : DEFAULT_TOTAL_BUDGET;

    // ถ้าผู้ใช้มีสิทธิ์ ให้สร้างค่าเริ่มต้นของปีนี้ไว้ใน fiscal_years/{year}
    try {
      if (canApprove) {
        await setDoc(yearBudgetRef, {
          year,
          label: `ปีงบประมาณ ${year}`,
          totalBudget: totalBudgetLimit,
          createdBy: currentUserUid,
          createdByName: currentUser?.name || currentUser?.email || 'Unknown',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.warn('Create fiscal year budget fallback failed:', error);
    }

    updateGlobalBudget(lastApprovedBudgetTotal);
  }, (error) => {
    console.error('Fiscal year budget listener error:', error);
    totalBudgetLimit = getFiscalYearBudgetValue(year);
    updateGlobalBudget(lastApprovedBudgetTotal);
  });
}


function updateFilterApprovedTotal(total) {
  const totalEl = document.getElementById('filterApprovedTotal');
  const labelEl = document.getElementById('filterApprovedTotalLabel');
  const hintEl = document.getElementById('filterApprovedTotalHint');
  const cardEl = document.getElementById('filterApprovedTotalCard');
  if (!totalEl || !labelEl || !cardEl) return;

  const themeMap = {
    all: {
      label: 'ทั้งหมด',
      border: 'rgba(14,165,233,.82)',
      bg: 'rgba(14,165,233,.10)',
      text: '#38bdf8'
    },
    information: {
      label: 'งานสารสนเทศ',
      border: 'rgba(16,185,129,.82)',
      bg: 'rgba(16,185,129,.12)',
      text: '#10b981'
    },
    technical: {
      label: 'งานเทคนิค',
      border: 'rgba(59,130,246,.82)',
      bg: 'rgba(59,130,246,.12)',
      text: '#3b82f6'
    },
    corporate_communication: {
      label: 'งานสื่อสารองค์กร',
      border: 'rgba(245,158,11,.86)',
      bg: 'rgba(245,158,11,.13)',
      text: '#f59e0b'
    }
  };

  const key = selectedSectionFilter && selectedSectionFilter !== 'all' ? selectedSectionFilter : 'all';
  const theme = themeMap[key] || themeMap.all;

  labelEl.textContent = theme.label;
  totalEl.textContent = `${formatNumber(total)} THB`;
  totalEl.style.color = theme.text;
  labelEl.style.color = theme.text;
  cardEl.style.borderColor = theme.border;
  cardEl.style.background = `linear-gradient(135deg, ${theme.bg}, rgba(15,23,42,.04))`;

  if (hintEl) {
    hintEl.textContent = `ปีงบประมาณ ${getSelectedFiscalYear()} • อนุมัติแล้ว`;
  }
}

function listenProjects() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;
  if (unsubscribeProjects) unsubscribeProjects();

  unsubscribeProjects = onSnapshot(collection(db, PROJECTS_COLLECTION), async (snapshot) => {
    grid.innerHTML = '';
    window.projectsMap = new Map();
    let departmentApprovedTotal = 0;
    let filteredApprovedTotal = 0;
    const visibleItems = [];

    for (const docSnap of snapshot.docs) {
      const data = normalizeProjectDoc(docSnap.id, docSnap.data());
      if (shouldAutoDeleteRejected(data)) {
        try {
          await deleteDoc(doc(db, PROJECTS_COLLECTION, docSnap.id));
          continue;
        } catch (error) {
          console.warn('Auto delete rejected project failed:', error);
        }
      }
      if (!projectMatchesFiscalYear(data)) continue;
      const approvedAmount = Number(data.totalBudget || data.budgetAllocated || 0);
      if (data.status === 'approved') {
        departmentApprovedTotal += approvedAmount;
        if (projectMatchesSectionFilter(data)) filteredApprovedTotal += approvedAmount;
      }
      if (isProjectVisibleToCurrentUser(data) && projectMatchesSectionFilter(data)) visibleItems.push(data);
    }

    visibleItems.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
    if (!visibleItems.length) {
      const sectionText = canApprove && selectedSectionFilter !== 'all' ? ` ในหมวด${getSectionLabel(selectedSectionFilter)}` : '';
      grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500">${canApprove ? `ยังไม่มีโครงการปีงบประมาณ ${getSelectedFiscalYear()}${sectionText}` : `ยังไม่มีโครงการของคุณในปีงบประมาณ ${getSelectedFiscalYear()}`}</div>`;
    }
    visibleItems.forEach((data) => {
      window.projectsMap.set(data.id, data);
      grid.insertAdjacentHTML('beforeend', createProjectCard(data.id, data));
    });
    updateGlobalBudget(departmentApprovedTotal);
    updateFilterApprovedTotal(filteredApprovedTotal);
  }, (error) => {
    console.error('Projects listener error:', error);
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-red-500">
        เกิดข้อผิดพลาดในการโหลดข้อมูล<br>
        <span class="text-xs text-red-400">${escapeHtml(error.code || error.message || String(error))}</span>
      </div>`;
  });
}

function normalizeProjectDoc(id, data) {
  const title = data.title || data.name || 'ไม่ระบุชื่อโครงการ';
  const requestedBudget = Number(data.requestedBudget ?? data.budgetRequested ?? data.budgetAllocated ?? data.totalBudget ?? 0);
  const approvedBudget = Number(data.totalBudget ?? data.budgetAllocated ?? 0);
  return {
    id,
    ...data,
    title,
    name: data.name || title,
    description: data.description || '',
    requestedBudget,
    totalBudget: approvedBudget,
    budgetAllocated: approvedBudget,
    budgetSpent: Number(data.budgetSpent || data.usedBudget || 0),
    creatorName: data.creatorName || data.ownerName || 'Unknown',
    ownerId: data.ownerId || data.createdBy || '',
    ownerName: data.ownerName || data.creatorName || 'Unknown',
    ownerEmail: data.ownerEmail || '',
    ownerSection: data.ownerSection || data.section || '',
    ownerRole: data.ownerRole || '',
    fiscalYear: String(data.fiscalYear || getDefaultFiscalYear()),
    noDeadline: Boolean(data.noDeadline),
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    durationLabel: data.durationLabel || getProjectDurationText(data),
    status: data.status || 'draft',
    managerComment: data.managerComment || data.approveNote || ''
  };
}

function createProjectCard(id, data) {
  const statusMap = {
    draft: { label: 'ร่าง', class: 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200 border-slate-200 dark:border-slate-700' },
    pending: { label: 'รอหัวหน้าอนุมัติ', class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50' },
    revision_requested: { label: 'ให้แก้ไข', class: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800/50' },
    approved: { label: 'อนุมัติแล้ว', class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' },
    rejected: { label: 'ไม่อนุมัติ', class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50' }
  };
  const statusInfo = statusMap[data.status] || statusMap.draft;
  const dateStr = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString('th-TH') : '';
  const isOwner = getOwnerId(data) === currentUserUid || data.createdBy === currentUserUid;
  const projectFiscalYear = data.fiscalYear || getDefaultFiscalYear();

  const commentHtml = data.managerComment
    ? '<div class="mt-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-3 text-xs text-amber-700 dark:text-amber-300"><b>คอมเมนต์หัวหน้า:</b> ' + escapeHtml(data.managerComment) + '</div>'
    : '';

  let actionButton = '';
  if (isOwner && ['draft', 'revision_requested'].includes(data.status)) {
    const colsClass = data.status === 'draft' ? 'grid-cols-3' : 'grid-cols-2';
    const deleteBtn = data.status === 'draft'
      ? '<button onclick="window.deleteProjectById(\'' + id + '\')" class="py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg transition-colors">ลบ</button>'
      : '';
    actionButton = ''
      + '<div class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 grid ' + colsClass + ' gap-2">'
      + '<button onclick="window.openProjectEditModal(\'' + id + '\')" class="py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white text-sm font-medium rounded-lg transition-colors">แก้ไข</button>'
      + '<button onclick="window.submitSavedProject(\'' + id + '\')" class="py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">ส่งโครงการ</button>'
      + deleteBtn
      + '</div>';
  } else if (canApprove && ['draft', 'pending', 'revision_requested', 'approved', 'rejected'].includes(data.status)) {
    const actionLabel = data.status === 'approved' ? 'แก้ไขงบประมาณ/ผู้รับผิดชอบ' : 'พิจารณา/แก้ไขผู้รับผิดชอบ';
    actionButton = ''
      + '<div class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 grid grid-cols-1 gap-2">'
      + '<button onclick="window.openActionModal(\'' + id + '\')" class="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white text-sm font-medium rounded-lg transition-colors">' + actionLabel + '</button>'
      + '<button onclick="window.deleteProjectById(\'' + id + '\')" class="w-full py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg transition-colors">ลบโครงการ</button>'
      + '</div>';
  }

  const autoDeleteText = data.status === 'rejected'
    ? '<div class="text-xs text-red-400 mt-1">จะลบอัตโนมัติหลังครบ ' + REJECTED_AUTO_DELETE_DAYS + ' วัน หากไม่มีการเปลี่ยนสถานะ</div>'
    : '';

  return ''
    + '<div class="border border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">'
    + '<div class="flex justify-between items-start mb-3"><span class="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ' + statusInfo.class + '">' + statusInfo.label + '</span><span class="text-xs text-slate-400">' + dateStr + '</span></div>'
    + '<h4 class="text-base font-bold text-slate-800 dark:text-white mb-2 line-clamp-2">' + escapeHtml(data.title) + '</h4>'
    + '<p class="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-3 flex-grow">' + escapeHtml(data.description) + '</p>'
    + '<div class="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 mt-auto space-y-2">'
    + '<div><div class="text-xs text-slate-500 dark:text-slate-400 mb-1">งบประมาณที่ขอ</div><div class="text-lg font-bold text-brand-600 dark:text-sky-400">' + formatNumber(data.requestedBudget) + ' <span class="text-xs font-normal">THB</span></div></div>'
    + '<div><div class="text-xs text-slate-500 dark:text-slate-400 mb-1">งบประมาณที่อนุมัติ</div><div class="text-base font-bold text-emerald-600 dark:text-emerald-400">' + formatNumber(data.totalBudget || data.budgetAllocated || 0) + ' <span class="text-xs font-normal">THB</span></div></div>'
    + '<div class="text-xs text-slate-400 mt-1">ผู้เสนอ: ' + escapeHtml(data.creatorName || 'Unknown') + '</div>'
    + '<div class="text-xs text-slate-400 mt-1">ผู้รับผิดชอบ: ' + escapeHtml(data.ownerName || data.creatorName || 'Unknown') + '</div>'
    + '<div class="text-xs text-slate-400 mt-1">ส่วนงาน: ' + escapeHtml(getSectionLabel(data.ownerSection)) + ' • สิทธิ์: ' + escapeHtml(getRoleLabel(data.ownerRole)) + '</div>'
    + '<div class="text-xs text-slate-400 mt-1">ระยะเวลา: ' + escapeHtml(data.durationLabel || getProjectDurationText(data)) + '</div>'
    + '<div class="text-xs text-slate-400 mt-1">ปีงบประมาณ: ' + escapeHtml(projectFiscalYear) + '</div>'
    + autoDeleteText
    + '</div>'
    + commentHtml
    + actionButton
    + '</div>';
}

window.submitSavedProject = async (id) => {
  const project = window.projectsMap.get(id);
  if (!project) return;
  try {
    await updateDoc(doc(db, PROJECTS_COLLECTION, id), {
      status: 'pending',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      rejectedAt: null,
      autoDeleteAt: null
    });
  } catch (error) {
    alert(`ส่งโครงการไม่สำเร็จ: ${error.code || error.message || error}`);
  }
};

function canDeleteProject(project) {
  if (canApprove) return true;
  return getOwnerId(project) === currentUserUid && project.status === 'draft';
}

window.deleteProjectById = async (id) => {
  const project = window.projectsMap.get(id);
  if (!project) return alert('ไม่พบข้อมูลโครงการ');
  if (!canDeleteProject(project)) return alert('บัญชีนี้ไม่มีสิทธิ์ลบโครงการนี้');
  const name = project.title || project.name || 'โครงการนี้';
  if (!confirm('ยืนยันการลบ ' + name + '?')) return;
  try {
    await deleteDoc(doc(db, PROJECTS_COLLECTION, id));
  } catch (error) {
    console.error('Delete project error:', error);
    alert('ลบโครงการไม่สำเร็จ: ' + (error.code || error.message || error));
  }
};

function shouldAutoDeleteRejected(project) {
  if (project.status !== 'rejected') return false;
  const baseTime = getTime(project.rejectedAt) || getTime(project.updatedAt);
  if (!baseTime) return false;
  const ageMs = Date.now() - baseTime;
  const limitMs = REJECTED_AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000;
  return ageMs >= limitMs;
}

function updateGlobalBudget(spent) {
  lastApprovedBudgetTotal = Number(spent || 0);
  const remaining = totalBudgetLimit - lastApprovedBudgetTotal;
  const percent = totalBudgetLimit > 0 ? (lastApprovedBudgetTotal / totalBudgetLimit) * 100 : 0;
  const title = findBudgetTitle();
  if (title) {
    title.id = 'globalBudgetTitle';
    title.textContent = `ภาพรวมงบประมาณรวมทั้งฝ่ายปีงบประมาณ ${getSelectedFiscalYear()} (${formatNumber(totalBudgetLimit)} THB)`;
  }
  setText('globalSpent', formatNumber(lastApprovedBudgetTotal));
  setText('globalRemaining', formatNumber(remaining));
  setText('budgetPercent', percent.toFixed(1));
  const bar = document.getElementById('budgetProgressBar');
  if (!bar) return;
  bar.style.width = `${Math.min(percent, 100)}%`;
  bar.className = 'bg-gradient-to-r from-brand-500 to-sky-400 h-3 rounded-full transition-all duration-1000';
  if (percent > 90) bar.className = 'bg-gradient-to-r from-red-500 to-orange-400 h-3 rounded-full transition-all duration-1000';
  else if (percent > 70) bar.className = 'bg-gradient-to-r from-amber-500 to-yellow-400 h-3 rounded-full transition-all duration-1000';
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getTime(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

function formatProjectDuration(startDate, endDate) {
  if (!startDate || !endDate) return 'ไม่มีกำหนดเวลา';
  return `${formatThaiDate(startDate)} - ${formatThaiDate(endDate)}`;
}

function getProjectDurationText(project) {
  if (!project) return '-';
  if (project.noDeadline) return 'ไม่มีกำหนดเวลา';
  if (project.startDate && project.endDate) return formatProjectDuration(project.startDate, project.endDate);
  return 'ไม่มีกำหนดเวลา';
}

function formatThaiDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString || '-';
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function showFormError(errorEl, message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function formatNumber(value) {
  return new Intl.NumberFormat('th-TH').format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
