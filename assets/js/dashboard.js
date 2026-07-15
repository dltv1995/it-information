// Dashboard Restructure v30
// ย้ายสรุปงบตามส่วนงานไปใต้การ์ดงบ 3 ใบ และซ่อนกรอบ Pie Chart
console.log('dashboard restructure loaded: dashboard-section-summary-under-metrics-v30');

(() => {
  const IDS = {
    host: 'dashboardSectionSummaryHostV30',
    hiddenChart: 'dashboardHiddenBudgetChartV30',
    style: 'dashboardRestructureStyleV30'
  };

  let scheduled = false;

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      restructureDashboard();
    });
  }

  function getMetricGrid() {
    const total = document.getElementById('totalBudget');
    return total?.closest('.grid') || null;
  }

  function getProjectSection() {
    return document.getElementById('projectList')?.closest('section') || null;
  }

  function getChartSection() {
    return document.getElementById('budgetChart')?.closest('section') || null;
  }

  function createSummaryHost(metricGrid) {
    let host = document.getElementById(IDS.host);
    if (host) return host;

    host = document.createElement('section');
    host.id = IDS.host;
    host.className = 'dashboard-card dashboard-section-summary-host rounded-3xl overflow-visible';
    host.innerHTML = `
      <div class="dashboard-section-summary-head">
        <div>
          <h3>สรุปงบตามส่วนงาน</h3>
          <p>งบที่กระจาย / ใช้แล้วหรืออนุมัติแล้ว / งบคงเหลือของแต่ละส่วนงาน</p>
        </div>
      </div>
      <div id="${IDS.hiddenChart}" class="dashboard-hidden-chart" aria-hidden="true"></div>
    `;
    metricGrid.insertAdjacentElement('afterend', host);
    return host;
  }

  function moveChartCanvasToHiddenHost(host) {
    const canvas = document.getElementById('budgetChart');
    const hidden = document.getElementById(IDS.hiddenChart);
    if (!canvas || !hidden || hidden.contains(canvas)) return;
    hidden.appendChild(canvas);
  }

  function moveSummaryIntoHost(host) {
    const summary = document.getElementById('budgetSectionSummary');
    if (!summary || host.contains(summary)) return;
    host.appendChild(summary);
  }

  function removeOldChartFrame() {
    document.querySelectorAll('section').forEach(section => {
      if (section.id === IDS.host) return;
      const title = section.querySelector('h3')?.textContent?.trim() || '';
      const hasOldBudgetTitle = title.includes('สัดส่วนงบประมาณทั้งหมด') && title.includes('ตามส่วนงาน');
      const hasEmptyChartBox = section.querySelector('.chart-box') && !section.querySelector('#budgetChart');
      if (hasOldBudgetTitle || hasEmptyChartBox) section.remove();
    });
  }

  function expandProjectSection() {
    const section = getProjectSection();
    const list = document.getElementById('projectList');
    if (!section || !list) return;

    section.classList.remove('2xl:col-span-4', '2xl:col-span-3');
    section.classList.add('dashboard-project-fullwidth-v30');
    section.style.setProperty('height', 'auto', 'important');
    section.style.setProperty('max-height', 'none', 'important');
    section.style.setProperty('width', '100%', 'important');
    section.style.setProperty('overflow', 'visible', 'important');

    const parent = section.parentElement;
    if (parent) {
      parent.className = 'grid grid-cols-1 gap-5 dashboard-project-grid-v30';
      parent.style.setProperty('grid-template-columns', 'minmax(0, 1fr)', 'important');
    }

    list.style.setProperty('max-height', '620px', 'important');
    list.style.setProperty('height', 'auto', 'important');
    list.style.setProperty('overflow-y', 'auto', 'important');
    list.style.setProperty('flex', 'none', 'important');
  }

  function cleanSummaryHeading(host) {
    const summary = host.querySelector('#budgetSectionSummary');
    if (!summary) return;

    const embeddedHeading = Array.from(summary.querySelectorAll('h4')).find(el => el.textContent.trim() === 'สรุปงบตามส่วนงาน');
    if (embeddedHeading) {
      const headingRow = embeddedHeading.closest('.mb-3');
      const unallocated = headingRow?.querySelector('.text-xs.text-slate-500:last-child');
      const head = host.querySelector('.dashboard-section-summary-head');
      if (unallocated && head && !head.querySelector('.dashboard-unallocated-v30')) {
        const badge = document.createElement('div');
        badge.className = 'dashboard-unallocated-v30';
        badge.innerHTML = unallocated.innerHTML;
        head.appendChild(badge);
      } else if (unallocated && head?.querySelector('.dashboard-unallocated-v30')) {
        head.querySelector('.dashboard-unallocated-v30').innerHTML = unallocated.innerHTML;
      }
      if (headingRow) headingRow.style.display = 'none';
    }
  }

  function injectStyle() {
    if (document.getElementById(IDS.style)) return;
    const style = document.createElement('style');
    style.id = IDS.style;
    style.textContent = `
      #${IDS.host} {
        position: relative;
        margin-top: 20px;
        margin-bottom: 20px;
        padding: 0;
        border: 1px solid rgba(148,163,184,.22) !important;
        background: linear-gradient(145deg,rgba(255,255,255,.88),rgba(248,250,252,.68)) !important;
        box-shadow: 0 16px 42px rgba(15,23,42,.07) !important;
      }
      html.dark #${IDS.host} {
        background: linear-gradient(145deg,rgba(15,23,42,.88),rgba(2,6,23,.72)) !important;
        border-color: rgba(148,163,184,.18) !important;
      }
      .dashboard-section-summary-head {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 18px;
        padding: 20px 22px 15px;
        border-bottom: 1px solid rgba(148,163,184,.15);
        background: linear-gradient(135deg,rgba(59,130,246,.07),rgba(16,185,129,.05),rgba(245,158,11,.06));
      }
      .dashboard-section-summary-head h3 {
        color: #0f172a;
        font-size: 17px;
        font-weight: 900;
      }
      .dashboard-section-summary-head p {
        margin-top: 4px;
        color: #64748b;
        font-size: 12px;
        font-weight: 600;
      }
      html.dark .dashboard-section-summary-head h3 { color: #f8fafc; }
      html.dark .dashboard-section-summary-head p { color: #94a3b8; }
      .dashboard-unallocated-v30 {
        flex: none;
        padding: 9px 13px;
        border: 1px solid rgba(148,163,184,.2);
        border-radius: 999px;
        background: rgba(255,255,255,.72);
        color: #64748b;
        font-size: 12px;
        font-weight: 700;
      }
      html.dark .dashboard-unallocated-v30 { background: rgba(15,23,42,.68); color: #cbd5e1; }
      #${IDS.host} #budgetSectionSummary {
        padding: 18px 20px 20px !important;
        border-top: 0 !important;
      }
      #${IDS.host} .budget-section-summary-grid {
        grid-template-columns: repeat(3,minmax(0,1fr)) !important;
        gap: 14px !important;
      }
      #${IDS.host} .budget-section-card {
        min-height: 158px;
        border-radius: 21px !important;
        padding: 17px !important;
        background: linear-gradient(145deg,rgba(255,255,255,.85),rgba(248,250,252,.58)) !important;
        box-shadow: 0 12px 28px rgba(15,23,42,.055);
        transition: transform .18s ease, box-shadow .18s ease;
      }
      #${IDS.host} .budget-section-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 17px 36px rgba(15,23,42,.09);
      }
      html.dark #${IDS.host} .budget-section-card {
        background: linear-gradient(145deg,rgba(30,41,59,.82),rgba(15,23,42,.68)) !important;
      }
      #${IDS.host} .budget-section-total-row {
        margin-top: 15px !important;
      }
      .dashboard-hidden-chart {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        left: -9999px !important;
      }
      .dashboard-hidden-chart canvas {
        width: 1px !important;
        height: 1px !important;
        max-height: 1px !important;
      }
      .dashboard-project-fullwidth-v30 { grid-column: 1 / -1 !important; }
      .dashboard-project-grid-v30 { width: 100% !important; }
      @media (max-width: 1050px) {
        #${IDS.host} .budget-section-summary-grid { grid-template-columns: 1fr !important; }
      }
      @media (max-width: 700px) {
        .dashboard-section-summary-head { align-items: stretch; flex-direction: column; }
        .dashboard-unallocated-v30 { width: fit-content; }
        #${IDS.host} { margin-top: 14px; margin-bottom: 14px; }
        #${IDS.host} #budgetSectionSummary { padding: 14px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function restructureDashboard() {
    injectStyle();
    const metricGrid = getMetricGrid();
    if (!metricGrid) return;

    const host = createSummaryHost(metricGrid);
    moveChartCanvasToHiddenHost(host);
    moveSummaryIntoHost(host);
    removeOldChartFrame();
    expandProjectSection();
    cleanSummaryHeading(host);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', schedule);
  document.addEventListener('shared:header-ready', schedule);
  window.addEventListener('resize', schedule);
  schedule();
})();
