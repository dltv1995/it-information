// assets/js/dashboard.js
// Firebase-only Dashboard + Global Budget from Firestore settings/budget
// แก้ปัญหา "ช่องงบประมาณรวมเป็น 0" โดยอ่านงบรวมจาก settings/budget.totalBudget
// Version: dashboard-section-allocation-summary-v26

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection,
    doc,
    getDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log('dashboard.js loaded: dashboard-section-allocation-summary-v26');

const DEFAULT_TOTAL_BUDGET = 1500000;
const SECTION_LABELS = {
    technical: 'งานเทคนิค',
    information: 'งานสารสนเทศ',
    corporate_communication: 'งานสื่อสารองค์กร'
};
const SECTION_COLORS = {
    technical: '#3b82f6',
    information: '#10b981',
    corporate_communication: '#f59e0b',
    unknown: '#64748b'
};
const FISCAL_YEARS_COLLECTION = 'fiscal_years';
const BUDGET_REF = doc(db, 'settings', 'budget');

let budgetChart = null;
let workloadChart = null;
let projectsCache = [];
let fiscalYearsCache = [];
let tasksCache = [];
let globalBudget = DEFAULT_TOTAL_BUDGET;
let selectedDashboardFiscalYear = localStorage.getItem('dashboardFiscalYear') || getDefaultFiscalYear();
let selectedDashboardSectionFilter = localStorage.getItem('dashboardSectionFilter') || 'all';
let unsubProjects = null;
let unsubTasks = null;
let unsubBudget = null;
let unsubFiscalYears = null;
let mounted = false;

document.addEventListener('DOMContentLoaded', initDashboardPage);

function initDashboardPage() {
    showBody();
    waitForPageContent(() => {
        initAuthAndRealtimeData();
    });
}

function waitForPageContent(callback) {
    const existing = document.getElementById('pageContent');
    if (existing) {
        mountDashboard(existing);
        callback();
        return;
    }

    const layoutRoot = document.getElementById('layoutRoot');
    if (!layoutRoot) {
        console.error('ไม่พบ #layoutRoot ใน dashboard.html');
        return;
    }

    let attempts = 0;
    const timer = setInterval(() => {
        attempts += 1;
        const pageContent = document.getElementById('pageContent');
        if (pageContent) {
            clearInterval(timer);
            mountDashboard(pageContent);
            callback();
            return;
        }

        if (attempts >= 20) {
            clearInterval(timer);
            const fallback = createFallbackPageContent();
            mountDashboard(fallback);
            callback();
        }
    }, 100);
}

function createFallbackPageContent() {
    let pageContent = document.getElementById('pageContent');
    if (pageContent) return pageContent;

    const layoutRoot = document.getElementById('layoutRoot') || document.body;
    const main = document.createElement('main');
    main.className = 'flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 transition-theme';

    pageContent = document.createElement('div');
    pageContent.id = 'pageContent';
    pageContent.className = 'flex-1 overflow-y-auto p-6 lg:p-8 z-10';

    main.appendChild(pageContent);
    layoutRoot.appendChild(main);
    return pageContent;
}

function mountDashboard(pageContent) {
    if (mounted || document.getElementById('totalBudget')) {
        mounted = true;
        return;
    }

    const template = document.getElementById('dashboardTemplate');
    if (template) {
        pageContent.appendChild(template.content.cloneNode(true));
    } else {
        pageContent.innerHTML = getFallbackDashboardHtml();
    }

    mounted = true;
}

function initAuthAndRealtimeData() {
    const mockUserStr = localStorage.getItem('mockUser');

    if (mockUserStr) {
        const mockUser = JSON.parse(mockUserStr);
        initUserHeader(mockUser, true);
        listenGlobalBudget();
        listenFiscalYears();
        listenProjects();
        listenTasks();
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        let appUser = {
            uid: user.uid,
            name: user.email,
            email: user.email,
            role: 'staff'
        };

        try {
            const userDocSnap = await getDoc(doc(db, 'users', user.uid));
            if (userDocSnap.exists()) {
                appUser = {
                    uid: user.uid,
                    email: user.email,
                    ...userDocSnap.data()
                };
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }

        initUserHeader(appUser, false);
        listenGlobalBudget();
        listenFiscalYears();
        listenProjects();
        listenTasks();
    });
}

function initUserHeader(user, isMockUser) {
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const adminMenu = document.getElementById('adminMenu');
    const logoutBtn = document.getElementById('logoutBtn');

    if (userName) userName.textContent = user.name || user.email || 'ผู้ใช้งานระบบ';

    const roleDisplay = {
        admin: 'ผู้ดูแลระบบ',
        manager: 'หัวหน้างาน',
        secretary: 'เลขาฯ',
        staff: 'เจ้าหน้าที่',
        employee: 'เจ้าหน้าที่'
    };

    if (userRole) userRole.textContent = roleDisplay[user.role] || user.role || 'เจ้าหน้าที่';
    if (adminMenu && user.role === 'admin') adminMenu.classList.remove('hidden');

    if (logoutBtn) {
        logoutBtn.onclick = () => {
            if (isMockUser) {
                localStorage.removeItem('mockUser');
                window.location.href = 'login.html';
                return;
            }

            signOut(auth)
                .then(() => window.location.href = 'login.html')
                .catch((error) => console.error('Logout Error:', error));
        };
    }
}

function listenGlobalBudget() {
    if (typeof unsubBudget === 'function') unsubBudget();

    unsubBudget = onSnapshot(BUDGET_REF, (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            globalBudget = toNumber(data.totalBudget || DEFAULT_TOTAL_BUDGET);
        } else {
            globalBudget = DEFAULT_TOTAL_BUDGET;
        }
        renderDashboardFromFirebase();
    }, (error) => {
        console.error('Budget settings listener error:', error);
        globalBudget = DEFAULT_TOTAL_BUDGET;
        showFirebaseStatus('อ่านข้อมูลงบประมาณรวมจาก settings/budget ไม่สำเร็จ ใช้ค่าเริ่มต้น 1,500,000 บาท', 'info');
        renderDashboardFromFirebase();
    });
}

function listenProjects() {
    if (typeof unsubProjects === 'function') unsubProjects();

    const projectsRef = collection(db, 'projects');

    unsubProjects = onSnapshot(projectsRef, (snapshot) => {
        projectsCache = snapshot.docs.map((docSnap) => normalizeProject(docSnap.id, docSnap.data()));
        renderDashboardFromFirebase();
    }, (error) => {
        console.error('Projects listener error:', error);
        showFirebaseStatus(`อ่านข้อมูล projects จาก Firebase ไม่สำเร็จ: ${error.code || error.message || error}`, 'error');
        projectsCache = [];
        renderDashboardFromFirebase();
    });
}


function listenFiscalYears() {
    if (typeof unsubFiscalYears === 'function') unsubFiscalYears();
    const yearsRef = collection(db, FISCAL_YEARS_COLLECTION);
    unsubFiscalYears = onSnapshot(yearsRef, (snapshot) => {
        fiscalYearsCache = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
        }));
        renderDashboardFromFirebase();
    }, (error) => {
        console.error('Fiscal years listener error:', error);
        fiscalYearsCache = [];
        renderDashboardFromFirebase();
    });
}

function listenTasks() {
    if (typeof unsubTasks === 'function') unsubTasks();

    const tasksRef = collection(db, 'tasks');

    unsubTasks = onSnapshot(tasksRef, (snapshot) => {
        tasksCache = snapshot.docs.map((docSnap) => normalizeTask(docSnap.id, docSnap.data()));
        renderDashboardFromFirebase();
    }, (error) => {
        console.error('Tasks listener error:', error);
        // tasks ไม่จำเป็นต่อยอดงบรวม จึงไม่ให้ทับ status error ของ projects/settings
        tasksCache = [];
        renderDashboardFromFirebase();
    });
}

