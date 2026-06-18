// assets/js/leave.js
// Version: leave-include-header-v5
import { db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log('leave.js loaded: leave-include-header-v5');

const TYPES = { annual: 'ลาพักร้อน', sick: 'ลาป่วย', personal: 'ลากิจ' };
const ROLE_LABELS = { admin: 'ผู้ดูแลระบบ', manager: 'หัวหน้างาน', secretary: 'เลขาฯ', staff: 'เจ้าหน้าที่', employee: 'เจ้าหน้าที่' };
let currentUser = null;
let currentUserUid = null;
let isMockMode = false;
let canApprove = false;

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value ?? '-'; };
const quota = (user, type) => user?.leaveQuota?.[type] ?? user?.leave_quota?.[type] ?? (type === 'annual' ? 10 : 30);

function ensureContentMounted() {
  if (byId('tabMyLeaves') && byId('requestLeaveBtn') && byId('myLeavesTableBody')) return true;
  const source = byId('pageContentSource');
  if (!source) return false;
  let target = byId('pageContent');
  if (!target) {
    const main = document.querySelector('main');
    target = document.createElement('div');
    target.id = 'pageContent';
    target.className = 'flex-1 overflow-y-auto p-6 lg:p-8 z-10';
    (main || byId('layoutRoot') || document.body).appendChild(target);
  }
  target.innerHTML = '';
  source.classList.remove('hidden');
  while (source.firstChild) target.appendChild(source.firstChild);
  source.remove();
  return Boolean(byId('tabMyLeaves') && byId('requestLeaveBtn') && byId('myLeavesTableBody'));
}

async function waitForLayout() {
  for (let i = 0; i < 60; i++) {
    if (ensureContentMounted()) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return ensureContentMounted();
}

function showBody() { byId('appBody')?.classList.remove('hidden'); }
function showAlert(message, type = 'info') {
  const el = byId('pageAlert');
  if (!el) { console.warn(message); return; }
  const styles = {
    info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
    error: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
  };
  el.className = `rounded-2xl border px-4 py-3 text-sm ${styles[type] || styles.info}`;
  el.textContent = message;
  el.classList.remove('hidden');
  if (type !== 'error') setTimeout(() => el.classList.add('hidden'), 3500);
}

async function checkPermission(user, uid, action) {
  if (isMockMode) return action === 'approve_leave' ? ['admin', 'manager'].includes(user.role) : true;
  try {
    const overrideSnap = await getDoc(doc(db, 'user_overrides', uid));
    const override = overrideSnap.exists() ? overrideSnap.data()?.overrides?.[action] : null;
    if (override === 'allow') return true;
    if (override === 'deny') return false;
  } catch (error) { console.warn('override check failed:', error); }
  const roleDefaults = { admin: ['approve_leave', 'manage_users', 'create_project', 'approve_project'], manager: ['approve_leave', 'create_project'], secretary: ['create_project'], staff: ['create_project'], employee: ['create_project'] };
  return (roleDefaults[user?.role] || []).includes(action);
}

async function initLeaveSystem(user, uid) {
  showBody();
  const ready = await waitForLayout();
  if (!ready) { showAlert('โหลดหน้าไม่สมบูรณ์: ไม่พบเนื้อหาระบบวันลา', 'error'); return; }
  setText('userName', user?.name || user?.email || 'ผู้ใช้งาน');
  setText('userRole', ROLE_LABELS[user?.role] || user?.role || 'เจ้าหน้าที่');
  if (user?.role === 'admin') byId('adminMenu')?.classList.remove('hidden');
  const logoutBtn = byId('logoutBtn');
  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = '1';
    logoutBtn.addEventListener('click', async () => {
      if (isMockMode) { localStorage.removeItem('mockUser'); window.location.href = 'login.html'; return; }
      await signOut(auth); window.location.href = 'login.html';
    });
  }
  setText('quotaAnnual', quota(user, 'annual'));
  setText('quotaSick', quota(user, 'sick'));
  canApprove = await checkPermission(user, uid, 'approve_leave');
  if (canApprove) { byId('tabApprovals')?.classList.remove('hidden'); await loadPendingApprovals(); }
  setupTabs(); setupLeaveModal(); await loadMyLeaves(uid);
}

