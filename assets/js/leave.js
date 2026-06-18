// assets/js/leave.js
// Version: leave-header-template-v2
import { db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection,
    getDocs,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    query,
    where,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log('leave.js loaded: leave-header-template-v2');

const TYPES = { annual: 'ลาพักร้อน', sick: 'ลาป่วย', personal: 'ลากิจ' };
const ROLE_LABELS = { admin: 'ผู้ดูแลระบบ', manager: 'หัวหน้างาน', secretary: 'เลขาฯ', staff: 'เจ้าหน้าที่', employee: 'เจ้าหน้าที่' };

let currentUser = null;
let currentUserUid = null;
let isMockMode = false;
let canApprove = false;

function byId(id) { return document.getElementById(id); }
function safeText(value, fallback = '-') { return String(value ?? '').trim() || fallback; }
function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
function setText(id, value) { const el = byId(id); if (el) el.textContent = value; }
function showBody() { byId('appBody')?.classList.remove('hidden'); }

function getLeaveQuota(user, type) {
    return user?.leaveQuota?.[type] ?? user?.leave_quota?.[type] ?? (type === 'annual' ? 10 : 30);
}

function showPageAlert(message, type = 'info') {
    const el = byId('pageAlert');
    if (!el) return;
    const styleMap = {
        info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
        success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
        error: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
        warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
    };
    el.className = `rounded-2xl border px-4 py-3 text-sm ${styleMap[type] || styleMap.info}`;
    el.textContent = message;
    el.classList.remove('hidden');
    if (type !== 'error') setTimeout(() => el.classList.add('hidden'), 4000);
}

function setupSharedUIFallback() {
    const themeToggleBtn = byId('themeToggleBtn');
    themeToggleBtn?.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('color-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });

    const mobileMenuBtn = byId('mobileMenuBtn');
    const closeSidebarBtn = byId('closeSidebarBtn');
    const sidebar = byId('sidebar');
    const mobileOverlay = byId('mobileOverlay');
    const toggleMenu = () => {
        if (!sidebar || !mobileOverlay) return;
        sidebar.classList.toggle('-translate-x-full');
        mobileOverlay.classList.toggle('hidden');
        setTimeout(() => mobileOverlay.classList.toggle('opacity-0'), 10);
    };
    mobileMenuBtn?.addEventListener('click', toggleMenu);
    closeSidebarBtn?.addEventListener('click', toggleMenu);
    mobileOverlay?.addEventListener('click', toggleMenu);
}

async function waitForLeaveTemplateElements() {
    // header.js may inject header.html/layout before content is available.
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
        if (byId('tabMyLeaves') && byId('requestLeaveBtn') && byId('myLeavesTableBody')) return true;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    return Boolean(byId('tabMyLeaves'));
}

async function checkPermission(user, uid, action) {
    if (isMockMode) {
        if (action === 'approve_leave') return ['admin', 'manager'].includes(user.role);
        return true;
    }
    try {
        const overrideDoc = await getDoc(doc(db, 'user_overrides', uid));
        const override = overrideDoc.exists() ? overrideDoc.data()?.overrides?.[action] : null;
        if (override === 'deny') return false;
        if (override === 'allow') return true;

        const roleDefaults = {
            admin: ['approve_leave', 'manage_users', 'create_project', 'approve_project'],
            manager: ['approve_leave', 'create_project'],
            secretary: ['create_project'],
            staff: ['create_project'],
            employee: ['create_project']
        };
        return (roleDefaults[user?.role] || []).includes(action);
    } catch (error) {
        console.error('Permission check error:', error);
        return false;
    }
}

async function initLeaveSystem(user, uid) {
    showBody();
    await waitForLeaveTemplateElements();
    setupSharedUIFallback();

    setText('userName', safeText(user?.name, user?.email || 'ผู้ใช้งาน'));
    setText('userRole', ROLE_LABELS[user?.role] || user?.role || 'เจ้าหน้าที่');
    if (user?.role === 'admin') byId('adminMenu')?.classList.remove('hidden');

    const logoutBtn = byId('logoutBtn');
    if (logoutBtn && !logoutBtn.dataset.leaveBound) {
        logoutBtn.dataset.leaveBound = '1';
        logoutBtn.addEventListener('click', async () => {
            if (isMockMode) {
                localStorage.removeItem('mockUser');
                window.location.href = 'login.html';
                return;
            }
            await signOut(auth);
            window.location.href = 'login.html';
        });
    }

    setText('quotaAnnual', getLeaveQuota(user, 'annual'));
    setText('quotaSick', getLeaveQuota(user, 'sick'));

    canApprove = await checkPermission(user, uid, 'approve_leave');
    if (canApprove) {
        byId('tabApprovals')?.classList.remove('hidden');
        await loadPendingApprovals();
    }

    setupTabs();
    setupLeaveModal();
    await loadMyLeaves(uid);
}

function setupTabs() {
    const tabMyLeaves = byId('tabMyLeaves');
    const tabApprovals = byId('tabApprovals');
    const viewMyLeaves = byId('viewMyLeaves');
    const viewApprovals = byId('viewApprovals');
    if (!tabMyLeaves || !tabApprovals || !viewMyLeaves || !viewApprovals) return;
    if (tabMyLeaves.dataset.bound) return;
    tabMyLeaves.dataset.bound = '1';

    const activeClass = ['text-brand-600', 'dark:text-sky-400', 'border-brand-600', 'dark:border-sky-400', 'bg-brand-50', 'dark:bg-slate-800/50'];
    const inactiveClass = ['text-slate-500', 'dark:text-slate-400', 'border-transparent', 'hover:text-slate-800', 'dark:hover:text-white'];

    tabMyLeaves.addEventListener('click', () => {
        viewMyLeaves.classList.remove('hidden');
        viewApprovals.classList.add('hidden');
        tabMyLeaves.classList.add(...activeClass);
        tabMyLeaves.classList.remove(...inactiveClass);
        tabApprovals.classList.add(...inactiveClass);
        tabApprovals.classList.remove(...activeClass);
    });

    tabApprovals.addEventListener('click', () => {
        viewMyLeaves.classList.add('hidden');
        viewApprovals.classList.remove('hidden');
        tabApprovals.classList.add(...activeClass);
        tabApprovals.classList.remove(...inactiveClass);
        tabMyLeaves.classList.add(...inactiveClass);
        tabMyLeaves.classList.remove(...activeClass);
    });
}

function setupLeaveModal() {
    const leaveModal = byId('leaveModal');
    const leaveModalContent = byId('leaveModalContent');
    const leaveForm = byId('leaveForm');
    if (!leaveModal || !leaveModalContent || !leaveForm) return;
    if (leaveForm.dataset.bound) return;
    leaveForm.dataset.bound = '1';

    const toggleModal = (show) => {
        if (show) {
            leaveModal.classList.remove('hidden');
            leaveModal.classList.add('flex');
            document.body.style.overflow = 'hidden';
            requestAnimationFrame(() => {
                leaveModal.classList.remove('opacity-0');
                leaveModalContent.classList.remove('scale-95');
            });
        } else {
            leaveModal.classList.add('opacity-0');
            leaveModalContent.classList.add('scale-95');
            document.body.style.overflow = '';
            setTimeout(() => {
                leaveModal.classList.add('hidden');
                leaveModal.classList.remove('flex');
            }, 180);
            leaveForm.reset();
            byId('leaveModalError')?.classList.add('hidden');
        }
    };

    byId('requestLeaveBtn')?.addEventListener('click', () => toggleModal(true));
    byId('closeLeaveModalBtn')?.addEventListener('click', () => toggleModal(false));
    byId('cancelLeaveModalBtn')?.addEventListener('click', () => toggleModal(false));
    leaveModal.addEventListener('click', (event) => { if (event.target === leaveModal) toggleModal(false); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !leaveModal.classList.contains('hidden')) toggleModal(false); });

    leaveForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const errorMsg = byId('leaveModalError');
        const saveBtn = byId('saveLeaveBtn');
        const spinner = byId('saveLeaveSpinner');
        errorMsg?.classList.add('hidden');
        if (saveBtn) saveBtn.disabled = true;
        spinner?.classList.remove('hidden');

        const type = byId('leaveType')?.value;
        const start = byId('leaveStart')?.value;
        const end = byId('leaveEnd')?.value;
        const reason = byId('leaveReason')?.value?.trim();
        const startDate = new Date(`${start}T00:00:00`);
        const endDate = new Date(`${end}T00:00:00`);

        try {
            if (!type || !start || !end || !reason) throw new Error('กรุณากรอกข้อมูลให้ครบถ้วน');
            if (endDate < startDate) throw new Error('วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น');

            const totalDays = Math.ceil(Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            if (isMockMode) {
                showPageAlert('Mock Mode: ส่งใบลาสำเร็จ (จำลอง)', 'success');
                toggleModal(false);
                return;
            }

            await addDoc(collection(db, 'leaves'), {
                userId: currentUserUid,
                userName: currentUser?.name || currentUser?.email || 'Unknown',
                userEmail: currentUser?.email || '',
                type,
                startDate: Timestamp.fromDate(startDate),
                endDate: Timestamp.fromDate(endDate),
                totalDays,
                reason,
                status: 'pending',
                createdAt: Timestamp.now()
            });
            toggleModal(false);
            showPageAlert('ส่งใบลาเรียบร้อยแล้ว', 'success');
            await loadMyLeaves(currentUserUid);
        } catch (error) {
            console.error('Save Leave Error:', error);
            if (errorMsg) {
                errorMsg.textContent = error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
                errorMsg.classList.remove('hidden');
            }
        } finally {
            if (saveBtn) saveBtn.disabled = false;
            spinner?.classList.add('hidden');
        }
    });
}