function getSectionLabel(section) {
    return SECTION_LABELS[section] || section || 'ไม่ระบุส่วนงาน';
}

function getSectionColor(section) {
    return SECTION_COLORS[section] || SECTION_COLORS.unknown;
}

function getProjectSection(project) {
    return project.ownerSection || project.section || project.departmentSection || project.userSection || 'unknown';
}


function getDefaultFiscalYear() {
    const now = new Date();
    const thaiYear = now.getFullYear() + 543;
    return String(now.getMonth() >= 9 ? thaiYear + 1 : thaiYear);
}

function getProjectFiscalYear(project) {
    return String(project.fiscalYear || getDefaultFiscalYear());
}

function getAvailableFiscalYears() {
    const years = new Set([getDefaultFiscalYear(), selectedDashboardFiscalYear]);
    fiscalYearsCache.forEach(item => {
        const year = String(item.year || item.id || '').trim();
        if (year) years.add(year);
    });
    projectsCache.forEach(project => years.add(getProjectFiscalYear(project)));
    return Array.from(years).filter(Boolean).sort((a, b) => Number(b) - Number(a));
}


function getSelectedFiscalYearBudget() {
    const item = fiscalYearsCache.find(yearItem => String(yearItem.year || yearItem.id || '') === String(selectedDashboardFiscalYear));
    const value = Number(item?.totalBudget ?? item?.budget ?? item?.budgetLimit ?? NaN);
    return Number.isFinite(value) && value >= 0 ? value : toNumber(globalBudget || DEFAULT_TOTAL_BUDGET);
}


function getSelectedFiscalYearData() {
    return fiscalYearsCache.find(yearItem => String(yearItem.year || yearItem.id || '') === String(selectedDashboardFiscalYear)) || null;
}

function getSectionBudgetAllocationMap() {
    const yearData = getSelectedFiscalYearData() || {};
    const sectionBudgets = yearData.sectionBudgets || {};
    return {
        technical: toNumber(sectionBudgets.technical ?? yearData.technicalBudget ?? yearData.budgetTechnical ?? 0),
        information: toNumber(sectionBudgets.information ?? yearData.informationBudget ?? yearData.budgetInformation ?? 0),
        corporate_communication: toNumber(sectionBudgets.corporate_communication ?? yearData.corporateCommunicationBudget ?? yearData.communicationBudget ?? yearData.budgetCorporateCommunication ?? 0)
    };
}

function getDashboardSectionKeys() {
    return ['technical', 'information', 'corporate_communication'];
}

function buildSectionBudgetStats(projects = [], totalBudget = getSelectedFiscalYearBudget()) {
    const allocations = getSectionBudgetAllocationMap();
    const approvedProjects = Array.isArray(projects)
        ? projects.filter(project => project.status === 'approved')
        : [];

    const approvedMap = new Map();
    approvedProjects.forEach(project => {
        const section = getProjectSection(project);
        const approvedBudget = getProjectApprovedBudget(project);
        approvedMap.set(section, (approvedMap.get(section) || 0) + approvedBudget);
    });

    const sectionKeys = getDashboardSectionKeys();
    const rows = sectionKeys.map(section => {
        const allocated = toNumber(allocations[section]);
        const approved = toNumber(approvedMap.get(section));
        const remaining = Math.max(allocated - approved, 0);
        const over = Math.max(approved - allocated, 0);
        return {
            section,
            label: getSectionLabel(section),
            color: getSectionColor(section),
            allocated,
            approved,
            remaining,
            over,
            usagePercent: allocated > 0 ? Number(((approved / allocated) * 100).toFixed(1)) : 0
        };
    });

    const allocatedTotal = rows.reduce((sum, row) => sum + row.allocated, 0);
    const approvedTotal = rows.reduce((sum, row) => sum + row.approved, 0);
    const sectionRemainingTotal = rows.reduce((sum, row) => sum + row.remaining, 0);
    const unallocated = Math.max(toNumber(totalBudget) - allocatedTotal, 0);
    const totalRemaining = Math.max(toNumber(totalBudget) - approvedTotal, 0);

    return {
        totalBudget: toNumber(totalBudget),
        allocatedTotal,
        approvedTotal,
        sectionRemainingTotal,
        unallocated,
        totalRemaining,
        rows
    };
}

function colorWithAlpha(hex, alphaHex) {
    const value = String(hex || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(value)) return `${value}${alphaHex}`;
    return value || '#64748b';
}

function projectMatchesDashboardFilters(project) {
    const fiscalMatch = getProjectFiscalYear(project) === selectedDashboardFiscalYear;
    if (!fiscalMatch) return false;
    if (!selectedDashboardSectionFilter || selectedDashboardSectionFilter === 'all') return true;
    return getProjectSection(project) === selectedDashboardSectionFilter;
}


function ensureDashboardTopFiscalYearControls() {
    const totalBudgetEl = document.getElementById('totalBudget');
    const metricGrid = totalBudgetEl?.closest('.grid');
    if (!metricGrid || document.getElementById('dashboardTopFiscalYearBar')) return;

    const bar = document.createElement('div');
    bar.id = 'dashboardTopFiscalYearBar';
    bar.className = 'mb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-4';
    bar.innerHTML = `
        <div class="max-w-xs">
            <label class="block text-xs font-extrabold tracking-wide text-slate-500 dark:text-slate-400 mb-2">เลือกปีงบประมาณ</label>
            <select id="dashboardFiscalYearSelect" class="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-extrabold text-slate-800 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none shadow-sm"></select>
        </div>
        <div class="hidden md:block text-right">
            <p class="text-xs font-bold text-slate-400 dark:text-slate-500">ข้อมูลสรุปทั้งหมดเปลี่ยนตามปีงบประมาณที่เลือก</p>
        </div>
    `;
    metricGrid.parentNode.insertBefore(bar, metricGrid);

    document.getElementById('dashboardFiscalYearSelect')?.addEventListener('change', event => {
        selectedDashboardFiscalYear = event.target.value || getDefaultFiscalYear();
        localStorage.setItem('dashboardFiscalYear', selectedDashboardFiscalYear);
        renderDashboardFromFirebase();
    });
}

function updateDashboardTopFiscalYearControls() {
    ensureDashboardTopFiscalYearControls();
    const select = document.getElementById('dashboardFiscalYearSelect');
    if (!select) return;
    const years = getAvailableFiscalYears();
    select.innerHTML = years.map(year => `<option value="${escapeAttr(year)}">ปีงบประมาณ ${escapeHtml(year)}</option>`).join('');
    select.value = selectedDashboardFiscalYear;
    if (!select.value && years.length) {
        selectedDashboardFiscalYear = years[0];
        select.value = selectedDashboardFiscalYear;
    }
}

