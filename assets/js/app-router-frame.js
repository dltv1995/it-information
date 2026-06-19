// assets/js/app-router-frame.js
// Version: app-shell-frame-v1
console.log('app-router-frame.js loaded: app-shell-frame-v1');

(function () {
  const routes = {
    dashboard: { file: 'dashboard.html', title: 'ภาพรวมระบบ', subtitle: 'สรุปภาพรวมข้อมูลและสถานะล่าสุด' },
    leave: { file: 'leave.html', title: 'ระบบจัดการวันลา', subtitle: 'ยื่นใบลา ตรวจสอบสถานะ และอนุมัติการลา' },
    projects: { file: 'projects.html', title: 'โครงการและงบประมาณ', subtitle: 'สร้างโครงการ รอหัวหน้าอนุมัติ และดูงบคงเหลือทั้งฝ่าย' }
  };

  const frame = document.getElementById('appFrame');
  const frameWrap = document.getElementById('frameWrap');

  function setupShellUi() {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    themeToggleBtn?.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem('color-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });

    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    const closeMenu = () => {
      sidebar?.classList.add('-translate-x-full');
      overlay?.classList.add('opacity-0');
      setTimeout(() => overlay?.classList.add('hidden'), 180);
    };
    const openMenu = () => {
      sidebar?.classList.remove('-translate-x-full');
      overlay?.classList.remove('hidden');
      requestAnimationFrame(() => overlay?.classList.remove('opacity-0'));
    };
    mobileMenuBtn?.addEventListener('click', openMenu);
    closeSidebarBtn?.addEventListener('click', closeMenu);
    overlay?.addEventListener('click', closeMenu);
  }

  function setActive(routeName) {
    document.querySelectorAll('.shell-nav').forEach(link => {
      const active = link.dataset.route === routeName;
      link.classList.toggle('text-white', active);
      link.classList.toggle('bg-brand-600', active);
      link.classList.toggle('dark:bg-sky-600', active);
      link.classList.toggle('font-medium', active);
      link.classList.toggle('shadow-sm', active);
      if (active) link.classList.remove('text-slate-400');
      else link.classList.add('text-slate-400');
    });
  }

  function setTitle(route) {
    document.getElementById('pageTitle').textContent = route.title;
    document.getElementById('pageSubtitle').textContent = route.subtitle;
  }

  function navigate(routeName, push = true) {
    const route = routes[routeName] || routes.projects;
    const actualRoute = routes[routeName] ? routeName : 'projects';
    setActive(actualRoute);
    setTitle(route);

    if (frameWrap) frameWrap.classList.add('opacity-0');
    const separator = route.file.includes('?') ? '&' : '?';
    frame.src = `${route.file}${separator}embed=1&v=app-shell-frame-v1`;

    if (push) location.hash = actualRoute;
  }

  frame?.addEventListener('load', () => {
    requestAnimationFrame(() => frameWrap?.classList.remove('opacity-0'));
  });

  document.querySelectorAll('.shell-nav').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      navigate(link.dataset.route, true);
    });
  });

  window.addEventListener('hashchange', () => {
    const routeName = location.hash.replace('#', '') || 'projects';
    navigate(routeName, false);
  });

  setupShellUi();
  navigate(location.hash.replace('#', '') || 'projects', false);
})();
