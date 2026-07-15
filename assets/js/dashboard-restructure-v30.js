// Dashboard Section Cards Polish v31
// วางทับไฟล์ assets/js/dashboard-restructure-v30.js เดิม
console.log('dashboard restructure loaded: dashboard-section-cards-polish-v31');

(() => {
  const STYLE_ID = 'dashboardSectionCardsPolishV31';
  let queued = false;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #dashboardSectionSummaryHostV30 {
        position: relative;
        overflow: hidden !important;
        border: 1px solid rgba(148,163,184,.22) !important;
        border-radius: 26px !important;
        background:
          radial-gradient(circle at 8% 0%,rgba(59,130,246,.10),transparent 27%),
          radial-gradient(circle at 92% 0%,rgba(245,158,11,.09),transparent 29%),
          linear-gradient(145deg,rgba(255,255,255,.95),rgba(248,250,252,.78)) !important;
        box-shadow: 0 22px 58px rgba(15,23,42,.09) !important;
      }
      #dashboardSectionSummaryHostV30::before {
        content:"";
        position:absolute;
        inset:0 0 auto 0;
        height:4px;
        background:linear-gradient(90deg,#3b82f6 0 33.33%,#10b981 33.33% 66.66%,#f59e0b 66.66% 100%);
        z-index:2;
      }
      .dashboard-section-summary-head {
        position:relative;
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:18px;
        padding:24px 24px 18px !important;
        border-bottom:1px solid rgba(148,163,184,.16) !important;
        background:linear-gradient(135deg,rgba(239,246,255,.72),rgba(236,253,245,.44),rgba(255,251,235,.62)) !important;
      }
      .dashboard-section-summary-head h3 {
        color:#0f172a;
        font-size:18px;
        line-height:1.35;
        font-weight:900;
        letter-spacing:-.01em;
      }
      .dashboard-section-summary-head p {
        margin-top:5px;
        color:#64748b;
        font-size:12px;
        font-weight:600;
      }
      .dashboard-unallocated-v30 {
        flex:none;
        padding:9px 14px;
        border:1px solid rgba(148,163,184,.24);
        border-radius:999px;
        background:rgba(255,255,255,.82);
        color:#475569;
        font-size:12px;
        font-weight:800;
        box-shadow:0 8px 20px rgba(15,23,42,.06),inset 0 1px 0 rgba(255,255,255,.9);
        backdrop-filter:blur(10px);
      }
      #dashboardSectionSummaryHostV30 #budgetSectionSummary {
        padding:20px 22px 23px !important;
        border-top:0 !important;
        background:transparent !important;
      }
      #dashboardSectionSummaryHostV30 .budget-section-summary-grid {
        display:grid !important;
        grid-template-columns:repeat(3,minmax(0,1fr)) !important;
        gap:16px !important;
      }
      #dashboardSectionSummaryHostV30 .budget-section-card {
        position:relative;
        min-height:168px;
        padding:19px !important;
        overflow:hidden;
        border-width:1px !important;
        border-radius:22px !important;
        background:linear-gradient(150deg,rgba(255,255,255,.98),rgba(248,250,252,.78)) !important;
        box-shadow:0 12px 30px rgba(15,23,42,.065),inset 0 1px 0 rgba(255,255,255,.95) !important;
        transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;
      }
      #dashboardSectionSummaryHostV30 .budget-section-card::after {
        content:"";
        position:absolute;
        right:-48px;
        bottom:-58px;
        width:145px;
        height:145px;
        border-radius:50%;
        background:currentColor;
        opacity:.035;
        pointer-events:none;
      }
      #dashboardSectionSummaryHostV30 .budget-section-card:hover {
        transform:translateY(-4px);
        box-shadow:0 20px 42px rgba(15,23,42,.11),inset 0 1px 0 rgba(255,255,255,.98) !important;
      }
      #dashboardSectionSummaryHostV30 .budget-section-card h4 {
        font-size:15px !important;
        font-weight:900 !important;
      }
      #dashboardSectionSummaryHostV30 .budget-section-card .space-y-2 {
        position:relative;
        z-index:1;
        margin-top:15px;
        padding-top:13px;
        border-top:1px dashed rgba(148,163,184,.2);
      }
      #dashboardSectionSummaryHostV30 .budget-section-card .space-y-2 > div {
        min-height:24px;
        align-items:center;
      }
      #dashboardSectionSummaryHostV30 .budget-section-card .space-y-2 span {
        font-weight:600;
      }
      #dashboardSectionSummaryHostV30 .budget-section-card .space-y-2 b {
        font-size:13px;
        font-weight:900;
        font-variant-numeric:tabular-nums;
      }

      /* ลบแถบสรุปงบรวมด้านล่างตามที่ขอ */
      #dashboardSectionSummaryHostV30 .budget-section-total-row,
      #budgetSectionSummary .budget-section-total-row {
        display:none !important;
      }

      .dashboard-hidden-chart-v30,
      #dashboardHiddenBudgetChartV30 {
        position:absolute !important;
        left:-9999px !important;
        width:1px !important;
        height:1px !important;
        overflow:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
      }
      .dashboard-hidden-chart-v30 canvas,
      #dashboardHiddenBudgetChartV30 canvas {
        width:1px !important;
        height:1px !important;
        max-height:1px !important;
      }
      .dashboard-project-fullwidth-v30 {
        grid-column:1/-1 !important;
        width:100% !important;
        height:auto !important;
        max-height:none !important;
      }

      html.dark #dashboardSectionSummaryHostV30 {
        border-color:rgba(71,85,105,.68) !important;
        background:
          radial-gradient(circle at 8% 0%,rgba(37,99,235,.16),transparent 28%),
          radial-gradient(circle at 92% 0%,rgba(245,158,11,.12),transparent 29%),
          linear-gradient(145deg,rgba(30,41,59,.96),rgba(15,23,42,.92)) !important;
        box-shadow:0 24px 62px rgba(0,0,0,.28) !important;
      }
      html.dark .dashboard-section-summary-head {
        border-color:rgba(71,85,105,.58) !important;
        background:linear-gradient(135deg,rgba(30,64,175,.16),rgba(6,78,59,.10),rgba(146,64,14,.11)) !important;
      }
      html.dark .dashboard-section-summary-head h3 { color:#f8fafc; }
      html.dark .dashboard-section-summary-head p { color:#94a3b8; }
      html.dark .dashboard-unallocated-v30 {
        border-color:rgba(71,85,105,.72);
        background:rgba(15,23,42,.72);
        color:#cbd5e1;
      }
      html.dark #dashboardSectionSummaryHostV30 .budget-section-card {
        border-color:rgba(71,85,105,.68) !important;
        background:linear-gradient(150deg,rgba(30,41,59,.94),rgba(15,23,42,.86)) !important;
        box-shadow:0 14px 34px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.035) !important;
      }
      html.dark #dashboardSectionSummaryHostV30 .budget-section-card .space-y-2 {
        border-color:rgba(100,116,139,.3);
      }

      @media(max-width:1050px){
        #dashboardSectionSummaryHostV30 .budget-section-summary-grid {
          grid-template-columns:1fr !important;
        }
      }
      @media(max-width:700px){
        .dashboard-section-summary-head {
          align-items:stretch;
          flex-direction:column;
          padding:21px 18px 15px !important;
        }
        .dashboard-unallocated-v30 { width:fit-content; }
        #dashboardSectionSummaryHostV30 #budgetSectionSummary { padding:14px !important; }
        #dashboardSectionSummaryHostV30 .budget-section-card { min-height:154px; }
      }
    `;
    document.head.appendChild(style);
  }

  function apply() {
    queued = false;
    injectStyle();

    const host = document.getElementById('dashboardSectionSummaryHostV30');
    const summary = document.getElementById('budgetSectionSummary');
    if (!host) return;

    if (summary && summary.parentElement !== host) host.appendChild(summary);
    if (!summary) return;

    // เปลี่ยนชื่อหัวกรอบให้ตรงกับเนื้อหา
    const mainTitle = host.querySelector('.dashboard-section-summary-head h3');
    if (mainTitle) mainTitle.textContent = 'สรุปงบตามส่วนงาน';

    // ย้าย "ยังไม่กระจาย" ไปหัวกรอบ และซ่อนหัวข้อซ้ำด้านใน
    const embeddedTitle = [...summary.querySelectorAll('h4')]
      .find(el => el.textContent.trim() === 'สรุปงบตามส่วนงาน');
    const embeddedRow = embeddedTitle?.closest('.mb-3');
    if (embeddedRow) {
      const rightInfo = embeddedRow.lastElementChild;
      const head = host.querySelector('.dashboard-section-summary-head');
      let badge = head?.querySelector('.dashboard-unallocated-v30');
      if (rightInfo && head) {
        if (!badge) {
          badge = document.createElement('div');
          badge.className = 'dashboard-unallocated-v30';
          head.appendChild(badge);
        }
        badge.innerHTML = rightInfo.innerHTML;
      }
      embeddedRow.style.display = 'none';
    }

    // เอาสรุปงบรวมปีงบประมาณด้านล่างออกจาก DOM
    summary.querySelectorAll('.budget-section-total-row').forEach(el => el.remove());

    const list = document.getElementById('projectList');
    const section = list?.closest('section');
    if (section && list) {
      section.style.setProperty('height','auto','important');
      section.style.setProperty('max-height','none','important');
      section.style.setProperty('width','100%','important');
      list.style.setProperty('height','auto','important');
      list.style.setProperty('max-height','620px','important');
      list.style.setProperty('overflow-y','auto','important');
    }
  }

  function schedule(){
    if(queued) return;
    queued=true;
    requestAnimationFrame(apply);
  }

  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  document.addEventListener('DOMContentLoaded',schedule);
  document.addEventListener('shared:header-ready',schedule);
  window.addEventListener('resize',schedule);
  schedule();
})();
