// assets/js/embed-page.js
// Version: app-shell-frame-v1
// ซ่อน header/sidebar ของหน้า standalone เมื่อถูกโหลดใน app.html ผ่าน iframe
console.log('embed-page.js loaded: app-shell-frame-v1');

(function () {
  const params = new URLSearchParams(location.search);
  const embedded = params.get('embed') === '1' || window.self !== window.top;
  if (!embedded) return;

  function applyEmbeddedMode() {
    document.documentElement.classList.add('embedded-page');
    document.body.classList.add('embedded-page-body');

    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    const topHeader = document.querySelector('main > header');
    sidebar?.classList.add('hidden');
    overlay?.classList.add('hidden');
    topHeader?.classList.add('hidden');

    const shell = document.querySelector('body > .flex.h-screen.overflow-hidden');
    if (shell) {
      shell.classList.remove('h-screen', 'overflow-hidden');
      shell.classList.add('min-h-screen');
    }

    const main = document.querySelector('main');
    if (main) {
      main.classList.add('w-full');
      main.classList.remove('flex-1');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyEmbeddedMode);
  else applyEmbeddedMode();
})();
