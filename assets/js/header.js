// assets/js/header.js - Shared Sidebar v7
console.log('header.js loaded: shared-sidebar-v7');

const HEADER_VERSION = 'shared-sidebar-v7';
const ROLE_LABELS = {
  admin: 'ผู้ดูแลระบบ', administrator: 'ผู้ดูแลระบบ',
  manager: 'หัวหน้าฝ่าย', head: 'หัวหน้าฝ่าย', department_head: 'หัวหน้าฝ่าย',
  head_department: 'หัวหน้าฝ่าย', director: 'ผู้อำนวยการ', deputy_director: 'รองผู้อำนวยการ',
  section_head: 'หัวหน้างาน', supervisor: 'หัวหน้างาน', secretary: 'เลขาฯ',
  staff: 'เจ้าหน้าที่', employee: 'เจ้าหน้าที่', user: 'เจ้าหน้าที่'
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSharedHeader, { once: true });
} else {
  initSharedHeader();
}

async function initSharedHeader() {
  try {
    await mountSharedLayout();
    setTitles();
    setActiveMenu();
    bindSharedHeader();
    await loadSharedUser();
  } catch (error) {
    console.error('Shared header initialization failed:', error);
  } finally {
    document.getElementById('appBody')?.classList.remove('hidden');
    document.dispatchEvent(new CustomEvent('shared:header-ready'));
  }
}

async function fetchHeaderMarkup() {
  const response = await fetch(`components/header.html?v=${HEADER_VERSION}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`โหลด Header ไม่สำเร็จ: HTTP ${response.status}`);
  return response.text();
}

async function mountSharedLayout() {
  const markup = await fetchHeaderMarkup();
  const layoutRoot = document.getElementById('layoutRoot');

  // หน้าแบบใหม่: Dashboard / Meeting
  if (layoutRoot && !document.getElementById('sidebar')) {
    layoutRoot.innerHTML = markup;
    return;
  }

  // หน้าเดิม: Projects / Leave / Admin — เปลี่ยนเฉพาะ Sidebar และ Top Header
  const parser = document.createElement('div');
  parser.innerHTML = markup;
  const newOverlay = parser.querySelector('#mobileOverlay');
  const newSidebar = parser.querySelector('#sidebar');
  const newTopHeader = parser.querySelector('main > header');
  const oldOverlay = document.getElementById('mobileOverlay');
  const oldSidebar = document.getElementById('sidebar');
  const oldTopHeader = document.querySelector('main > header');

  if (oldOverlay && newOverlay) oldOverlay.replaceWith(newOverlay);
  if (oldSidebar && newSidebar) oldSidebar.replaceWith(newSidebar);
  if (oldTopHeader && newTopHeader) oldTopHeader.replaceWith(newTopHeader);
}

function setTitles() {
  const title = document.getElementById('pageTitle');
  const subtitle = document.getElementById('pageSubtitle');
  if (title) title.textContent = document.body.dataset.title || 'ระบบบริหารจัดการ';
  if (subtitle) subtitle.textContent = document.body.dataset.subtitle || 'สารสนเทศและสื่อสารองค์กร';
}

function setActiveMenu() {
  const file = (location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
  const map = {
    'dashboard.html': 'dashboard', 'leave.html': 'leave', 'projects.html': 'projects',
    'meeting.html': 'meeting', 'admin.html': 'admin'
  };
  const activePage = document.body.dataset.activeMenu || map[file] || 'dashboard';
  document.querySelectorAll('.nav-item').forEach((item) => {
    const active = item.dataset.page === activePage;
    item.classList.toggle('active', active);
    item.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

function bindSharedHeader() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobileOverlay');
  const open = () => {
    sidebar?.classList.remove('-translate-x-full');
    overlay?.classList.remove('hidden');
    requestAnimationFrame(() => overlay?.classList.remove('opacity-0'));
  };
  const close = () => {
    sidebar?.classList.add('-translate-x-full');
    overlay?.classList.add('opacity-0');
    setTimeout(() => overlay?.classList.add('hidden'), 220);
  };
  document.getElementById('mobileMenuBtn')?.addEventListener('click', open);
  document.getElementById('closeSidebarBtn')?.addEventListener('click', close);
  overlay?.addEventListener('click', close);

  document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('color-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_profile');
    localStorage.removeItem('mockUser');
    try {
      const cfg = await import('./firebase-config.js');
      const authSdk = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
      if (cfg.auth) await authSdk.signOut(cfg.auth);
    } catch (error) {
      console.warn('Sign out fallback:', error.message);
    }
    location.href = 'login.html';
  });
}

function normalizeName(profile, authUser) {
  const combined = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim();
  return profile?.name || profile?.fullName || profile?.displayName || combined || authUser?.displayName || '';
}

function paintSharedUser(name, role) {
  const nameEl = document.getElementById('userName');
  const roleEl = document.getElementById('userRole');
  if (nameEl) nameEl.textContent = name || 'ผู้ใช้งานระบบ';
  if (roleEl) roleEl.textContent = ROLE_LABELS[role] || role || 'เจ้าหน้าที่';
  if (['admin', 'administrator', 'ผู้ดูแลระบบ'].includes(String(role || '').toLowerCase()) || role === 'ผู้ดูแลระบบ') {
    document.getElementById('adminMenu')?.classList.remove('hidden');
  }
}

async function loadSharedUser() {
  let cached = {};
  try { cached = JSON.parse(localStorage.getItem('user_profile') || 'null') || {}; } catch {}
  let mock = null;
  try { mock = JSON.parse(localStorage.getItem('mockUser') || 'null'); } catch {}
  if (mock) {
    const name = mock.name || mock.fullName || mock.displayName || '';
    const role = mock.role || 'staff';
    paintSharedUser(name, role);
    document.dispatchEvent(new CustomEvent('shared:user-ready', { detail: { name, role, profile: mock } }));
    return;
  }

  paintSharedUser(cached.name || localStorage.getItem('user_name') || '', cached.role || localStorage.getItem('user_role') || 'staff');

  try {
    const cfg = await import('./firebase-config.js');
    const authSdk = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
    const firestoreSdk = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    if (!cfg.auth || !cfg.db) return;

    await new Promise((resolve) => {
      const unsubscribe = authSdk.onAuthStateChanged(cfg.auth, async (authUser) => {
        unsubscribe();
        if (!authUser) { resolve(); return; }
        let profile = {};
        try {
          const snapshot = await firestoreSdk.getDoc(firestoreSdk.doc(cfg.db, 'users', authUser.uid));
          if (snapshot.exists()) profile = snapshot.data();
        } catch (error) {
          console.warn('อ่านชื่อเจ้าหน้าที่จาก Firestore ไม่สำเร็จ:', error.message);
        }
        const name = normalizeName(profile, authUser) || authUser.email || 'ผู้ใช้งานระบบ';
        const role = profile.role || cached.role || 'staff';
        const detail = { name, role, profile: { uid: authUser.uid, email: authUser.email, ...profile } };
        localStorage.setItem('user_name', name);
        localStorage.setItem('user_role', role);
        localStorage.setItem('user_profile', JSON.stringify(detail.profile));
        paintSharedUser(name, role);
        document.dispatchEvent(new CustomEvent('shared:user-ready', { detail }));
        resolve();
      });
    });
  } catch (error) {
    console.warn('Header user fallback:', error.message);
  }
}