function setupTabs() {
  const tabMy = byId('tabMyLeaves'), tabAp = byId('tabApprovals'), viewMy = byId('viewMyLeaves'), viewAp = byId('viewApprovals');
  if (!tabMy || !tabAp || !viewMy || !viewAp || tabMy.dataset.bound) return;
  tabMy.dataset.bound = '1';
  const active = ['text-brand-600','dark:text-sky-400','border-brand-600','dark:border-sky-400','bg-brand-50','dark:bg-slate-800/50'];
  const inactive = ['text-slate-500','dark:text-slate-400','border-transparent','hover:text-slate-800','dark:hover:text-white'];
  tabMy.addEventListener('click', () => { viewMy.classList.remove('hidden'); viewAp.classList.add('hidden'); tabMy.classList.add(...active); tabMy.classList.remove(...inactive); tabAp.classList.add(...inactive); tabAp.classList.remove(...active); });
  tabAp.addEventListener('click', () => { viewMy.classList.add('hidden'); viewAp.classList.remove('hidden'); tabAp.classList.add(...active); tabAp.classList.remove(...inactive); tabMy.classList.add(...inactive); tabMy.classList.remove(...active); });
}

function setupLeaveModal() {
  const modal = byId('leaveModal'), content = byId('leaveModalContent'), form = byId('leaveForm');
  if (!modal || !content || !form || form.dataset.bound) return;
  form.dataset.bound = '1';
  const close = () => { modal.classList.add('opacity-0'); content.classList.add('scale-95'); document.body.style.overflow = ''; setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 180); form.reset(); byId('leaveModalError')?.classList.add('hidden'); };
  const open = () => { modal.classList.remove('hidden'); modal.classList.add('flex'); document.body.style.overflow = 'hidden'; requestAnimationFrame(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); }); };
  byId('requestLeaveBtn')?.addEventListener('click', open);
  byId('closeLeaveModalBtn')?.addEventListener('click', close);
  byId('cancelLeaveModalBtn')?.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const err = byId('leaveModalError'), btn = byId('saveLeaveBtn'), spinner = byId('saveLeaveSpinner');
    err?.classList.add('hidden'); if (btn) btn.disabled = true; spinner?.classList.remove('hidden');
    try {
      const type = byId('leaveType')?.value, start = byId('leaveStart')?.value, end = byId('leaveEnd')?.value, reason = byId('leaveReason')?.value?.trim();
      if (!type || !start || !end || !reason) throw new Error('กรุณากรอกข้อมูลให้ครบถ้วน');
      const startDate = new Date(`${start}T00:00:00`), endDate = new Date(`${end}T00:00:00`);
      if (endDate < startDate) throw new Error('วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น');
      const totalDays = Math.ceil(Math.abs(endDate - startDate) / 86400000) + 1;
      if (isMockMode) { showAlert('Mock Mode: ส่งใบลาสำเร็จ', 'success'); close(); return; }
      await addDoc(collection(db, 'leaves'), { userId: currentUserUid, userName: currentUser?.name || currentUser?.email || 'Unknown', userEmail: currentUser?.email || '', type, startDate: Timestamp.fromDate(startDate), endDate: Timestamp.fromDate(endDate), totalDays, reason, status: 'pending', createdAt: Timestamp.now() });
      close(); showAlert('ส่งใบลาเรียบร้อยแล้ว', 'success'); await loadMyLeaves(currentUserUid);
    } catch (error) { console.error('save leave error:', error); if (err) { err.textContent = error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'; err.classList.remove('hidden'); } } finally { if (btn) btn.disabled = false; spinner?.classList.add('hidden'); }
  });
}

function statusBadge(status) {
  const map = { pending: '<span class="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-medium border border-amber-200 dark:border-amber-800/50">รออนุมัติ</span>', approved: '<span class="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-800/50">อนุมัติแล้ว</span>', rejected: '<span class="inline-block px-3 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-medium border border-red-200 dark:border-red-800/50">ไม่อนุมัติ</span>' };
  return map[status] || escapeHtml(status);
}
function dateRange(data) { const s = data.startDate?.toDate ? data.startDate.toDate().toLocaleDateString('th-TH') : '-'; const e = data.endDate?.toDate ? data.endDate.toDate().toLocaleDateString('th-TH') : '-'; return s === e ? s : `${s} - ${e}`; }

