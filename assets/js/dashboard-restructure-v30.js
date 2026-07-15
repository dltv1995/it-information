// Dashboard layout fix v30 - keeps section summary under metrics
console.log('dashboard restructure loaded: dashboard-layout-v30-fixed');
(() => {
  let pending = false;
  function apply() {
    pending = false;
    const host = document.getElementById('dashboardSectionSummaryHostV30');
    const summary = document.getElementById('budgetSectionSummary');
    const list = document.getElementById('projectList');
    const section = list?.closest('section');
    if (host && summary && summary.parentElement !== host) host.appendChild(summary);
    if (host && summary) {
      const title = [...summary.querySelectorAll('h4')].find(el => el.textContent.trim() === 'สรุปงบตามส่วนงาน');
      const row = title?.closest('.mb-3');
      if (row) {
        const right = row.lastElementChild;
        const head = host.querySelector('.dashboard-section-summary-head');
        let badge = head?.querySelector('.dashboard-unallocated-v30');
        if (right && head) {
          if (!badge) { badge=document.createElement('div'); badge.className='dashboard-unallocated-v30'; head.appendChild(badge); }
          badge.innerHTML=right.innerHTML;
        }
        row.style.display='none';
      }
    }
    if (section && list) {
      section.style.setProperty('height','auto','important');
      section.style.setProperty('max-height','none','important');
      section.style.setProperty('width','100%','important');
      section.style.setProperty('overflow','hidden','important');
      list.style.setProperty('height','auto','important');
      list.style.setProperty('max-height','620px','important');
      list.style.setProperty('overflow-y','auto','important');
      list.style.setProperty('flex','none','important');
    }
  }
  function schedule(){ if(pending)return; pending=true; requestAnimationFrame(apply); }
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  document.addEventListener('DOMContentLoaded',schedule);
  document.addEventListener('shared:header-ready',schedule);
  window.addEventListener('resize',schedule);
  schedule();
})();