function statusBadge(status) {
    const map = {
        pending: '<span class="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-medium border border-amber-200 dark:border-amber-800/50">รออนุมัติ</span>',
        approved: '<span class="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-800/50">อนุมัติแล้ว</span>',
        rejected: '<span class="inline-block px-3 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-medium border border-red-200 dark:border-red-800/50">ไม่อนุมัติ</span>'
    };
    return map[status] || escapeHtml(status);
}

function formatDateRange(data) {
    const startStr = data.startDate?.toDate ? data.startDate.toDate().toLocaleDateString('th-TH') : '-';
    const endStr = data.endDate?.toDate ? data.endDate.toDate().toLocaleDateString('th-TH') : '-';
    return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
}

async function loadMyLeaves(uid) {
    const tbody = byId('myLeavesTableBody');
    if (!tbody) return;
    if (isMockMode) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500">Mock Data Mode</td></tr>`;
        return;
    }
    try {
        const q = query(collection(db, 'leaves'), where('userId', '==', uid));
        const querySnapshot = await getDocs(q);
        const leaves = [];
        querySnapshot.forEach((docSnap) => leaves.push({ id: docSnap.id, ...docSnap.data() }));
        leaves.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

        if (!leaves.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-slate-500">ไม่มีประวัติการลา</td></tr>`;
            return;
        }

        tbody.innerHTML = leaves.map(data => `
            <tr class="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                <td class="py-4 px-4 font-medium">${escapeHtml(TYPES[data.type] || data.type)}</td>
                <td class="py-4 px-4 text-slate-500 dark:text-slate-400">${escapeHtml(formatDateRange(data))}</td>
                <td class="py-4 px-4 text-center">${escapeHtml(data.totalDays)}</td>
                <td class="py-4 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate" title="${escapeHtml(data.reason)}">${escapeHtml(data.reason)}</td>
                <td class="py-4 px-4 text-center">${statusBadge(data.status)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading leaves:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-red-500">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
    }
}

async function loadPendingApprovals() {
    if (isMockMode) return;
    const tbody = byId('approvalsTableBody');
    const badge = byId('pendingBadge');
    if (!tbody) return;
    try {
        const q = query(collection(db, 'leaves'), where('status', '==', 'pending'));
        const querySnapshot = await getDocs(q);
        const items = [];
        querySnapshot.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() }));
        items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

        if (!items.length) {
            tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-slate-500">ไม่มีรายการรออนุมัติ</td></tr>`;
            badge?.classList.add('hidden');
            return;
        }

        if (badge) {
            badge.textContent = items.length;
            badge.classList.remove('hidden');
        }

        tbody.innerHTML = items.map(data => `
            <tr class="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                <td class="py-4 px-4 font-medium">${escapeHtml(data.userName || 'Unknown')}</td>
                <td class="py-4 px-4">
                    <div class="font-medium text-slate-800 dark:text-white">${escapeHtml(TYPES[data.type] || data.type)} (${escapeHtml(data.totalDays)} วัน)</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(formatDateRange(data))}</div>
                </td>
                <td class="py-4 px-4 text-sm max-w-xs truncate" title="${escapeHtml(data.reason)}">${escapeHtml(data.reason)}</td>
                <td class="py-4 px-4 text-right whitespace-nowrap">
                    <button class="approve-btn bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 px-3 py-1.5 rounded-lg text-xs font-medium mr-2 transition-colors" data-id="${escapeHtml(data.id)}">อนุมัติ</button>
                    <button class="reject-btn bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" data-id="${escapeHtml(data.id)}">ปฏิเสธ</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.approve-btn').forEach(btn => btn.addEventListener('click', () => handleApproval(btn.dataset.id, 'approved')));
        tbody.querySelectorAll('.reject-btn').forEach(btn => btn.addEventListener('click', () => handleApproval(btn.dataset.id, 'rejected')));
    } catch (error) {
        console.error('Error loading approvals:', error);
        tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-red-500">เกิดข้อผิดพลาด</td></tr>`;
    }
}

