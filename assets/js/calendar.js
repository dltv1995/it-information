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
    host.dataset.calendarMounted="true"; host.appendChild(tpl.content.cloneNode(true));
    moveCalendarOverlaysToBody(); bindEvents(); setupModernControls(); setupAttachmentField(); setDefaultDate(); syncModernControls(); renderAll();
  }
  function setDefaultDate(){ document.getElementById("eventDate").value=toDateKey(new Date(2026,8,15)); syncModernControls(); }
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
  function openModal(id){const el=document.getElementById(id);if(el){if(el.parentElement!==document.body)document.body.appendChild(el);el.hidden=false;document.body.classList.add("calendar-modal-open");}}
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
  const modernDate={view:new Date(2026,8,1),mode:"days"}, modernTime={start:{h:null,m:null},end:{h:null,m:null}};
  let draftFiles=[];
  function moveCalendarOverlaysToBody(){["categoryModal","eventFormModal","eventDetailModal","confirmModal","toastContainer","mobileFilterBackdrop"].forEach(id=>{const el=document.getElementById(id);if(el&&el.parentElement!==document.body)document.body.appendChild(el);});}
  function setupModernControls(){setupModernDate();setupModernTime("eventStartTime","start");setupModernTime("eventEndTime","end");}
  function setupModernDate(){const input=document.getElementById("eventDate");if(!input||input.dataset.modern)return;input.dataset.modern='1';input.type='hidden';const root=document.createElement('div');root.className='modern-date-picker';root.innerHTML='<button type="button" class="modern-trigger"><strong>เลือกวันที่</strong><i class="fa-regular fa-calendar"></i></button><div class="modern-date-pop hidden"></div>';input.before(root);root.appendChild(input);root.querySelector('.modern-trigger').onclick=e=>{e.stopPropagation();closeModern();const d=input.value?parseDateKey(input.value):new Date();modernDate.view=new Date(d.getFullYear(),d.getMonth(),1);modernDate.mode='days';drawModernDate(root);root.querySelector('.modern-date-pop').classList.remove('hidden');};}
  function drawModernDate(root){const input=root.querySelector('#eventDate'),pop=root.querySelector('.modern-date-pop'),y=modernDate.view.getFullYear(),m=modernDate.view.getMonth();let body='';if(modernDate.mode==='days'){const first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());let days='';for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=toDateKey(d);days+=`<button type="button" data-day="${key}" class="${d.getMonth()!==m?'outside ':''}${key===input.value?'selected':''}">${d.getDate()}</button>`;}body=`<div class="modern-week">${['อา','จ','อ','พ','พฤ','ศ','ส'].map(v=>`<b>${v}</b>`).join('')}</div><div class="modern-days">${days}</div>`;}else if(modernDate.mode==='months'){body=`<div class="modern-months">${MONTHS_TH.map((v,i)=>`<button type="button" data-month="${i}" class="${i===m?'selected':''}">${v}</button>`).join('')}</div>`;}else{const start=Math.floor(y/12)*12;body=`<div class="modern-years">${Array.from({length:12},(_,i)=>start+i).map(v=>`<button type="button" data-year="${v}" class="${v===y?'selected':''}">${v+543}</button>`).join('')}</div>`;}const title=modernDate.mode==='days'?`${MONTHS_TH[m]} ${y+543}`:modernDate.mode==='months'?`${y+543}`:`${Math.floor(y/12)*12+543} - ${Math.floor(y/12)*12+554}`;pop.innerHTML=`<header><button type="button" data-level class="modern-title">${title}<i class="fa-solid fa-chevron-down"></i></button><span><button type="button" data-prev>‹</button><button type="button" data-next>›</button><button type="button" data-close>×</button></span></header>${body}<footer><button data-clear type="button">ล้าง</button><button data-today type="button">วันนี้</button></footer>`;pop.onclick=e=>e.stopPropagation();pop.querySelector('[data-close]').onclick=()=>pop.classList.add('hidden');pop.querySelector('[data-level]').onclick=()=>{modernDate.mode=modernDate.mode==='days'?'months':modernDate.mode==='months'?'years':'days';drawModernDate(root);};pop.querySelector('[data-prev]').onclick=()=>{if(modernDate.mode==='days')modernDate.view.setMonth(m-1);else modernDate.view.setFullYear(y-(modernDate.mode==='years'?12:1));drawModernDate(root);};pop.querySelector('[data-next]').onclick=()=>{if(modernDate.mode==='days')modernDate.view.setMonth(m+1);else modernDate.view.setFullYear(y+(modernDate.mode==='years'?12:1));drawModernDate(root);};pop.querySelector('[data-clear]').onclick=()=>{input.value='';syncModernControls();pop.classList.add('hidden');};pop.querySelector('[data-today]').onclick=()=>{input.value=toDateKey(new Date());syncModernControls();pop.classList.add('hidden');};pop.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{input.value=b.dataset.day;syncModernControls();pop.classList.add('hidden');});pop.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{modernDate.view.setMonth(+b.dataset.month);modernDate.mode='days';drawModernDate(root);});pop.querySelectorAll('[data-year]').forEach(b=>b.onclick=()=>{modernDate.view.setFullYear(+b.dataset.year);modernDate.mode='months';drawModernDate(root);});}
  function setupModernTime(id,kind){const input=document.getElementById(id);if(!input||input.dataset.modern)return;input.dataset.modern='1';input.type='hidden';const root=document.createElement('div');root.className=`modern-time-picker ${kind==='end'?'end':''}`;root.innerHTML='<button type="button" class="modern-trigger"><strong>--:--</strong><i class="fa-regular fa-clock"></i></button><div class="modern-time-pop hidden"></div>';input.before(root);root.appendChild(input);root.querySelector('.modern-trigger').onclick=e=>{e.stopPropagation();closeModern();const [h,m]=(input.value||'').split(':');modernTime[kind]={h:h||null,m:m||null};drawModernTime(root,input,kind);root.querySelector('.modern-time-pop').classList.remove('hidden');};}
  function drawModernTime(root,input,kind){const pop=root.querySelector('.modern-time-pop'),st=modernTime[kind],hrs=Array.from({length:24},(_,i)=>String(i).padStart(2,'0')),mins=Array.from({length:12},(_,i)=>String(i*5).padStart(2,'0'));pop.innerHTML=`<header><strong>${kind==='start'?'เวลาเริ่ม':'เวลาสิ้นสุด'} ระบบ 24 ชั่วโมง</strong><button type="button" data-close>×</button></header><div class="modern-preview">${st.h||'--'} : ${st.m||'--'}</div><small>เลือกชั่วโมง</small><div class="modern-hours">${hrs.map(v=>`<button type="button" data-h="${v}" class="${st.h===v?'selected':''}">${v}</button>`).join('')}</div><small>เลือกนาที</small><div class="modern-minutes">${mins.map(v=>`<button type="button" data-m="${v}" class="${st.m===v?'selected':''}">${v}</button>`).join('')}</div><button type="button" class="modern-apply" ${!st.h||!st.m?'disabled':''}>ใช้เวลานี้</button>`;pop.onclick=e=>e.stopPropagation();pop.querySelector('[data-close]').onclick=()=>pop.classList.add('hidden');pop.querySelectorAll('[data-h]').forEach(b=>b.onclick=()=>{st.h=b.dataset.h;drawModernTime(root,input,kind);});pop.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{st.m=b.dataset.m;drawModernTime(root,input,kind);});pop.querySelector('.modern-apply').onclick=()=>{if(!st.h||!st.m)return;input.value=`${st.h}:${st.m}`;syncModernControls();pop.classList.add('hidden');};}
  function syncModernControls(){const d=document.getElementById('eventDate'),dt=document.querySelector('.modern-date-picker .modern-trigger strong');if(dt)dt.textContent=d?.value?formatThaiDate(d.value):'เลือกวันที่';['eventStartTime','eventEndTime'].forEach(id=>{const input=document.getElementById(id),t=input?.closest('.modern-time-picker')?.querySelector('.modern-trigger strong');if(t)t.textContent=input.value||'--:--';});}
  function closeModern(){document.querySelectorAll('.modern-date-pop,.modern-time-pop').forEach(x=>x.classList.add('hidden'));}
  function setupAttachmentField(){const grid=document.querySelector('#eventForm .form-grid');if(!grid||document.getElementById('eventAttachments'))return;const field=document.createElement('div');field.className='form-field form-span-2 attachment-field';field.innerHTML='<span>ไฟล์แนบ <small>(ไม่เกิน 5 ไฟล์ ไฟล์ละไม่เกิน 10 MB)</small></span><input id="eventAttachments" type="file" multiple hidden><div class="file-drop"><i class="fa-solid fa-cloud-arrow-up"></i><div><strong>แนบเอกสารประกอบกิจกรรม</strong><small>คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่</small></div><button type="button">เลือกไฟล์</button></div><div class="file-list"></div>';const status=document.getElementById('eventStatus')?.closest('.form-field');grid.insertBefore(field,status||null);const input=field.querySelector('input'),drop=field.querySelector('.file-drop');drop.onclick=e=>{if(!e.target.closest('button')||e.target.closest('button'))input.click();};input.onchange=e=>{[...e.target.files].forEach(f=>{if(draftFiles.length<5&&f.size<=10485760&&!draftFiles.some(x=>x.name===f.name&&x.size===f.size))draftFiles.push(f);});input.value='';renderFiles();};field.querySelector('.file-list').onclick=e=>{const b=e.target.closest('[data-remove]');if(b){draftFiles.splice(+b.dataset.remove,1);renderFiles();}};renderFiles();}
  function renderFiles(){const list=document.querySelector('.file-list');if(!list)return;list.innerHTML=draftFiles.length?draftFiles.map((f,i)=>`<div><i class="fa-solid fa-file-lines"></i><span>${escapeHtml(f.name)}<small>${(f.size/1024/1024).toFixed(2)} MB</small></span><button type="button" data-remove="${i}">×</button></div>`).join(''):'<p>ยังไม่ได้เลือกไฟล์</p>';}
  function bindEvents(){
    document.getElementById("manageCategoriesBtn").addEventListener("click",()=>openModal("categoryModal"));
    document.getElementById("addEventBtn").addEventListener("click",()=>{ renderCategorySelect(); openModal("eventFormModal"); });
    document.getElementById("categoryForm").addEventListener("submit",e=>{e.preventDefault();addCategory();});
    document.getElementById("eventForm").addEventListener("submit",e=>{e.preventDefault();saveEvent();});
    document.getElementById("fillSampleBtn").addEventListener("click",()=>{fillSample();syncModernControls();});
    document.addEventListener("click",e=>{
      const closer=e.target.closest("[data-close-modal]"); if(closer)closeModal(closer.dataset.closeModal);
      const eventBtn=e.target.closest("[data-event-id]"); if(eventBtn)openEventDetail(eventBtn.dataset.eventId);
      const catBtn=e.target.closest("[data-delete-category]"); if(catBtn)requestDeleteCategory(catBtn.dataset.deleteCategory);
      if(e.target.classList.contains("modal"))closeModal(e.target.id);
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