async function loadMyLeaves(uid) {
  const tbody = byId('myLeavesTableBody'); if (!tbody) return;
  if (isMockMode) { tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500">Mock Data Mode</td></tr>`; return; }
  try {
    const snap = await getDocs(query(collection(db, 'leaves'), where('userId', '==', uid)));
    const leaves = []; snap.forEach(d => leaves.push({ id: d.id, ...d.data() }));
    leaves.sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    if (!leaves.length) { tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-slate-500">ไม่มีประวัติการลา</td></tr>`; return; }
    tbody.innerHTML = leaves.map(data => `<tr class="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors"><td class="py-4 px-4 font-medium">${escapeHtml(TYPES[data.type] || data.type)}</td><td class="py-4 px-4 text-slate-500 dark:text-slate-400">${escapeHtml(dateRange(data))}</td><td class="py-4 px-4 text-center">${escapeHtml(data.totalDays)}</td><td class="py-4 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate" title="${escapeHtml(data.reason)}">${escapeHtml(data.reason)}</td><td class="py-4 px-4 text-center">${statusBadge(data.status)}</td></tr>`).join('');
  } catch (error) { console.error('load leaves error:', error); tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-red-500">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`; }
}

async function loadPendingApprovals() {
  if (isMockMode) return;
  const tbody = byId('approvalsTableBody'), badge = byId('pendingBadge'); if (!tbody) return;
  try {
    const snap = await getDocs(query(collection(db, 'leaves'), where('status', '==', 'pending')));
    const items = []; snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    items.sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    if (!items.length) { tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-slate-500">ไม่มีรายการรออนุมัติ</td></tr>`; badge?.classList.add('hidden'); return; }
    if (badge) { badge.textContent = items.length; badge.classList.remove('hidden'); }
    tbody.innerHTML = items.map(data => `<tr class="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors"><td class="py-4 px-4 font-medium">${escapeHtml(data.userName || 'Unknown')}</td><td class="py-4 px-4"><div class="font-medium text-slate-800 dark:text-white">${escapeHtml(TYPES[data.type] || data.type)} (${escapeHtml(data.totalDays)} วัน)</div><div class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(dateRange(data))}</div></td><td class="py-4 px-4 text-sm max-w-xs truncate" title="${escapeHtml(data.reason)}">${escapeHtml(data.reason)}</td><td class="py-4 px-4 text-right whitespace-nowrap"><button class="approve-btn bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 px-3 py-1.5 rounded-lg text-xs font-medium mr-2" data-id="${escapeHtml(data.id)}">อนุมัติ</button><button class="reject-btn bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 px-3 py-1.5 rounded-lg text-xs font-medium" data-id="${escapeHtml(data.id)}">ปฏิเสธ</button></td></tr>`).join('');
    tbody.querySelectorAll('.approve-btn').forEach(btn => btn.addEventListener('click', () => handleApproval(btn.dataset.id, 'approved')));
    tbody.querySelectorAll('.reject-btn').forEach(btn => btn.addEventListener('click', () => handleApproval(btn.dataset.id, 'rejected')));
  } catch (error) { console.error('load approvals error:', error); tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-red-500">เกิดข้อผิดพลาด</td></tr>`; }
}

async function handleApproval(id, status) {
  const text = status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ';
  if (!confirm(`ยืนยันการ${text}ใบลา?`)) return;
  try {
    await updateDoc(doc(db, 'leaves', id), { status, approverId: currentUserUid, approverName: currentUser?.name || currentUser?.email || 'Unknown', updatedAt: Timestamp.now() });
    if (status === 'approved') await deductQuota(id);
    showAlert(`${text}ใบลาเรียบร้อยแล้ว`, 'success'); await loadPendingApprovals();
  } catch (error) { console.error('approval error:', error); showAlert('เกิดข้อผิดพลาดในการอัปเดตสถานะ', 'error'); }
}
async function deductQuota(id) {
  const leaveSnap = await getDoc(doc(db, 'leaves', id)); if (!leaveSnap.exists()) return;
  const leave = leaveSnap.data(); const userRef = doc(db, 'users', leave.userId); const userSnap = await getDoc(userRef); if (!userSnap.exists()) return;
  const user = userSnap.data();
  if (leave.type === 'annual') { const next = Math.max(Number(quota(user, 'annual')) - Number(leave.totalDays || 0), 0); await updateDoc(userRef, { 'leaveQuota.annual': next, 'leave_quota.annual': next }); }
  if (leave.type === 'sick') { const next = Math.max(Number(quota(user, 'sick')) - Number(leave.totalDays || 0), 0); await updateDoc(userRef, { 'leaveQuota.sick': next, 'leave_quota.sick': next }); }
}

document.addEventListener('DOMContentLoaded', () => {
  const mockUserStr = localStorage.getItem('mockUser');
  if (mockUserStr) { isMockMode = true; currentUser = JSON.parse(mockUserStr); currentUserUid = 'mock-uid'; initLeaveSystem(currentUser, currentUserUid); return; }
  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'login.html'; return; }
    currentUserUid = user.uid;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (!snap.exists()) { window.location.href = 'login.html'; return; }
      currentUser = { uid: user.uid, email: user.email, ...snap.data() };
      await initLeaveSystem(currentUser, user.uid);
    } catch (error) { console.error('auth error:', error); window.location.href = 'login.html'; }
  });
});