function ensureDashboardFilterControls() {
    const projectList = document.getElementById('projectList');
    if (!projectList) return;
    const section = projectList.closest('section');
    if (!section) return;
    const header = section.querySelector('.px-6.py-5') || section.firstElementChild;
    if (!header) return;

    header.classList.add('bg-gradient-to-br', 'from-slate-50/70', 'to-white/30', 'dark:from-slate-900/55', 'dark:to-slate-950/30');

    const titleArea = header.querySelector('h3')?.parentElement || header;
    const title = titleArea.querySelector('h3');
    const subtitle = titleArea.querySelector('p');
    if (title) title.textContent = 'สถานะงบประมาณโครงการย่อย';
    if (subtitle) subtitle.textContent = 'แสดงโครงการตามปีงบประมาณและส่วนงานที่เลือก';

    // ซ่อนปุ่มเพิ่มโครงการเดิมจาก template ถ้ามี เพื่อให้เหลือปุ่มเดียว
    header.querySelectorAll('button').forEach(button => {
        const text = String(button.textContent || '').replace(/\s+/g, ' ').trim();
        if (text.includes('เพิ่มโครงการ') && button.id !== 'dashboardAddProjectBtn') {
            button.classList.add('hidden');
            button.setAttribute('aria-hidden', 'true');
        }
    });

    if (document.getElementById('dashboardProjectHeaderToolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'dashboardProjectHeaderToolbar';
    toolbar.className = 'mt-5 flex items-center justify-between gap-4 w-full';
    toolbar.innerHTML = `
        <div class="flex items-center gap-2 shrink-0">
            <button type="button" id="dashboardAddProjectBtn" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-extrabold shadow-sm hover:opacity-90 transition-opacity">
                <i class="ph ph-plus-circle text-base"></i>
                <span>เพิ่มโครงการ</span>
            </button>
        </div>
        <div id="dashboardFilterControls" class="flex items-center justify-end gap-3 min-w-0">
            <span class="text-xs font-extrabold tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">แสดงโครงการ</span>
            <div id="dashboardSectionFilterBtns" class="flex items-center gap-2 flex-nowrap overflow-x-auto soft-scroll">
                <button type="button" data-section="all" class="dashboard-filter-btn px-3 py-2 rounded-xl text-xs font-bold border transition-colors">ทั้งหมด</button>
                <button type="button" data-section="information" class="dashboard-filter-btn px-3 py-2 rounded-xl text-xs font-bold border transition-colors">สารสนเทศ</button>
                <button type="button" data-section="technical" class="dashboard-filter-btn px-3 py-2 rounded-xl text-xs font-bold border transition-colors">เทคนิค</button>
                <button type="button" data-section="corporate_communication" class="dashboard-filter-btn px-3 py-2 rounded-xl text-xs font-bold border transition-colors">ประชาสัมพันธ์</button>
            </div>
        </div>
    `;
    header.appendChild(toolbar);

    document.getElementById('dashboardAddProjectBtn')?.addEventListener('click', () => {
        if (window.top && window.top !== window && window.top.location) {
            window.top.location.href = 'projects.html';
        } else {
            window.location.href = 'projects.html';
        }
    });

    document.querySelectorAll('.dashboard-filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            selectedDashboardSectionFilter = button.dataset.section || 'all';
            localStorage.setItem('dashboardSectionFilter', selectedDashboardSectionFilter);
            renderDashboardFromFirebase();
        });
    });
}

function updateDashboardFilterControls() {
    updateDashboardTopFiscalYearControls();
    ensureDashboardFilterControls();
    document.querySelectorAll('.dashboard-filter-btn').forEach(button => {
        const active = button.dataset.section === selectedDashboardSectionFilter;
        button.className = active
            ? 'dashboard-filter-btn px-3 py-2 rounded-xl text-xs font-bold border bg-sky-600 text-white border-sky-600 transition-colors'
            : 'dashboard-filter-btn px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors';
    });
}

function updateDashboardSectionTitles() {
    const budgetCanvas = document.getElementById('budgetChart');
    const budgetTitle = budgetCanvas?.closest('section')?.querySelector('h3');
    if (budgetTitle) budgetTitle.textContent = 'สัดส่วนงบประมาณทั้งหมด กระจายแล้ว ใช้ไป คงเหลือ';
    const urgentList = document.getElementById('urgentList');
    const urgentTitle = urgentList?.closest('section')?.querySelector('h3');
    if (urgentTitle) urgentTitle.textContent = 'งานที่ล่าช้าหรือใกล้ถึงกำหนดส่ง (Overdue / Urgent)';
}

function getProjectApprovedBudget(project) {
    return toNumber(project.total || project.totalBudget || project.budgetAllocated || project.approvedBudget || 0);
}

function normalizeProject(id, data) {
    const total = toNumber(data.totalBudget ?? data.total ?? data.budgetAllocated ?? data.budget ?? 0);
    const used = toNumber(data.usedBudget ?? data.used ?? data.budgetSpent ?? data.spent ?? 0);

    return {
        id,
        code: data.code || 'งา',
        name: data.name || data.title || data.projectName || 'ไม่ระบุชื่อโครงการ',
        owner: data.ownerName || data.creatorName || data.owner || data.managerName || 'ไม่ระบุผู้รับผิดชอบ',
        ownerId: data.ownerId || data.createdBy || '',
        ownerName: data.ownerName || data.creatorName || data.owner || data.managerName || 'ไม่ระบุผู้รับผิดชอบ',
        ownerEmail: data.ownerEmail || data.email || '',
        ownerSection: data.ownerSection || data.section || data.departmentSection || '',
        ownerRole: data.ownerRole || data.role || '',
        total,
        used,
        progress: toNumber(data.progress ?? 0),
        accent: data.accent || data.color || '#3b82f6',
        status: data.status || 'active',
        requestedBudget: toNumber(data.requestedBudget ?? 0),
        durationLabel: data.durationLabel || getProjectDurationText(data),
        fiscalYear: String(data.fiscalYear || getDefaultFiscalYear())
    };
}


function parseTaskDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