async function handleApproval(leaveId, newStatus) {
    const actionText = newStatus === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ';
    if (!confirm(`ยืนยันการ${actionText}ใบลา?`)) return;
    try {
        await updateDoc(doc(db, 'leaves', leaveId), {
            status: newStatus,
            approverId: currentUserUid,
            approverName: currentUser?.name || currentUser?.email || 'Unknown',
            updatedAt: Timestamp.now()
        });

        if (newStatus === 'approved') {
            await deductQuotaAfterApproval(leaveId);
        }

        showPageAlert(`${actionText}ใบลาเรียบร้อยแล้ว`, 'success');
        await loadPendingApprovals();
    } catch (error) {
        console.error('Error updating status:', error);
        showPageAlert('เกิดข้อผิดพลาดในการอัปเดตสถานะ', 'error');
    }
}

async function deductQuotaAfterApproval(leaveId) {
    const leaveDoc = await getDoc(doc(db, 'leaves', leaveId));
    if (!leaveDoc.exists()) return;
    const leave = leaveDoc.data();
    const userRef = doc(db, 'users', leave.userId);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) return;
    const user = userDoc.data();

    if (leave.type === 'annual') {
        const current = getLeaveQuota(user, 'annual');
        await updateDoc(userRef, {
            'leaveQuota.annual': Math.max(Number(current) - Number(leave.totalDays || 0), 0),
            'leave_quota.annual': Math.max(Number(current) - Number(leave.totalDays || 0), 0)
        });
    }
    if (leave.type === 'sick') {
        const current = getLeaveQuota(user, 'sick');
        await updateDoc(userRef, {
            'leaveQuota.sick': Math.max(Number(current) - Number(leave.totalDays || 0), 0),
            'leave_quota.sick': Math.max(Number(current) - Number(leave.totalDays || 0), 0)
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const mockUserStr = localStorage.getItem('mockUser');
    if (mockUserStr) {
        isMockMode = true;
        currentUser = JSON.parse(mockUserStr);
        currentUserUid = 'mock-uid';
        initLeaveSystem(currentUser, currentUserUid);
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        currentUserUid = user.uid;
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists()) {
                window.location.href = 'login.html';
                return;
            }
            currentUser = { uid: user.uid, email: user.email, ...userDoc.data() };
            await initLeaveSystem(currentUser, user.uid);
        } catch (error) {
            console.error('Auth Error:', error);
            window.location.href = 'login.html';
        }
    });
});
