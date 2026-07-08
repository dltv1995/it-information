// assets/js/header.js
// Shared header loader
// Version: header-meeting-hard-fix-v3

console.log('header.js loaded: header-meeting-hard-fix-v3');

document.addEventListener('DOMContentLoaded', loadHeader);

async function loadHeader() {
    const layoutRoot = document.getElementById('layoutRoot');

    if (layoutRoot && !document.getElementById('sidebar')) {
        try {
            const response = await fetch('components/header.html?v=header-meeting-hard-fix-v3', { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            layoutRoot.insertAdjacentHTML('afterbegin', html);
        } catch (error) {
            console.error('Load header failed:', error);
            layoutRoot.insertAdjacentHTML('afterbegin', getHeaderFallbackHtml());
        }
    }

    // สำคัญ: กรณีหน้าเก่ายังมี sidebar ฝังใน HTML เอง ให้ inject เมนู meeting เข้าไปด้วย
    ensureMeetingMenu();
    initHeaderEvents();
    setActiveMenu();
    setPageInfo();
    loadUserInfo();

    const appBody = document.getElementById('appBody');
    if (appBody) appBody.classList.remove('hidden');
}

function ensureMeetingMenu() {
    const sidebarNav = document.getElementById('sidebarNav') || document.querySelector('#sidebar nav');
    if (!sidebarNav || sidebarNav.querySelector('[data-page="meeting"], a[href="meeting.html"]')) return;

    const meetingLink = document.createElement('a');
    meetingLink.href = 'meeting.html';
    meetingLink.dataset.page = 'meeting';
    meetingLink.className = 'nav-item flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors';
    meetingLink.innerHTML = '<i class="ph ph-presentation-chart text-lg"></i><span>จองห้องประชุม</span>';
    sidebarNav.appendChild(meetingLink);
}

function initHeaderEvents() {
    const sidebar = document.getElementById('sidebar');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    function openSidebar() {
        if (!sidebar || !mobileOverlay) return;
        sidebar.classList.remove('-translate-x-full');
        mobileOverlay.classList.remove('hidden');
        setTimeout(() => mobileOverlay.classList.remove('opacity-0'), 10);
    }

    function closeSidebar() {
        if (!sidebar || !mobileOverlay) return;
        sidebar.classList.add('-translate-x-full');
        mobileOverlay.classList.add('opacity-0');
        setTimeout(() => mobileOverlay.classList.add('hidden'), 300);
    }

    mobileMenuBtn?.addEventListener('click', openSidebar);
    closeSidebarBtn?.addEventListener('click', closeSidebar);
    mobileOverlay?.addEventListener('click', closeSidebar);

    themeToggleBtn?.addEventListener('click', () => {
        const html = document.documentElement;
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            localStorage.setItem('color-theme', 'light');
        } else {
            html.classList.add('dark');
            localStorage.setItem('color-theme', 'dark');
        }
    });

    logoutBtn?.addEventListener('click', () => {
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_role');
        localStorage.removeItem('mockUser');
        window.location.href = 'login.html';
    });
}

function setActiveMenu() {
    const fileName = (window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1) || 'dashboard.html').toLowerCase();
    const pageMap = {
        'dashboard.html': 'dashboard',
        'leave.html': 'leave',
        'projects.html': 'projects',
        'meeting.html': 'meeting',
        'admin.html': 'admin'
    };

    const currentPage = document.body.dataset.activeMenu || pageMap[fileName] || 'dashboard';

    document.querySelectorAll('.nav-item').forEach(item => {
        const active = item.dataset.page === currentPage;
        item.classList.remove('active', 'text-white', 'bg-brand-600', 'dark:bg-sky-600', 'font-medium', 'shadow-sm');
        item.classList.add('text-slate-400', 'hover:text-white', 'hover:bg-slate-800');

        if (active) {
            item.classList.add('active', 'text-white', 'bg-brand-600', 'dark:bg-sky-600', 'font-medium', 'shadow-sm');
            item.classList.remove('text-slate-400', 'hover:text-white', 'hover:bg-slate-800');
        }
    });
}

function setPageInfo() {
    const pageTitle = document.body.dataset.title || 'ภาพรวมระบบ';
    const pageSubtitle = document.body.dataset.subtitle || 'ข้อมูลสรุปการทำงานและสถานะปัจจุบัน';
    const titleEl = document.getElementById('pageTitle');
    const subtitleEl = document.getElementById('pageSubtitle');
    if (titleEl) titleEl.textContent = pageTitle;
    if (subtitleEl) subtitleEl.textContent = pageSubtitle;
}

function loadUserInfo() {
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const adminMenu = document.getElementById('adminMenu');

    let currentUser = {
        name: localStorage.getItem('user_name') || 'ผู้ใช้งานระบบ',
        role: localStorage.getItem('user_role') || 'employee'
    };

    try {
        const mockUser = JSON.parse(localStorage.getItem('mockUser') || 'null');
        if (mockUser) {
            currentUser = {
                name: mockUser.name || mockUser.email || currentUser.name,
                role: mockUser.role || currentUser.role
            };
        }
    } catch {
        // ignore
    }

    const roleText = {
        admin: 'ผู้ดูแลระบบ',
        manager: 'หัวหน้างาน',
        secretary: 'เลขาฯ',
        employee: 'เจ้าหน้าที่',
        staff: 'เจ้าหน้าที่'
    };

    if (userName) userName.textContent = currentUser.name;
    if (userRole) userRole.textContent = roleText[currentUser.role] || currentUser.role;
    if (adminMenu && currentUser.role === 'admin') adminMenu.classList.remove('hidden');
}

function getHeaderFallbackHtml() {
    return `
      <main class="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 transition-theme">
        <header class="bg-white dark:bg-slate-800 h-20 flex items-center justify-between px-6 lg:px-8 z-30 sticky top-0 border-b border-slate-200 dark:border-slate-700 shadow-sm transition-theme">
          <div>
            <h2 id="pageTitle" class="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">ภาพรวมระบบ</h2>
            <p id="pageSubtitle" class="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">ข้อมูลสรุปการทำงานและสถานะปัจจุบัน</p>
          </div>
        </header>
        <div class="flex-1 overflow-y-auto p-6 lg:p-8 z-10" id="pageContent"></div>
      </main>
    `;
}
