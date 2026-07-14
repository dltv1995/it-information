// assets/js/meeting-menu-inject.js
// Force add Meeting menu into any existing sidebar
// Version: meeting-menu-inject-v1
(function () {
  function addMeetingMenu() {
    const nav = document.getElementById('sidebarNav') || document.querySelector('#sidebar nav');
    if (!nav || nav.querySelector('[data-page="meeting"], a[href="meeting.html"]')) return;
    const a = document.createElement('a');
    a.href = 'meeting.html';
    a.dataset.page = 'meeting';
    a.className = 'nav-item flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors';
    a.innerHTML = '<i class="ph ph-presentation-chart text-lg"></i><span>ระบบจองห้องประชุม</span>';
    nav.appendChild(a);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addMeetingMenu);
  else addMeetingMenu();
  setTimeout(addMeetingMenu, 500);
})();
