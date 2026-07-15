// Dashboard layout override v30
console.log('dashboard restructure loaded: dashboard-layout-v30-ready');
(() => {
  let queued = false;
  function applyLayout() {
    queued = false;
    const host = document.getElementById('dashboardSectionSummaryHostV30');
    const projectList = document.getElementById('projectList');
    const projectSection = projectList?.closest('section');
    if (!host || !projectSection) return;

    // dashboard.js จะสร้าง #budgetSectionSummary ต่อท้าย section ที่มี #budgetChart
    const summary = document.getElementById('budgetSectionSummary');
    if (summary && summary.parentElement !== host) host.appendChild(summary);

    // ซ่อนหัวข้อซ้ำภายใน summary แต่เก็บยอด "ยังไม่กระจาย" ไว้ด้านขวาหัวกรอบ
    if (summary) {
      const heading = [...summary.querySelectorAll('h4')].find(el => el.textContent.trim() === 'สรุปงบตามส่วนงาน');
      const row = heading?.closest('.mb-3');
      if (row) {
        const right = row.lastElementChild;
        const hostHead = host.querySelector('.dashboard-section-summary-head');
        let badge = hostHead?.querySelector('.dashboard-unallocated-v30');
        if (right && hostHead) {
          if (!badge) {
            badge = document.createElement('div');
            badge.className = 'dashboard-unallocated-v30';
            hostHead.appendChild(badge);
          }
          badge.innerHTML = right.innerHTML;
        }
        row.style.display = 'none';
      }
    }

    // ยกเลิก logic เดิมที่บังคับความสูงรายการให้เท่ากรอบ chart
    projectSection.style.setProperty('height', 'auto', 'important');
    projectSection.style.setProperty('max-height', 'none', 'important');
    projectSection.style.setProperty('width', '100%', 'important');
    projectSection.style.setProperty('overflow', 'hidden', 'important');
    projectList.style.setProperty('max-height', '620px', 'important');
    projectList.style.setProperty('height', 'auto', 'important');
    projectList.style.setProperty('overflow-y', 'auto', 'important');
    projectList.style.setProperty('flex', 'none', 'important');
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(applyLayout);
  }
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true });
  document.addEventListener('DOMContentLoaded', schedule);
  document.addEventListener('shared:header-ready', schedule);
  window.addEventListener('resize', schedule);
  schedule();
})();
