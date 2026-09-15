(() => {
  "use strict";
  const MONTHS_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const STATUS_LABELS = { confirmed:"ยืนยันแล้ว", pending:"รอดำเนินการ", cancelled:"ยกเลิก" };
  const PALETTE = ["#0ea5e9","#22c55e","#a855f7","#f59e0b","#fb7185","#14b8a6","#6366f1","#f97316"];
  let categories = [
    { id:"project", name:"ประชุมโครงการ", color:"#0ea5e9", icon:"fa-diagram-project" },
    { id:"visit", name:"คณะดูงาน", color:"#22c55e", icon:"fa-people-group" },
    { id:"training", name:"อบรม / สัมมนา", color:"#a855f7", icon:"fa-graduation-cap" },
    { id:"head", name:"ประชุมหัวหน้า", color:"#f59e0b", icon:"fa-user-tie" },
    { id:"holiday", name:"วันหยุด", color:"#fb7185", icon:"fa-flag" }
  ];
  let events = [
    { id:cryptoId(), date:"2026-09-01", title:"ประชุมหัวหน้าฝ่าย", start:"09:00", end:"10:30", categoryId:"head", status:"confirmed", location:"ห้องประชุม 1 ชั้น 2", description:"ประชุมติดตามงานประจำเดือนของหัวหน้าฝ่าย" },
    { id:cryptoId(), date:"2026-09-03", title:"คณะดูงานจากหน่วยงานภายนอก", start:"08:30", end:"16:30", categoryId:"visit", status:"confirmed", location:"อาคารสำนักงาน", description:"ต้อนรับและนำเสนอภาพรวมระบบงานขององค์กร" },
    { id:cryptoId(), date:"2026-09-05", title:"อบรมการใช้งานระบบ", start:"13:00", end:"16:00", categoryId:"training", status:"confirmed", location:"ห้องอบรมคอมพิวเตอร์", description:"อบรมการใช้ระบบสำหรับเจ้าหน้าที่" },
    { id:cryptoId(), date:"2026-09-08", title:"ประชุมโครงการระบบ HR", start:"09:00", end:"11:00", categoryId:"project", status:"confirmed", location:"ห้องประชุม 2 ชั้น 3", description:"ติดตามความคืบหน้าและประเด็นงานของโครงการ" },
    { id:cryptoId(), date:"2026-09-08", title:"ประชุมคณะทำงานโครงการ", start:"14:00", end:"15:30", categoryId:"project", status:"pending", location:"ห้องประชุมออนไลน์", description:"ทบทวนแผนงานและผู้รับผิดชอบ" },
    { id:cryptoId(), date:"2026-09-10", title:"คณะดูงานด้านสารสนเทศ", start:"08:30", end:"12:00", categoryId:"visit", status:"confirmed", location:"ฝ่ายเทคโนโลยีสารสนเทศ", description:"แลกเปลี่ยนการดำเนินงานด้านเทคโนโลยี" },
    { id:cryptoId(), date:"2026-09-17", title:"อบรมการจัดเก็บเอกสาร", start:"09:00", end:"12:00", categoryId:"training", status:"pending", location:"ห้องอบรม 1", description:"แนวทางจัดเก็บและค้นคืนเอกสาร" }
  ];
  let currentDate = new Date(2026,8,1);
  let selectedCategories = new Set(categories.map(c=>c.id));
  let keyword = "";
  let selectedStatus = "all";
  let selectedEventId = null;
  let pendingConfirmAction = null;

  function cryptoId(){ return "id-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8); }
  function escapeHtml(value){ return String(value??"").replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch])); }
  function getCategory(id){ return categories.find(c=>c.id===id); }
  function toDateKey(date){ const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,"0"); const d=String(date.getDate()).padStart(2,"0"); return `${y}-${m}-${d}`; }
  function parseDateKey(key){ const [y,m,d]=key.split("-").map(Number); return new Date(y,m-1,d); }
  function formatThaiDate(key){ const d=parseDateKey(key); return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear()+543}`; }
  function readableTextColor(hex){ const n=parseInt(hex.slice(1),16); const r=(n>>16)&255,g=(n>>8)&255,b=n&255; return (r*299+g*587+b*114)/1000>160?"#334155":"#ffffff"; }

  function waitForHeader(){
    if(document.getElementById("pageContent")) return mountPage();
    const observer=new MutationObserver(()=>{ if(document.getElementById("pageContent")){ observer.disconnect(); mountPage(); }});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    document.addEventListener("shared:header-ready",mountPage,{once:true});
  }
  function mountPage(){
    const host=document.getElementById("pageContent"), tpl=document.getElementById("calendarPageTemplate");
    if(!host||!tpl||host.dataset.calendarMounted==="true") return;
    host.dataset.calendarMounted="true"; host.appendChild(tpl.content.cloneNode(true)); document.body.classList.add("calendar-ui-page");
    bindEvents(); setupSafeDateTimePickers(); applyTimeColorTheme(); setDefaultDate(); syncSafePickerValues(); renderAll();
  }
  function setDefaultDate(){ document.getElementById("eventDate").value=toDateKey(new Date(2026,8,15)); syncSafePickerValues(); }
  function filteredEvents(){
    const q=keyword.trim().toLowerCase();
    return events.filter(e=>{
      const cat=getCategory(e.categoryId); if(!cat) return false;
      const hay=[e.title,e.location,e.description,cat.name].join(" ").toLowerCase();
      return selectedCategories.has(e.categoryId)&&(selectedStatus==="all"||e.status===selectedStatus)&&(!q||hay.includes(q));
    });
  }
  function renderAll(){ renderFilters(); renderCategorySelect(); renderCategoryManager(); renderCalendar(); renderUpcoming(); renderLegend(); }
  function renderFilters(){
    const box=document.getElementById("categoryFilters"); if(!box) return;
    box.innerHTML=categories.map(cat=>{
      const count=events.filter(e=>e.categoryId===cat.id).length;
      return `<label class="filter-row"><input class="filter-check category-filter" type="checkbox" value="${cat.id}" ${selectedCategories.has(cat.id)?"checked":""}><i class="filter-dot" style="background:${cat.color}"></i><span class="flex-1 text-sm">${escapeHtml(cat.name)}</span><span class="filter-count">${count}</span></label>`;
    }).join("")||`<p class="text-sm text-slate-400">ยังไม่มีหัวข้อ</p>`;
  }
  function renderCategorySelect(){
    const select=document.getElementById("eventCategory"); if(!select) return;
    const old=select.value;
    select.innerHTML=categories.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    if(categories.some(c=>c.id===old)) select.value=old;
  }
  function renderCategoryManager(){
    const list=document.getElementById("categoryManageList"); if(!list) return;
    list.innerHTML=categories.map(cat=>{
      const count=events.filter(e=>e.categoryId===cat.id).length;
      return `<div class="category-manage-item"><i class="category-color" style="background:${cat.color}"></i><div class="min-w-0 flex-1"><div class="category-name truncate">${escapeHtml(cat.name)}</div><div class="category-meta">${count} กิจกรรม</div></div><button type="button" class="delete-category-btn" data-delete-category="${cat.id}" title="ลบ ${escapeHtml(cat.name)}"><i class="fa-regular fa-trash-can"></i></button></div>`;
    }).join("")||`<div class="py-6 text-center text-sm text-slate-400">ยังไม่มีหัวข้อ กรุณาเพิ่มหัวข้อใหม่</div>`;
  }
  function renderLegend(){
    document.getElementById("calendarLegend").innerHTML=categories.map(c=>`<span class="legend-item"><i class="filter-dot" style="background:${c.color}"></i>${escapeHtml(c.name)}</span>`).join("");
  }
  function renderCalendar(){
    const year=currentDate.getFullYear(), month=currentDate.getMonth();
    document.getElementById("calendarMonthTitle").textContent=`${MONTHS_TH[month]} ${year+543}`;
    const grid=document.getElementById("calendarGrid");
    const weekdays=["อา.","จ.","อ.","พ.","พฤ.","ศ.","ส."];
    let html=weekdays.map((d,i)=>`<div class="weekday ${i===0||i===6?"weekend":""}">${d}</div>`).join("");
    const first=new Date(year,month,1), start=new Date(year,month,1-first.getDay());
    const visible=filteredEvents();
    for(let i=0;i<42;i++){
      const date=new Date(start); date.setDate(start.getDate()+i); const key=toDateKey(date);
      const outside=date.getMonth()!==month, weekend=date.getDay()===0?"sunday":date.getDay()===6?"saturday":"";
      const today=key==="2026-09-15"?"today":"";
      const dayEvents=outside?[]:visible.filter(e=>e.date===key).sort((a,b)=>a.start.localeCompare(b.start));
      html+=`<div class="calendar-day ${outside?"outside":""} ${weekend} ${today}" data-date="${key}"><span class="day-number">${date.getDate()}</span>${dayEvents.map(e=>{
        const cat=getCategory(e.categoryId); const bg=cat.color+"18"; const fg=cat.color; return `<button type="button" class="event-pill ${e.status==="cancelled"?"event-status-cancelled":""}" data-event-id="${e.id}" style="color:${fg};background:${bg};border-color:${cat.color}44" title="${escapeHtml(e.title)}">${escapeHtml(e.title)}<span class="event-time">${e.start} - ${e.end}</span></button>`;
      }).join("")}</div>`;
    }
    grid.innerHTML=html;
  }
  function renderUpcoming(){
    const from="2026-09-15";
    const visible=filteredEvents().filter(e=>e.date>=from).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)).slice(0,5);
    document.getElementById("resultCount").textContent=`พบ ${filteredEvents().length} รายการ`;
    document.getElementById("upcomingList").innerHTML=visible.length?visible.map(e=>{
      const cat=getCategory(e.categoryId); return `<button type="button" class="upcoming-button" data-event-id="${e.id}"><span class="upcoming-icon" style="color:${cat.color};background:${cat.color}18"><i class="fa-solid ${cat.icon||"fa-calendar"}"></i></span><span class="min-w-0"><strong class="block text-sm truncate">${escapeHtml(e.title)}</strong><span class="block text-xs text-slate-500 mt-1">${formatThaiDate(e.date)} ${e.start} - ${e.end}</span><span class="block text-xs text-slate-500 mt-1 truncate">${escapeHtml(e.location||"ไม่ระบุสถานที่")}</span></span></button>`;
    }).join(""):`<div class="py-8 text-center text-sm text-slate-400"><i class="fa-regular fa-calendar-xmark text-2xl mb-2 block"></i>ไม่พบกิจกรรม</div>`;
  }
  function openModal(id){ const el=document.getElementById(id); if(el){ el.hidden=false; document.body.style.overflow="hidden"; } }
  function closeModal(id){ const el=document.getElementById(id); if(el){ el.hidden=true; if(!document.querySelector(".modal:not([hidden])")) document.body.style.overflow=""; } }
  function openEventDetail(id){
    const e=events.find(x=>x.id===id),cat=e&&getCategory(e.categoryId); if(!e||!cat)return;
    selectedEventId=id; document.getElementById("detailTitle").textContent=e.title; document.getElementById("detailCategory").textContent=cat.name;
    document.getElementById("detailDate").textContent=formatThaiDate(e.date); document.getElementById("detailTime").textContent=`${e.start} ถึง ${e.end} น.`;
    document.getElementById("detailLocation").textContent=e.location||"ไม่ระบุสถานที่"; document.getElementById("detailStatus").textContent=STATUS_LABELS[e.status]||e.status;
    document.getElementById("detailDescription").textContent=e.description||"ไม่มีรายละเอียดเพิ่มเติม"; openModal("eventDetailModal");
  }
  function askConfirm(title,message,action){ pendingConfirmAction=action; document.getElementById("confirmTitle").textContent=title; document.getElementById("confirmMessage").textContent=message; openModal("confirmModal"); }
  function showToast(message,type="success"){ const box=document.getElementById("toastContainer"); const toast=document.createElement("div"); toast.className=`toast ${type}`; toast.textContent=message; box.appendChild(toast); setTimeout(()=>toast.remove(),2800); }
  function addCategory(){
    const input=document.getElementById("newCategoryName"), color=document.getElementById("newCategoryColor"), error=document.getElementById("categoryError"); const name=input.value.trim();
    if(!name){ error.textContent="กรุณากรอกชื่อหัวข้อ"; error.hidden=false; return; }
    if(categories.some(c=>c.name.toLowerCase()===name.toLowerCase())){ error.textContent="ชื่อหัวข้อนี้มีอยู่แล้ว"; error.hidden=false; return; }
    const id="cat-"+Date.now().toString(36); categories.push({id,name,color:color.value,icon:"fa-calendar-check"}); selectedCategories.add(id); input.value=""; color.value=PALETTE[categories.length%PALETTE.length]; error.hidden=true; renderAll(); showToast(`เพิ่มหัวข้อ “${name}” แล้ว`);
  }
  function requestDeleteCategory(id){
    const cat=getCategory(id); if(!cat)return; const count=events.filter(e=>e.categoryId===id).length;
    askConfirm("ลบหัวข้อตัวกรอง",count?`หัวข้อ “${cat.name}” มี ${count} กิจกรรม กิจกรรมทั้งหมดในหัวข้อนี้จะถูกลบด้วย`:`ต้องการลบหัวข้อ “${cat.name}” หรือไม่`,()=>{ events=events.filter(e=>e.categoryId!==id); categories=categories.filter(c=>c.id!==id); selectedCategories.delete(id); renderAll(); showToast(`ลบหัวข้อ “${cat.name}” แล้ว`); });
  }
  function saveEvent(){
    const error=document.getElementById("eventFormError"); const title=document.getElementById("eventTitle").value.trim(), date=document.getElementById("eventDate").value, categoryId=document.getElementById("eventCategory").value, start=document.getElementById("eventStartTime").value, end=document.getElementById("eventEndTime").value;
    if(!title||!date||!categoryId||!start||!end){ error.textContent="กรุณากรอกหัวข้อ วันที่ ประเภท และเวลาให้ครบ"; error.hidden=false; return; }
    if(end<=start){ error.textContent="เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม"; error.hidden=false; return; }
    events.push({ id:cryptoId(), title,date,categoryId,start,end,status:document.getElementById("eventStatus").value,location:document.getElementById("eventLocation").value.trim(),description:document.getElementById("eventDescription").value.trim() });
    currentDate=parseDateKey(date); selectedCategories.add(categoryId); document.getElementById("eventForm").reset(); setDefaultDate(); error.hidden=true; closeModal("eventFormModal"); renderAll(); showToast("บันทึกกิจกรรมจำลองแล้ว");
  }
  function fillSample(){
    document.getElementById("eventTitle").value="ประชุมเตรียมต้อนรับคณะดูงาน"; document.getElementById("eventDate").value="2026-09-18"; document.getElementById("eventStartTime").value="09:30"; document.getElementById("eventEndTime").value="11:00"; document.getElementById("eventLocation").value="ห้องประชุม 2 ชั้น 3"; document.getElementById("eventDescription").value="เตรียมกำหนดการ ผู้รับผิดชอบ และเอกสารต้อนรับคณะดูงาน"; if(getCategory("visit"))document.getElementById("eventCategory").value="visit";
  }
  const safeDateState = { view: new Date(2026, 8, 1), level: "day" };
  const safeTimeState = {
    start: { hour: null, minute: null },
    end: { hour: null, minute: null }
  };

  function setupSafeDateTimePickers(){
    setupSafeDatePicker();
    setupSafeTimePicker("eventStartTime", "start");
    setupSafeTimePicker("eventEndTime", "end");
  }

  function setupSafeDatePicker(){
    const input = document.getElementById("eventDate");
    if(!input || input.dataset.safePicker === "true") return;

    input.dataset.safePicker = "true";
    input.type = "hidden";

    const wrapper = document.createElement("div");
    wrapper.className = "safe-date-picker";
    wrapper.innerHTML = `
      <button type="button" class="safe-picker-trigger" aria-haspopup="dialog" aria-expanded="false">
        <strong>เลือกวันที่</strong>
        <i class="fa-regular fa-calendar"></i>
      </button>
      <div class="safe-date-panel" hidden></div>
    `;

    input.before(wrapper);
    wrapper.appendChild(input);

    const trigger = wrapper.querySelector(".safe-picker-trigger");
    const panel = wrapper.querySelector(".safe-date-panel");

    trigger.addEventListener("click", event => {
      event.stopPropagation();
      closeSafePickers(panel);
      const selected = input.value ? parseDateKey(input.value) : new Date();
      safeDateState.view = new Date(selected.getFullYear(), selected.getMonth(), 1);
      safeDateState.level = "day";
      renderSafeDatePanel(wrapper);
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
    });
  }

  function renderSafeDatePanel(wrapper){
    const input = wrapper.querySelector("#eventDate");
    const panel = wrapper.querySelector(".safe-date-panel");
    const year = safeDateState.view.getFullYear();
    const month = safeDateState.view.getMonth();

    let content = "";
    let title = "";

    if(safeDateState.level === "day"){
      title = `${MONTHS_TH[month]} ${year + 543}`;
      const first = new Date(year, month, 1);
      const firstCell = new Date(year, month, 1 - first.getDay());
      let dayButtons = "";

      for(let index = 0; index < 42; index += 1){
        const date = new Date(firstCell);
        date.setDate(firstCell.getDate() + index);
        const key = toDateKey(date);
        const classes = [
          date.getMonth() !== month ? "is-outside" : "",
          key === input.value ? "is-selected" : "",
          key === toDateKey(new Date()) ? "is-today" : ""
        ].filter(Boolean).join(" ");

        dayButtons += `<button type="button" data-safe-date="${key}" class="${classes}">${date.getDate()}</button>`;
      }

      content = `
        <div class="safe-weekdays">${["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map(day => `<span>${day}</span>`).join("")}</div>
        <div class="safe-days">${dayButtons}</div>
      `;
    } else if(safeDateState.level === "month"){
      title = `${year + 543}`;
      content = `<div class="safe-months">${MONTHS_TH.map((name, index) => `
        <button type="button" data-safe-month="${index}" class="${index === month ? "is-selected" : ""}">${name}</button>
      `).join("")}</div>`;
    } else {
      const firstYear = Math.floor(year / 12) * 12;
      title = `${firstYear + 543} - ${firstYear + 554}`;
      content = `<div class="safe-years">${Array.from({ length: 12 }, (_, index) => firstYear + index).map(value => `
        <button type="button" data-safe-year="${value}" class="${value === year ? "is-selected" : ""}">${value + 543}</button>
      `).join("")}</div>`;
    }

    panel.innerHTML = `
      <div class="safe-picker-header">
        <button type="button" class="safe-level-button" data-safe-level>
          ${title}<i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="safe-picker-nav">
          <button type="button" data-safe-prev aria-label="ก่อนหน้า"><i class="fa-solid fa-chevron-left"></i></button>
          <button type="button" data-safe-next aria-label="ถัดไป"><i class="fa-solid fa-chevron-right"></i></button>
          <button type="button" data-safe-close aria-label="ปิด"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
      ${content}
      <div class="safe-picker-footer">
        <button type="button" data-safe-clear>ล้าง</button>
        <button type="button" data-safe-today>วันนี้</button>
      </div>
    `;

    panel.querySelector("[data-safe-close]").addEventListener("click", () => closeSafePickers());
    panel.querySelector("[data-safe-level]").addEventListener("click", () => {
      safeDateState.level = safeDateState.level === "day" ? "month" : safeDateState.level === "month" ? "year" : "day";
      renderSafeDatePanel(wrapper);
    });
    panel.querySelector("[data-safe-prev]").addEventListener("click", () => {
      if(safeDateState.level === "day") safeDateState.view.setMonth(month - 1);
      else safeDateState.view.setFullYear(year - (safeDateState.level === "year" ? 12 : 1));
      renderSafeDatePanel(wrapper);
    });
    panel.querySelector("[data-safe-next]").addEventListener("click", () => {
      if(safeDateState.level === "day") safeDateState.view.setMonth(month + 1);
      else safeDateState.view.setFullYear(year + (safeDateState.level === "year" ? 12 : 1));
      renderSafeDatePanel(wrapper);
    });
    panel.querySelector("[data-safe-clear]").addEventListener("click", () => {
      input.value = "";
      syncSafePickerValues();
      closeSafePickers();
    });
    panel.querySelector("[data-safe-today]").addEventListener("click", () => {
      input.value = toDateKey(new Date());
      syncSafePickerValues();
      closeSafePickers();
    });
    panel.querySelectorAll("[data-safe-date]").forEach(button => button.addEventListener("click", () => {
      input.value = button.dataset.safeDate;
      syncSafePickerValues();
      closeSafePickers();
    }));
    panel.querySelectorAll("[data-safe-month]").forEach(button => button.addEventListener("click", () => {
      safeDateState.view.setMonth(Number(button.dataset.safeMonth));
      safeDateState.level = "day";
      renderSafeDatePanel(wrapper);
    }));
    panel.querySelectorAll("[data-safe-year]").forEach(button => button.addEventListener("click", () => {
      safeDateState.view.setFullYear(Number(button.dataset.safeYear));
      safeDateState.level = "month";
      renderSafeDatePanel(wrapper);
    }));
  }

  function setupSafeTimePicker(inputId, kind){
    const input = document.getElementById(inputId);
    if(!input || input.dataset.safePicker === "true") return;

    input.dataset.safePicker = "true";
    input.type = "hidden";

    const wrapper = document.createElement("div");
    wrapper.className = `event-time-picker safe-time-picker ${kind === "start" ? "time-theme-start" : "time-theme-end"}`;
    wrapper.innerHTML = `
      <button type="button" class="safe-picker-trigger" aria-haspopup="dialog" aria-expanded="false">
        <strong>--:--</strong>
        <i class="fa-regular fa-clock"></i>
      </button>
      <div class="safe-time-panel" hidden></div>
    `;

    input.before(wrapper);
    wrapper.appendChild(input);

    const trigger = wrapper.querySelector(".safe-picker-trigger");
    const panel = wrapper.querySelector(".safe-time-panel");

    trigger.addEventListener("click", event => {
      event.stopPropagation();
      closeSafePickers(panel);
      const [hour, minute] = (input.value || "").split(":");
      safeTimeState[kind] = { hour: hour || null, minute: minute || null };
      renderSafeTimePanel(wrapper, input, kind);
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
    });
  }

  function renderSafeTimePanel(wrapper, input, kind){
    const panel = wrapper.querySelector(".safe-time-panel");
    const state = safeTimeState[kind];
    const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
    const minutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

    panel.innerHTML = `
      <div class="safe-picker-header">
        <strong>${kind === "start" ? "เวลาเริ่ม" : "เวลาสิ้นสุด"} ระบบ 24 ชั่วโมง</strong>
        <div class="safe-picker-nav"><button type="button" data-safe-close aria-label="ปิด"><i class="fa-solid fa-xmark"></i></button></div>
      </div>
      <div class="safe-time-preview">${state.hour || "--"} : ${state.minute || "--"}</div>
      <span class="safe-picker-label">เลือกชั่วโมง</span>
      <div class="safe-hours">${hours.map(value => `<button type="button" data-safe-hour="${value}" class="${state.hour === value ? "is-selected" : ""}">${value}</button>`).join("")}</div>
      <span class="safe-picker-label">เลือกนาที</span>
      <div class="safe-minutes">${minutes.map(value => `<button type="button" data-safe-minute="${value}" class="${state.minute === value ? "is-selected" : ""}">${value}</button>`).join("")}</div>
      <button type="button" class="safe-time-apply" ${!state.hour || !state.minute ? "disabled" : ""}>ใช้เวลานี้</button>
    `;

    panel.querySelector("[data-safe-close]").addEventListener("click", () => closeSafePickers());
    panel.querySelectorAll("[data-safe-hour]").forEach(button => button.addEventListener("click", () => {
      state.hour = button.dataset.safeHour;
      renderSafeTimePanel(wrapper, input, kind);
    }));
    panel.querySelectorAll("[data-safe-minute]").forEach(button => button.addEventListener("click", () => {
      state.minute = button.dataset.safeMinute;
      renderSafeTimePanel(wrapper, input, kind);
    }));
    panel.querySelector(".safe-time-apply").addEventListener("click", () => {
      if(!state.hour || !state.minute) return;
      input.value = `${state.hour}:${state.minute}`;
      syncSafePickerValues();
      closeSafePickers();
    });
  }

  function syncSafePickerValues(){
    const dateInput = document.getElementById("eventDate");
    const dateText = dateInput?.closest(".safe-date-picker")?.querySelector(".safe-picker-trigger strong");
    if(dateText) dateText.textContent = dateInput.value ? formatThaiDate(dateInput.value) : "เลือกวันที่";

    ["eventStartTime", "eventEndTime"].forEach(inputId => {
      const input = document.getElementById(inputId);
      const text = input?.closest(".safe-time-picker")?.querySelector(".safe-picker-trigger strong");
      if(text) text.textContent = input.value || "--:--";
    });
  }

  function closeSafePickers(except = null){
    document.querySelectorAll(".safe-date-panel, .safe-time-panel").forEach(panel => {
      if(panel !== except) panel.hidden = true;
    });
    document.querySelectorAll(".safe-picker-trigger").forEach(trigger => trigger.setAttribute("aria-expanded", "false"));
  }
  function applyTimeColorTheme(){
    const startInput=document.getElementById("eventStartTime");
    const endInput=document.getElementById("eventEndTime");
    const startField=startInput?.closest(".form-field");
    const endField=endInput?.closest(".form-field");
    if(startField)startField.classList.add("time-field","time-field-start");
    if(endField)endField.classList.add("time-field","time-field-end");

    const paintCustomPickers=()=>{
      const startPicker=startInput?.closest(".modern-time-picker, .custom-time-picker, .event-time-picker");
      const endPicker=endInput?.closest(".modern-time-picker, .custom-time-picker, .event-time-picker");
      if(startPicker)startPicker.classList.add("time-theme-start");
      if(endPicker)endPicker.classList.add("time-theme-end");
    };
    paintCustomPickers();
    const form=document.getElementById("eventForm");
    if(form){
      const observer=new MutationObserver(paintCustomPickers);
      observer.observe(form,{childList:true,subtree:true});
    }
  }
  function bindEvents(){
    document.getElementById("manageCategoriesBtn").addEventListener("click",()=>openModal("categoryModal"));
    document.getElementById("addEventBtn").addEventListener("click",()=>{ renderCategorySelect(); openModal("eventFormModal"); });
    document.getElementById("categoryForm").addEventListener("submit",e=>{e.preventDefault();addCategory();});
    document.getElementById("eventForm").addEventListener("submit",e=>{e.preventDefault();saveEvent();});
    document.getElementById("fillSampleBtn").addEventListener("click",()=>{ fillSample(); syncSafePickerValues(); });
    document.addEventListener("click",e=>{
      const closer=e.target.closest("[data-close-modal]"); if(closer)closeModal(closer.dataset.closeModal);
      const eventBtn=e.target.closest("[data-event-id]"); if(eventBtn)openEventDetail(eventBtn.dataset.eventId);
      const catBtn=e.target.closest("[data-delete-category]"); if(catBtn)requestDeleteCategory(catBtn.dataset.deleteCategory);
      if(e.target.classList.contains("modal"))closeModal(e.target.id);
      if(!e.target.closest(".safe-date-picker, .safe-time-picker")) closeSafePickers();
    });
    document.getElementById("categoryFilters").addEventListener("change",e=>{ if(!e.target.classList.contains("category-filter"))return; e.target.checked?selectedCategories.add(e.target.value):selectedCategories.delete(e.target.value); renderCalendar();renderUpcoming(); });
    document.getElementById("eventSearch").addEventListener("input",e=>{keyword=e.target.value;renderCalendar();renderUpcoming();});
    document.getElementById("statusFilter").addEventListener("change",e=>{selectedStatus=e.target.value;renderCalendar();renderUpcoming();});
    document.getElementById("selectAllBtn").addEventListener("click",()=>{selectedCategories=new Set(categories.map(c=>c.id));renderFilters();renderCalendar();renderUpcoming();});
    document.getElementById("clearFiltersBtn").addEventListener("click",()=>{selectedCategories=new Set(categories.map(c=>c.id));keyword="";selectedStatus="all";document.getElementById("eventSearch").value="";document.getElementById("statusFilter").value="all";renderAll();});
    document.getElementById("prevMonthBtn").addEventListener("click",()=>{currentDate.setMonth(currentDate.getMonth()-1);renderCalendar();});
    document.getElementById("nextMonthBtn").addEventListener("click",()=>{currentDate.setMonth(currentDate.getMonth()+1);renderCalendar();});
    document.getElementById("todayBtn").addEventListener("click",()=>{currentDate=new Date(2026,8,15);renderCalendar();});
    document.getElementById("mobileFilterBtn").addEventListener("click",()=>setFilterDrawer(true)); document.getElementById("closeFilterBtn").addEventListener("click",()=>setFilterDrawer(false)); document.getElementById("mobileFilterBackdrop").addEventListener("click",()=>setFilterDrawer(false));
    document.getElementById("deleteEventBtn").addEventListener("click",()=>{ const e=events.find(x=>x.id===selectedEventId); if(!e)return; askConfirm("ลบกิจกรรม",`ต้องการลบกิจกรรม “${e.title}” หรือไม่`,()=>{events=events.filter(x=>x.id!==selectedEventId);closeModal("eventDetailModal");renderAll();showToast("ลบกิจกรรมแล้ว");}); });
    document.getElementById("cancelConfirmBtn").addEventListener("click",()=>{pendingConfirmAction=null;closeModal("confirmModal");});
    document.getElementById("acceptConfirmBtn").addEventListener("click",()=>{const action=pendingConfirmAction;pendingConfirmAction=null;closeModal("confirmModal");if(action)action();});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"){document.querySelectorAll(".modal:not([hidden])").forEach(m=>closeModal(m.id));setFilterDrawer(false);}});
  }
  function setFilterDrawer(open){document.getElementById("filterDrawer").classList.toggle("open",open);document.getElementById("mobileFilterBackdrop").classList.toggle("open",open);}
  waitForHeader();
})();