function getTaskUrgencyInfo(task) {
    const dueDate = parseTaskDate(task.dueDate);
    if (!dueDate) {
        return {
            label: task.urgent ? 'เร่งด่วน' : (task.status || 'ไม่ระบุกำหนด'),
            tone: task.tone || (task.urgent ? 'red' : 'slate'),
            daysLeft: null,
            sortValue: task.urgent ? -1 : 9999
        };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    if (daysLeft < 0) return { label: `เกินกำหนด ${Math.abs(daysLeft)} วัน`, tone: 'red', daysLeft, sortValue: daysLeft };
    if (daysLeft <= 7) return { label: `เหลือ ${daysLeft} วัน`, tone: 'red', daysLeft, sortValue: daysLeft };
    if (daysLeft <= 30) return { label: `เหลือ ${daysLeft} วัน (ไม่เกิน 1 เดือน)`, tone: 'amber', daysLeft, sortValue: daysLeft };
    if (daysLeft <= 90) return { label: `เหลือ ${daysLeft} วัน (ไม่เกิน 3 เดือน)`, tone: 'sky', daysLeft, sortValue: daysLeft };
    return { label: `เหลือ ${daysLeft} วัน`, tone: 'slate', daysLeft, sortValue: daysLeft };
}

function isTaskOverdueOrUrgent(task) {
    const info = getTaskUrgencyInfo(task);
    return task.urgent || info.tone === 'red' || info.tone === 'amber' || info.tone === 'sky';
}

function normalizeTask(id, data) {
    const dueDate = parseTaskDate(data.dueDate || data.deadline || data.endDate || data.targetDate || data.dueAt);
    const baseTask = {
        id,
        title: data.title || data.taskName || 'ไม่ระบุชื่องาน',
        projectId: data.projectId || '',
        project: data.projectName || data.project || 'ไม่ระบุโครงการ',
        assignee: data.assigneeName || data.assignee || data.ownerName || 'ไม่ระบุผู้รับผิดชอบ',
        amount: toNumber(data.amount ?? data.budgetAmount ?? data.cost ?? 0),
        status: data.statusText || data.dueStatus || data.status || '',
        workflowStatus: data.workflowStatus || data.stage || 'todo',
        tone: data.tone || data.priorityTone || (data.isOverdue ? 'red' : 'amber'),
        urgent: Boolean(data.urgent ?? data.isUrgent ?? data.isOverdue ?? false),
        dueDate
    };
    baseTask.urgencyInfo = getTaskUrgencyInfo(baseTask);
    return baseTask;
}

function renderDashboardFromFirebase() {
    updateDashboardSectionTitles();
    updateDashboardFilterControls();

    const fiscalProjects = projectsCache.filter(project => getProjectFiscalYear(project) === selectedDashboardFiscalYear);
    const visibleProjects = fiscalProjects.filter(projectMatchesDashboardFilters);

    const totalBudget = getSelectedFiscalYearBudget();
    const approvedProjects = fiscalProjects.filter(project => project.status === 'approved');
    const approvedBudget = approvedProjects.reduce((sum, project) => sum + toNumber(project.total), 0);
    const actualUsedBudget = approvedProjects.reduce((sum, project) => sum + toNumber(project.used), 0);
    const spentOrApprovedBudget = actualUsedBudget > 0 ? actualUsedBudget : approvedBudget;
    const remainingBudget = Math.max(totalBudget - spentOrApprovedBudget, 0);

    const urgentTasks = tasksCache
        .filter(isTaskOverdueOrUrgent)
        .sort((a, b) => (a.urgencyInfo?.sortValue ?? 9999) - (b.urgencyInfo?.sortValue ?? 9999))
        .slice(0, 10);

    renderDashboard({
        summary: {
            totalBudget,
            usedBudget: spentOrApprovedBudget,
            remainingBudget
        },
        projects: visibleProjects,
        fiscalProjects,
        urgentTasks
    });
}

function buildWorkloads(tasks) {
    const map = new Map();

    tasks.forEach(task => {
        const name = task.assignee || 'ไม่ระบุผู้รับผิดชอบ';
        if (!map.has(name)) {
            map.set(name, {
                name,
                todo: 0,
                doing: 0,
                review: 0,
                done: 0
            });
        }

        const item = map.get(name);
        const status = String(task.workflowStatus || 'todo').toLowerCase();

        if (['doing', 'in_progress', 'progress'].includes(status)) item.doing += 1;
        else if (['review', 'checking', 'verify'].includes(status)) item.review += 1;
        else if (['done', 'completed', 'complete', 'finish'].includes(status)) item.done += 1;
        else item.todo += 1;
    });

    return Array.from(map.values());
}


function injectDashboardPolishStyle() {
    if (document.getElementById('dashboardPolishStyleV19')) return;
    const style = document.createElement('style');
    style.id = 'dashboardPolishStyleV19';
    style.dataset.v20 = 'dashboardYearTopLeftStyleV20';
    style.dataset.v22 = 'dashboardSingleToolbarV22';
    style.textContent = `
        :root {
            --dash-ring: rgba(14, 165, 233, .34);
            --dash-card: rgba(255,255,255,.76);
            --dash-card-dark: rgba(15,23,42,.78);
        }
        .dashboard-card {
            border-radius: 22px !important;
            border: 1px solid rgba(148,163,184,.22) !important;
            background: linear-gradient(145deg, rgba(255,255,255,.82), rgba(248,250,252,.56)) !important;
            box-shadow: 0 14px 38px rgba(15,23,42,.055) !important;
            overflow: hidden !important;
        }
        html.dark .dashboard-card {
            background: linear-gradient(145deg, rgba(15,23,42,.88), rgba(2,6,23,.72)) !important;
            border-color: rgba(148,163,184,.20) !important;
            box-shadow: 0 16px 46px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.035) !important;
        }
        #dashboardFilterControls {
            padding: 0;
            border-radius: 0;
            background: transparent;
            border: 0;
        }
        html.dark #dashboardFilterControls {
            background: transparent;
            border-color: transparent;
        }
        #dashboardFiscalYearSelect {
            font-weight: 800;
            min-height: 42px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
        }
        .dashboard-filter-btn {
            min-height: 40px;
            border-radius: 999px !important;
            letter-spacing: .01em;
            box-shadow: none;
        }
        .dashboard-filter-btn.bg-sky-600 {
            box-shadow: 0 10px 28px rgba(14,165,233,.28), inset 0 1px 0 rgba(255,255,255,.22);
        }
        .dash-project-card {
            position: relative;
            border-radius: 22px !important;
            border: 1px solid rgba(148,163,184,.20) !important;
            background: linear-gradient(135deg, rgba(255,255,255,.76), rgba(248,250,252,.46)) !important;
            box-shadow: 0 12px 30px rgba(15,23,42,.06) !important;
            overflow: hidden;
        }
        html.dark .dash-project-card {
            background: linear-gradient(135deg, rgba(15,23,42,.74), rgba(2,6,23,.56)) !important;
            border-color: rgba(148,163,184,.18) !important;
            box-shadow: 0 14px 36px rgba(0,0,0,.22) !important;
        }
        .dash-project-card::before {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at top left, var(--section-soft, rgba(14,165,233,.18)), transparent 34%);
            pointer-events: none;
        }
        .dash-project-card > * { position: relative; z-index: 1; }
        .dash-project-card:hover {
            transform: translateY(-2px);
            border-color: var(--section-color, rgba(14,165,233,.55)) !important;
            box-shadow: 0 16px 42px rgba(14,165,233,.10) !important;
        }
        .dash-code-badge {
            width: 48px;
            height: 48px;
            border-radius: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 900;
            box-shadow: 0 12px 30px var(--section-soft, rgba(14,165,233,.25));
        }
        .dash-budget-pill {
            border-radius: 18px;
            padding: 10px 14px;
            background: rgba(15,23,42,.035);
            border: 1px solid rgba(148,163,184,.13);
        }
        html.dark .dash-budget-pill { background: rgba(2,6,23,.34); }
        .progress-track {
            height: 8px !important;
            border-radius: 999px !important;
            background: rgba(148,163,184,.18) !important;
            overflow: hidden !important;
        }
        .progress-fill {
            height: 100% !important;
            border-radius: 999px !important;
            box-shadow: 0 0 20px currentColor;
        }
        #urgentList article {
            border-radius: 22px !important;
            transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
        }
        #urgentList article:hover {
            transform: translateY(-1px);
            box-shadow: 0 18px 48px rgba(15,23,42,.10);
        }
        .chart-box {
            min-height: 320px;
        }

        #dashboardFiscalYearTopLeft {
            margin-top: 14px;
            max-width: 280px;
        }
        #dashboardFiscalYearTopLeft label {
            display: block;
            margin-bottom: 7px;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: .02em;
            color: rgb(100,116,139);
        }
        html.dark #dashboardFiscalYearTopLeft label { color: rgb(148,163,184); }
        #dashboardFiscalYearSelect {
            min-height: 42px;
            border-radius: 16px !important;
            padding-left: 14px !important;
            padding-right: 14px !important;
        }
        #dashboardFilterControls { margin-top: 0 !important; }


        #dashboardTopFiscalYearBar {
            padding: 0 2px;
        }
        #dashboardProjectHeaderToolbar {
            border-top: 1px solid rgba(148,163,184,.14);
            padding-top: 16px;
        }
        #dashboardAddProjectBtn {
            box-shadow: 0 10px 26px rgba(15,23,42,.10);
        }
        html.dark #dashboardAddProjectBtn {
            box-shadow: 0 10px 26px rgba(255,255,255,.05);
        }


        /* v22: keep only one Add Project button and keep filters on one row */
        #dashboardProjectHeaderToolbar {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 18px !important;
            flex-wrap: nowrap !important;
        }
        #dashboardFilterControls {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: flex-end !important;
            gap: 12px !important;
            flex-wrap: nowrap !important;
            white-space: nowrap !important;
        }
        #dashboardSectionFilterBtns {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-end !important;
            gap: 8px !important;
            flex-wrap: nowrap !important;
        }
        #dashboardProjectHeaderToolbar .dashboard-filter-btn {
            white-space: nowrap !important;
            min-width: auto !important;
        }

        .budget-section-summary {
            border-top: 1px solid rgba(148,163,184,.16);
        }
        .budget-section-summary-grid {
            display: grid;
            grid-template-columns: repeat(1, minmax(0, 1fr));
            gap: 12px;
        }
        @media (min-width: 900px) {
            .budget-section-summary-grid {
                grid-template-columns: repeat(3, minmax(0, 1fr));
            }
        }
        .budget-section-card {
            border-radius: 18px;
            padding: 14px;
            border: 1px solid rgba(148,163,184,.18);
            background: rgba(255,255,255,.58);
        }
        html.dark .budget-section-card {
            background: rgba(15,23,42,.50);
            border-color: rgba(148,163,184,.16);
        }
        .budget-section-total-row {
            border-radius: 18px;
            border: 1px solid rgba(148,163,184,.18);
            background: linear-gradient(135deg, rgba(15,23,42,.055), rgba(14,165,233,.075));
        }
        html.dark .budget-section-total-row {
            background: linear-gradient(135deg, rgba(15,23,42,.68), rgba(14,165,233,.12));
        }

        @media (max-width: 900px) {
            #dashboardProjectHeaderToolbar,
            #dashboardFilterControls,
            #dashboardSectionFilterBtns {
                flex-wrap: wrap !important;
            }
        }

        @media (max-width: 768px) {
            .dash-project-card { padding: 18px !important; }
            .dash-code-badge { width: 42px; height: 42px; border-radius: 15px; }
            #dashboardFilterControls { padding: 12px; }
        }
    `;
    document.head.appendChild(style);
}

function applyTopMetricCardColors() {
    const cards = [
        { id: 'totalBudget', color: '#2563eb', bg: 'rgba(37,99,235,.26)', darkBg: 'rgba(37,99,235,.34)' },
        { id: 'usedBudget', color: '#f59e0b', bg: 'rgba(245,158,11,.28)', darkBg: 'rgba(245,158,11,.38)' },
        { id: 'remainingBudget', color: '#10b981', bg: 'rgba(16,185,129,.28)', darkBg: 'rgba(16,185,129,.38)' }
    ];
    const dark = document.documentElement.classList.contains('dark');
    cards.forEach(item => {
        const valueEl = document.getElementById(item.id);
        const card = valueEl?.closest('article');
        if (!card) return;
        card.style.setProperty('background', `linear-gradient(135deg, ${dark ? item.darkBg : item.bg}, rgba(15,23,42,.18))`, 'important');
        card.style.setProperty('border-color', item.color, 'important');
        card.style.setProperty('box-shadow', `inset 5px 0 0 ${item.color}, 0 16px 44px ${dark ? item.darkBg : item.bg}`, 'important');
        const icon = card.querySelector('.w-12.h-12');
        if (icon) {
            icon.style.setProperty('background-color', dark ? item.darkBg : item.bg, 'important');
            icon.style.setProperty('color', item.color, 'important');
        }
    });
}

function renderDashboard(data) {
    injectDashboardPolishStyle();
    const projects = Array.isArray(data.projects) ? data.projects : [];
    const urgentTasks = Array.isArray(data.urgentTasks) ? data.urgentTasks : [];

    const total = toNumber(data.summary?.totalBudget);
    const used = toNumber(data.summary?.usedBudget);
    const remaining = toNumber(data.summary?.remainingBudget);

    setText('totalBudget', baht(total));
    setText('usedBudget', baht(used));
    setText('remainingBudget', baht(remaining));
    setText('usedPercent', `${percent(used, total)}% ของงบประมาณรวมฝ่าย`);
    setText('remainingPercent', `${percent(remaining, total)}% ของงบประมาณรวมฝ่าย`);

    renderProjects(projects);
    renderUrgentTasks(urgentTasks);
    removeSectionBudgetChartPanel();
    renderBudgetChart(data.summary, Array.isArray(data.fiscalProjects) ? data.fiscalProjects : projects);
    applyTopMetricCardColors();

    if (!projects.length && !tasksCache.length) {
        showFirebaseStatus('ยังไม่มีข้อมูลโครงการใน Firebase แต่ระบบอ่านงบประมาณรวมจาก settings/budget แล้ว', 'info');
    } else {
        hideFirebaseStatus();
    }
}

function removeDashboardProjectDetailsModal() {
    const modal = document.getElementById('dashboardProjectDetailsModal');
    if (modal) modal.remove();
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
}

function detailRow(label, value) {
    return `
        <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 p-4">
            <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">${escapeHtml(label)}</div>
            <div class="font-bold text-slate-900 dark:text-white break-words">${escapeHtml(value ?? '-')}</div>
        </div>
    `;
}

function openDashboardProjectDetails(projectId) {
    removeDashboardProjectDetailsModal();
    const project = projectsCache.find(item => item.id === projectId);
    if (!project) return;

    const section = getProjectSection(project);
    const sectionColor = getSectionColor(section);
    const sectionLabel = getSectionLabel(section);
    const approvedBudget = getProjectApprovedBudget(project);
    const requestedBudget = toNumber(project.requestedBudget || project.total || 0);
    const usedBudget = toNumber(project.used || project.usedBudget || project.budgetSpent || 0);
    const remainingBudget = Math.max(approvedBudget - usedBudget, 0);
    const budgetPercent = percent(approvedBudget, toNumber(globalBudget || DEFAULT_TOTAL_BUDGET));
    const usedPercent = percent(usedBudget, approvedBudget);
    const statusText = project.status === 'pending' ? 'รออนุมัติ' : project.status === 'approved' ? 'อนุมัติแล้ว' : project.status === 'rejected' ? 'ไม่อนุมัติ' : project.status;

    const modal = document.createElement('div');
    modal.id = 'dashboardProjectDetailsModal';
    modal.className = 'dashboard-project-modal fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4';
    modal.innerHTML = `
        <div id="dashboardProjectDetailsContent" class="w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-3xl border border-slate-200/20 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
            <div class="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70">
                <div>
                    <p class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">รายละเอียดโครงการ</p>
                    <h3 class="text-lg font-extrabold text-slate-900 dark:text-white mt-1">${escapeHtml(project.name || project.title || 'ไม่ระบุชื่อโครงการ')}</h3>
                </div>
                <button id="closeDashboardProjectDetailsBtn" type="button" class="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors">
                    <i class="ph ph-x text-xl"></i>
                </button>
            </div>
            <div class="p-6 overflow-y-auto max-h-[70vh]">
                <div class="space-y-5">
                    <div class="rounded-3xl border p-5" style="border-color:${escapeAttr(sectionColor)}; background:linear-gradient(135deg, ${escapeAttr(sectionColor)}22, transparent)">
                        <div class="flex items-start gap-4">
                            <div class="w-12 h-12 rounded-2xl text-white flex items-center justify-center font-extrabold shrink-0" style="background:${escapeAttr(sectionColor)}">${escapeHtml(project.code || 'งา')}</div>
                            <div class="min-w-0">
                                <h4 class="text-xl font-extrabold text-slate-900 dark:text-white">${escapeHtml(project.name || project.title || '-')}</h4>
                                <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">${escapeHtml(project.description || 'ไม่มีรายละเอียด')}</p>
                                <div class="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold" style="background:${escapeAttr(sectionColor)}22;color:${escapeAttr(sectionColor)}">${escapeHtml(sectionLabel)}</div>
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        ${detailRow('งบที่อนุมัติ', baht(approvedBudget))}
                        ${detailRow('งบที่เสนอขอ', baht(requestedBudget))}
                        ${detailRow('งบที่ใช้จริง', baht(usedBudget))}
                        ${detailRow('งบคงเหลือ', baht(remainingBudget))}
                        ${detailRow('สัดส่วนงบที่อนุมัติ', `${budgetPercent}% ของงบรวมฝ่าย`)}
                        ${detailRow('การใช้งบจากงบอนุมัติ', `${usedPercent}%`)}
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        ${detailRow('ผู้รับผิดชอบ', project.ownerName || project.owner || '-')}
                        ${detailRow('อีเมลผู้รับผิดชอบ', project.ownerEmail || '-')}
                        ${detailRow('ส่วนงาน', sectionLabel)}
                        ${detailRow('สิทธิ์/บทบาท', project.ownerRole || '-')}
                        ${detailRow('สถานะ', statusText)}
                        ${detailRow('ระยะเวลา', project.durationLabel || '-')}
                    </div>
                    <div class="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/70 dark:bg-slate-800/60">
                        <div class="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <span>สัดส่วนงบที่อนุมัติเทียบงบรวมฝ่าย</span>
                            <span>${budgetPercent}%</span>
                        </div>
                        <div class="progress-track"><div class="progress-fill" style="width:${clamp(budgetPercent)}%; background:${escapeAttr(sectionColor)}"></div></div>
                    </div>
                    ${project.managerComment ? `<div class="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300"><b>คอมเมนต์หัวหน้า:</b> ${escapeHtml(project.managerComment)}</div>` : ''}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.getElementById('closeDashboardProjectDetailsBtn')?.addEventListener('click', removeDashboardProjectDetailsModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) removeDashboardProjectDetailsModal();
    });
}

window.openDashboardProjectDetails = openDashboardProjectDetails;
window.closeDashboardProjectDetailsModal = removeDashboardProjectDetailsModal;
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') removeDashboardProjectDetailsModal();
});

function renderProjects(projects) {
    const list = document.getElementById('projectList');
    if (!list) return;
    if (!projects.length) {
        list.innerHTML = `<div class="rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-8 text-center text-sm text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/50">ยังไม่มีข้อมูลโครงการในปีงบประมาณหรือส่วนงานที่เลือก</div>`;
        return;
    }
    list.innerHTML = projects.map(project => {
        const approvedBudget = getProjectApprovedBudget(project);
        const budgetPercent = percent(approvedBudget, toNumber(globalBudget || DEFAULT_TOTAL_BUDGET));
        const statusText = project.status === 'pending' ? 'รออนุมัติ' : project.status === 'approved' ? 'อนุมัติแล้ว' : project.status === 'rejected' ? 'ไม่อนุมัติ' : project.status;
        const section = getProjectSection(project);
        const sectionColor = getSectionColor(section);
        const sectionLabel = getSectionLabel(section);
        const sectionSoft = `${sectionColor}33`;
        return `
            <article onclick="window.openDashboardProjectDetails('${escapeAttr(project.id)}')" class="dash-project-card cursor-pointer p-5 transition-all" style="--section-color:${escapeAttr(sectionColor)};--section-soft:${escapeAttr(sectionSoft)}">
                <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div class="flex items-start gap-4 min-w-0">
                        <div class="dash-code-badge shrink-0" style="background:${escapeAttr(sectionColor)}" title="${escapeAttr(sectionLabel)}">${escapeHtml(project.code || 'งา')}</div>
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2 mb-1">
                                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold" style="background:${escapeAttr(sectionColor)}22;color:${escapeAttr(sectionColor)}">${escapeHtml(sectionLabel)}</span>
                                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">${escapeHtml(statusText)}</span>
                            </div>
                            <h4 class="font-extrabold text-lg text-slate-900 dark:text-white leading-snug">${escapeHtml(project.name)}</h4>
                            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">${escapeHtml(project.owner)}</p>
                            <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">ระยะเวลา: ${escapeHtml(project.durationLabel || '-')}</p>
                        </div>
                    </div>
                    <div class="dash-budget-pill text-right shrink-0 min-w-[150px]">
                        <p class="text-[11px] text-slate-500 dark:text-slate-400 font-bold">งบที่อนุมัติ</p>
                        <strong class="text-xl text-slate-900 dark:text-white">${baht(approvedBudget)}</strong>
                        <p class="text-[11px] mt-1" style="color:${escapeAttr(sectionColor)}">${budgetPercent}% ของงบรวม</p>
                    </div>
                </div>
                <div class="mt-5">
                    <div class="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                        <span>สัดส่วนงบที่อนุมัติ</span>
                        <span>${budgetPercent}%</span>
                    </div>
                    <div class="progress-track"><div class="progress-fill" style="width:${clamp(budgetPercent)}%; background:${escapeAttr(sectionColor)}"></div></div>
                </div>
            </article>
        `;
    }).join('');
}

function renderUrgentTasks(tasks) {
    const list = document.getElementById('urgentList');
    if (!list) return;
    if (!tasks.length) {
        list.innerHTML = `<div class="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-4 text-sm text-slate-500 dark:text-slate-400">ยังไม่มีงานที่ล่าช้าหรือใกล้ถึงกำหนดในช่วง 3 เดือน</div>`;
        return;
    }
    const toneClass = {
        red: 'bg-red-500/10 text-red-500 border-red-500/35',
        amber: 'bg-amber-500/10 text-amber-500 border-amber-500/35',
        sky: 'bg-sky-500/10 text-sky-500 border-sky-500/35',
        slate: 'bg-slate-500/10 text-slate-500 border-slate-500/35'
    };
    list.innerHTML = tasks.map(task => {
        const info = task.urgencyInfo || getTaskUrgencyInfo(task);
        const badgeClass = toneClass[info.tone] || toneClass.slate;
        const dueText = task.dueDate ? ` • กำหนด: ${task.dueDate.toLocaleDateString('th-TH')}` : '';
        return `
            <article class="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/55 p-4">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h4 class="font-bold text-sm text-slate-900 dark:text-white">${escapeHtml(task.title)}</h4>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            <i class="ph ph-folder"></i> ${escapeHtml(task.project)}
                            <span class="mx-1">•</span>
                            <i class="ph ph-user"></i> ${escapeHtml(task.assignee)}${escapeHtml(dueText)}
                        </p>
                    </div>
                    <span class="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-lg border text-xs font-bold ${badgeClass}">
                        <i class="ph ph-clock"></i>${escapeHtml(info.label)}
                    </span>
                </div>
                <div class="text-right mt-2 font-bold text-sm text-slate-900 dark:text-white">${baht(task.amount)}</div>
            </article>
        `;
    }).join('');
}


function removeSectionBudgetChartPanel() {
    const canvas = document.getElementById('workloadChart');
    const section = canvas?.closest('section');
    const parent = section?.parentElement;
    if (section) section.remove();
    if (parent) parent.className = 'grid grid-cols-1 gap-5';
}

function ensureBudgetSectionSummaryPanel() {
    const canvas = document.getElementById('budgetChart');
    const section = canvas?.closest('section');
    if (!section) return null;

    let panel = document.getElementById('budgetSectionSummary');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'budgetSectionSummary';
        panel.className = 'budget-section-summary px-5 pb-5 pt-4';
        section.appendChild(panel);
    }
    return panel;
}

function renderBudgetSectionSummary(stats) {
    const panel = ensureBudgetSectionSummaryPanel();
    if (!panel || !stats) return;

    const rowsHtml = stats.rows.map(row => {
        const remainingTone = row.over > 0 ? 'text-red-500 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300';
        const remainingLabel = row.over > 0 ? `เกินงบ ${baht(row.over)}` : baht(row.remaining);
        return `
            <article class="budget-section-card" style="border-color:${escapeAttr(colorWithAlpha(row.color, '88'))}; box-shadow: inset 4px 0 0 ${escapeAttr(row.color)}">
                <div class="flex items-center justify-between gap-3 mb-3">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-3 h-3 rounded-full shrink-0" style="background:${escapeAttr(row.color)}"></span>
                        <h4 class="font-extrabold text-sm text-slate-900 dark:text-white truncate">${escapeHtml(row.label)}</h4>
                    </div>
                    <span class="text-[11px] font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap">ใช้ ${row.usagePercent}%</span>
                </div>
                <div class="space-y-2 text-xs">
                    <div class="flex justify-between gap-3"><span class="text-slate-500 dark:text-slate-400">งบที่กระจาย</span><b class="text-slate-900 dark:text-white">${baht(row.allocated)}</b></div>
                    <div class="flex justify-between gap-3"><span class="text-slate-500 dark:text-slate-400">งบรวมที่อนุมัติ</span><b style="color:${escapeAttr(row.color)}">${baht(row.approved)}</b></div>
                    <div class="flex justify-between gap-3"><span class="text-slate-500 dark:text-slate-400">งบคงเหลือส่วนงาน</span><b class="${remainingTone}">${remainingLabel}</b></div>
                </div>
            </article>
        `;
    }).join('');

    panel.innerHTML = `
        <div class="mb-3 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
            <div>
                <h4 class="text-sm font-extrabold text-slate-900 dark:text-white">สรุปงบตามส่วนงาน</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">งบที่กระจาย / งบที่อนุมัติ / งบคงเหลือของแต่ละส่วนงาน</p>
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400">ยังไม่กระจาย: <b class="text-slate-900 dark:text-white">${baht(stats.unallocated)}</b></div>
        </div>
        <div class="budget-section-summary-grid">${rowsHtml}</div>
        <div class="budget-section-total-row mt-4 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
                <div class="text-xs text-slate-500 dark:text-slate-400">สรุปงบรวมปีงบประมาณ ${escapeHtml(selectedDashboardFiscalYear)}</div>
                <div class="text-sm font-extrabold text-slate-900 dark:text-white mt-1">งบรวมทั้งหมด ${baht(stats.totalBudget)} • กระจายแล้ว ${baht(stats.allocatedTotal)}</div>
            </div>
            <div class="flex flex-wrap gap-3 text-sm font-extrabold">
                <span class="text-amber-600 dark:text-amber-300">ใช้ไปทั้งหมด ${baht(stats.approvedTotal)}</span>
                <span class="text-emerald-600 dark:text-emerald-300">คงเหลือรวม ${baht(stats.totalRemaining)}</span>
            </div>
        </div>
    `;
}

function renderBudgetChart(summary, projects = []) {
    const canvas = document.getElementById('budgetChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const total = toNumber(summary?.totalBudget || globalBudget || DEFAULT_TOTAL_BUDGET);
    const stats = buildSectionBudgetStats(projects, total);
    const chartLabels = [];
    const chartValues = [];
    const chartColors = [];

    stats.rows.forEach(row => {
        if (row.approved > 0) {
            chartLabels.push(`${row.label} อนุมัติแล้ว`);
            chartValues.push(row.approved);
            chartColors.push(row.color);
        }
        if (row.remaining > 0) {
            chartLabels.push(`${row.label} คงเหลือ`);
            chartValues.push(row.remaining);
            chartColors.push(colorWithAlpha(row.color, '55'));
        }
    });

    if (stats.unallocated > 0) {
        chartLabels.push('ยังไม่กระจาย');
        chartValues.push(stats.unallocated);
        chartColors.push('#64748b');
    }

    if (!chartValues.length) {
        chartLabels.push('ยังไม่มีข้อมูลงบประมาณ');
        chartValues.push(1);
        chartColors.push('rgba(100,116,139,.35)');
    }

    if (budgetChart) budgetChart.destroy();
    budgetChart = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: chartLabels,
            datasets: [{
                label: `งบประมาณทั้งหมด ${baht(total)}`,
                data: chartValues,
                backgroundColor: chartColors,
                borderColor: 'rgba(255,255,255,.18)',
                borderWidth: 2
            }]
        },
        options: chartPieOptions()
    });

    renderBudgetSectionSummary(stats);
}

function chartPieOptions() {
    const isDark = document.documentElement.classList.contains('dark');
    return { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'top', labels: { color: isDark ? '#cbd5e1' : '#475569', boxWidth: 18, usePointStyle: true } }, tooltip: { callbacks: { label: (context) => { const value = Number(context.raw || 0); const total = context.dataset.data.reduce((sum, item) => sum + Number(item || 0), 0); const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'; return `${context.label}: ${baht(value)} (${pct}%)`; } } } } };
}

function renderWorkloadChart() {
    // รวมสัดส่วนงบตามส่วนงานเข้าไปใน budgetChart แล้ว จึงไม่ต้อง render chart แยก
}

function chartBaseOptions(stacked) {
    const isDark = document.documentElement.classList.contains('dark');
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
            legend: { labels: { color: isDark ? '#cbd5e1' : '#475569', boxWidth: 18 } }
        },
        scales: {
            x: { stacked, ticks: { color: isDark ? '#cbd5e1' : '#475569', maxRotation: 0, autoSkip: true }, grid: { color: 'rgba(148,163,184,.12)' } },
            y: { stacked, beginAtZero: true, ticks: { color: isDark ? '#cbd5e1' : '#475569' }, grid: { color: 'rgba(148,163,184,.16)' } }
        }
    };
}

function injectMetricCardThemeStyle() {
    if (document.getElementById('metricSoftCardThemeStyle')) return;

    const style = document.createElement('style');
    style.id = 'metricSoftCardThemeStyle';
    style.textContent = `
        /* Force override dashboard-card dark/black background */
        article.metric-soft-card,
        .dashboard-card.metric-soft-card,
        .metric-card.metric-soft-card {
            position: relative !important;
            overflow: hidden !important;
            border-width: 1px !important;
            backdrop-filter: blur(14px) !important;
            transition: background .25s ease, border-color .25s ease, box-shadow .25s ease, transform .25s ease !important;
            background-color: transparent !important;
            background-blend-mode: normal !important;
        }

        article.metric-soft-card::before,
        .dashboard-card.metric-soft-card::before,
        .metric-card.metric-soft-card::before {
            content: "" !important;
            position: absolute !important;
            inset: 0 !important;
            pointer-events: none !important;
            opacity: 1 !important;
            z-index: 0 !important;
        }

        article.metric-soft-card > *,
        .dashboard-card.metric-soft-card > *,
        .metric-card.metric-soft-card > * {
            position: relative !important;
            z-index: 1 !important;
        }

        article.metric-soft-card:hover,
        .dashboard-card.metric-soft-card:hover,
        .metric-card.metric-soft-card:hover {
            transform: translateY(-1px) !important;
        }

        /* LIGHT MODE */
        html:not(.dark) article.metric-soft-card[data-metric-card="total"],
        html:not(.dark) .dashboard-card.metric-soft-card[data-metric-card="total"] {
            background: linear-gradient(135deg, rgba(37, 99, 235, .20) 0%, rgba(37, 99, 235, .105) 42%, rgba(37, 99, 235, .045) 100%) !important;
            border-color: rgba(37, 99, 235, .42) !important;
            box-shadow: inset 4px 0 0 rgba(37, 99, 235, .95), 0 18px 44px rgba(37, 99, 235, .13) !important;
        }
        html:not(.dark) article.metric-soft-card[data-metric-card="used"],
        html:not(.dark) .dashboard-card.metric-soft-card[data-metric-card="used"] {
            background: linear-gradient(135deg, rgba(245, 158, 11, .22) 0%, rgba(245, 158, 11, .115) 42%, rgba(245, 158, 11, .048) 100%) !important;
            border-color: rgba(245, 158, 11, .46) !important;
            box-shadow: inset 4px 0 0 rgba(245, 158, 11, .95), 0 18px 44px rgba(245, 158, 11, .13) !important;
        }
        html:not(.dark) article.metric-soft-card[data-metric-card="remaining"],
        html:not(.dark) .dashboard-card.metric-soft-card[data-metric-card="remaining"] {
            background: linear-gradient(135deg, rgba(16, 185, 129, .22) 0%, rgba(16, 185, 129, .115) 42%, rgba(16, 185, 129, .048) 100%) !important;
            border-color: rgba(16, 185, 129, .46) !important;
            box-shadow: inset 4px 0 0 rgba(16, 185, 129, .95), 0 18px 44px rgba(16, 185, 129, .13) !important;
        }

        /* DARK MODE - stronger tint so it won't look black */
        html.dark article.metric-soft-card[data-metric-card="total"],
        html.dark .dashboard-card.metric-soft-card[data-metric-card="total"] {
            background: linear-gradient(135deg, rgba(37, 99, 235, .34) 0%, rgba(37, 99, 235, .18) 42%, rgba(37, 99, 235, .075) 100%) !important;
            border-color: rgba(96, 165, 250, .55) !important;
            box-shadow: inset 4px 0 0 rgba(37, 99, 235, 1), 0 18px 46px rgba(37, 99, 235, .24) !important;
        }
        html.dark article.metric-soft-card[data-metric-card="used"],
        html.dark .dashboard-card.metric-soft-card[data-metric-card="used"] {
            background: linear-gradient(135deg, rgba(245, 158, 11, .36) 0%, rgba(245, 158, 11, .19) 42%, rgba(245, 158, 11, .08) 100%) !important;
            border-color: rgba(251, 191, 36, .58) !important;
            box-shadow: inset 4px 0 0 rgba(245, 158, 11, 1), 0 18px 46px rgba(245, 158, 11, .23) !important;
        }
        html.dark article.metric-soft-card[data-metric-card="remaining"],
        html.dark .dashboard-card.metric-soft-card[data-metric-card="remaining"] {
            background: linear-gradient(135deg, rgba(16, 185, 129, .36) 0%, rgba(16, 185, 129, .19) 42%, rgba(16, 185, 129, .08) 100%) !important;
            border-color: rgba(52, 211, 153, .58) !important;
            box-shadow: inset 4px 0 0 rgba(16, 185, 129, 1), 0 18px 46px rgba(16, 185, 129, .23) !important;
        }

        html.dark article.metric-soft-card[data-metric-card="total"]::before,
        html.dark .dashboard-card.metric-soft-card[data-metric-card="total"]::before {
            background: radial-gradient(circle at 14% 20%, rgba(96, 165, 250, .22), transparent 38%) !important;
        }
        html.dark article.metric-soft-card[data-metric-card="used"]::before,
        html.dark .dashboard-card.metric-soft-card[data-metric-card="used"]::before {
            background: radial-gradient(circle at 14% 20%, rgba(251, 191, 36, .24), transparent 38%) !important;
        }
        html.dark article.metric-soft-card[data-metric-card="remaining"]::before,
        html.dark .dashboard-card.metric-soft-card[data-metric-card="remaining"]::before {
            background: radial-gradient(circle at 14% 20%, rgba(52, 211, 153, .24), transparent 38%) !important;
        }
    `;
    document.head.appendChild(style);
}

function getFallbackDashboardHtml() {
    return `
        <section class="space-y-6">
            <div id="firebaseStatus" class="hidden rounded-2xl border px-4 py-3 text-sm"></div>
            <div class="grid grid-cols-1 xl:grid-cols-3 gap-5">
                <article class="dashboard-card metric-card rounded-2xl p-6" style="--accent:#2563eb"><p class="text-xs font-semibold text-slate-500 dark:text-slate-400">งบประมาณรวมฝ่าย</p><h3 id="totalBudget" class="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">฿0</h3><p class="text-xs font-semibold text-blue-500 mt-1">อ่านจาก settings/budget.totalBudget</p></article>
                <article class="dashboard-card metric-card rounded-2xl p-6" style="--accent:#f59e0b"><p class="text-xs font-semibold text-slate-500 dark:text-slate-400">งบที่อนุมัติแล้ว</p><h3 id="usedBudget" class="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">฿0</h3><p id="usedPercent" class="text-xs font-semibold text-amber-500 mt-1">0%</p></article>
                <article class="dashboard-card metric-card rounded-2xl p-6" style="--accent:#10b981"><p class="text-xs font-semibold text-slate-500 dark:text-slate-400">งบประมาณรวมคงเหลือ</p><h3 id="remainingBudget" class="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">฿0</h3><p id="remainingPercent" class="text-xs font-semibold text-emerald-500 mt-1">0%</p></article>
            </div>
            <div class="grid grid-cols-1 2xl:grid-cols-7 gap-5">
                <section class="dashboard-card rounded-2xl 2xl:col-span-4 overflow-hidden"><div class="px-6 py-5 border-b border-slate-200/70 dark:border-slate-700/70"><h3 class="font-bold text-slate-900 dark:text-white">สถานะงบประมาณโครงการย่อย</h3></div><div id="projectList" class="p-5 space-y-4 max-h-[390px] overflow-y-auto soft-scroll"></div></section>
                <section class="dashboard-card rounded-2xl 2xl:col-span-3 overflow-hidden"><div class="px-6 py-5 border-b border-slate-200/70 dark:border-slate-700/70"><h3 class="font-bold text-slate-900 dark:text-white">สัดส่วนงบประมาณทั้งหมด กระจายแล้ว ใช้ไป คงเหลือ</h3></div><div class="p-5 chart-box"><canvas id="budgetChart"></canvas></div></section>
            </div>
            <div class="grid grid-cols-1 gap-5">
                <section class="dashboard-card rounded-2xl overflow-hidden"><div class="px-6 py-5 border-b border-slate-200/70 dark:border-slate-700/70"><h3 class="font-bold text-slate-900 dark:text-white">งานที่ล่าช้าหรือใกล้ถึงกำหนดส่ง (Overdue / Urgent)</h3></div><div id="urgentList" class="p-5 space-y-3"></div></section>
            </div>
        </section>
    `;
}

function showFirebaseStatus(message, type = 'info') {
    const el = document.getElementById('firebaseStatus');
    if (!el) return;

    const styles = {
        info: 'border-blue-400/40 bg-blue-500/10 text-blue-600 dark:text-blue-300',
        success: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
        error: 'border-red-400/40 bg-red-500/10 text-red-600 dark:text-red-300'
    };

    el.className = `rounded-2xl border px-4 py-3 text-sm ${styles[type] || styles.info}`;
    el.textContent = message;
}

function hideFirebaseStatus() {
    const el = document.getElementById('firebaseStatus');
    if (el) el.classList.add('hidden');
}

function getProjectDurationText(data) {
    if (data.noDeadline) return 'ไม่มีกำหนดเวลา';
    if (data.startDate && data.endDate) return `${formatThaiDate(data.startDate)} - ${formatThaiDate(data.endDate)}`;
    return '-';
}

function formatThaiDate(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString || '-';
    return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function showBody() {
    document.getElementById('appBody')?.classList.remove('hidden');
}

function toNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
}

function baht(value) {
    return `฿${toNumber(value).toLocaleString('th-TH')}`;
}

function percent(part, total) {
    return total > 0 ? ((toNumber(part) / toNumber(total)) * 100).toFixed(1) : '0.0';
}

function clamp(value) {
    return Math.max(0, Math.min(100, toNumber(value)));
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[char]));
}

function escapeAttr(value) {
    return escapeHtml(value);
}
