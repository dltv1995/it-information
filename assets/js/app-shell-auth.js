// assets/js/app-shell-auth.js
// Version: app-shell-frame-v1
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log('app-shell-auth.js loaded: app-shell-frame-v1');

const roleDisplay = { admin: 'ผู้ดูแลระบบ', manager: 'หัวหน้าฝ่าย', secretary: 'เลขาฯ', staff: 'เจ้าหน้าที่', employee: 'เจ้าหน้าที่' };

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '-';
}

function showAdminMenu(role) {
  const adminLike = ['admin', 'administrator', 'ผู้ดูแลระบบ'].includes(String(role || '').trim().toLowerCase()) || role === 'ผู้ดูแลระบบ';
  if (adminLike) document.getElementById('adminMenu')?.classList.remove('hidden');
}

const mockUserStr = localStorage.getItem('mockUser');
if (mockUserStr) {
  const user = JSON.parse(mockUserStr);
  setText('userName', user.name || user.email || 'ผู้ใช้งาน');
  setText('userRole', roleDisplay[user.role] || user.role || 'เจ้าหน้าที่');
  showAdminMenu(user.role);
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const profile = snap.exists() ? snap.data() : { email: user.email, role: '' };
      setText('userName', profile.name || user.email || 'ผู้ใช้งาน');
      setText('userRole', roleDisplay[profile.role] || profile.role || 'เจ้าหน้าที่');
      showAdminMenu(profile.role);
    } catch (error) {
      console.warn('โหลดข้อมูลผู้ใช้บน shell ไม่สำเร็จ:', error);
      setText('userName', user.email || 'ผู้ใช้งาน');
      setText('userRole', 'เจ้าหน้าที่');
    }
  });
}

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  if (localStorage.getItem('mockUser')) {
    localStorage.removeItem('mockUser');
    window.location.href = 'login.html';
    return;
  }
  await signOut(auth);
  window.location.href = 'login.html';
});
