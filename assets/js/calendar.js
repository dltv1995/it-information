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
    bindEvents(); setupAttachmentField(); setDefaultDate(); renderAll();
  }
  function setDefaultDate(){ document.getElementById("eventDate").value=toDateKey(new Date(2026,8,15)); }
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
    document.getElementById("detailDescription").textContent=e.description||"ไม่มีรายละเอียดเพิ่มเติม"; renderDetailAttachments(e.attachments||[]); openModal("eventDetailModal");
  }
  function renderDetailAttachments(files){
    const description=document.getElementById("detailDescription");if(!description)return;
    let section=document.getElementById("detailAttachments");
    if(!section){section=document.createElement("div");section.id="detailAttachments";section.className="detail-attachments";description.after(section);}
    section.innerHTML=files.length?`<strong><i class="fa-solid fa-paperclip"></i> ไฟล์แนบ ${files.length} ไฟล์</strong>${files.map(file=>`<div><i class="fa-solid ${calendarFileIcon(file)}"></i><span>${escapeHtml(file.name)}</span><small>${formatCalendarFileSize(file.size)}</small></div>`).join("")}`:`<span class="detail-no-files"><i class="fa-regular fa-folder-open"></i> ไม่มีไฟล์แนบ</span>`;
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
    events.push({ id:cryptoId(), title,date,categoryId,start,end,status:document.getElementById("eventStatus").value,location:document.getElementById("eventLocation").value.trim(),description:document.getElementById("eventDescription").value.trim(),attachments:calendarDraftFiles.map(file=>({name:file.name,size:file.size,type:file.type||"application/octet-stream"})) });
    currentDate=parseDateKey(date); selectedCategories.add(categoryId); document.getElementById("eventForm").reset(); resetCalendarAttachments(); setDefaultDate(); error.hidden=true; closeModal("eventFormModal"); renderAll(); showToast("บันทึกกิจกรรมจำลองแล้ว");
  }
  function fillSample(){
    document.getElementById("eventTitle").value="ประชุมเตรียมต้อนรับคณะดูงาน"; document.getElementById("eventDate").value="2026-09-18"; document.getElementById("eventStartTime").value="09:30"; document.getElementById("eventEndTime").value="11:00"; document.getElementById("eventLocation").value="ห้องประชุม 2 ชั้น 3"; document.getElementById("eventDescription").value="เตรียมกำหนดการ ผู้รับผิดชอบ และเอกสารต้อนรับคณะดูงาน"; if(getCategory("visit"))document.getElementById("eventCategory").value="visit";
  }
  const CALENDAR_MAX_FILES=5;
  const CALENDAR_MAX_FILE_SIZE=10*1024*1024;
  let calendarDraftFiles=[];
  function setupAttachmentField(){
    const form=document.getElementById("eventForm"),grid=form?.querySelector(".form-grid");
    if(!form||!grid||document.getElementById("eventAttachments"))return;
    const field=document.createElement("div");
    field.className="form-field form-span-2 calendar-attachment-field";
    field.innerHTML=`<span>ไฟล์แนบ <small>(ไม่เกิน ${CALENDAR_MAX_FILES} ไฟล์ ไฟล์ละไม่เกิน 10 MB)</small></span>
      <input id="eventAttachments" type="file" multiple hidden>
      <div id="calendarFileDrop" class="calendar-file-drop" tabindex="0" role="button" aria-label="เลือกไฟล์แนบ">
        <span class="calendar-upload-icon"><i class="fa-solid fa-cloud-arrow-up"></i></span>
        <div class="calendar-upload-copy"><strong>แนบเอกสารประกอบกิจกรรม</strong><small>คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่</small></div>
        <button id="chooseCalendarFilesBtn" type="button" class="calendar-choose-file-btn"><i class="fa-solid fa-paperclip"></i> เลือกไฟล์</button>
      </div>
      <div id="calendarFileList" class="calendar-file-list"></div>`;
    const statusField=document.getElementById("eventStatus")?.closest(".form-field");
    if(statusField)grid.insertBefore(field,statusField);else grid.appendChild(field);
    const input=field.querySelector("#eventAttachments"),drop=field.querySelector("#calendarFileDrop"),choose=field.querySelector("#chooseCalendarFilesBtn");
    choose.onclick=e=>{e.stopPropagation();input.click();};
    drop.onclick=e=>{if(!e.target.closest("button"))input.click();};
    drop.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();input.click();}};
    input.onchange=e=>{addCalendarFiles([...e.target.files]);input.value="";};
    ["dragenter","dragover"].forEach(name=>drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add("is-dragging");}));
    ["dragleave","drop"].forEach(name=>drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove("is-dragging");}));
    drop.addEventListener("drop",e=>addCalendarFiles([...e.dataTransfer.files]));
    field.querySelector("#calendarFileList").onclick=e=>{const button=e.target.closest("[data-remove-calendar-file]");if(!button)return;calendarDraftFiles.splice(Number(button.dataset.removeCalendarFile),1);renderCalendarFiles();};
    renderCalendarFiles();
  }
  function addCalendarFiles(files){
    const error=document.getElementById("eventFormError");
    for(const file of files){
      if(calendarDraftFiles.length>=CALENDAR_MAX_FILES){showAttachmentError(`แนบไฟล์ได้สูงสุด ${CALENDAR_MAX_FILES} ไฟล์`);break;}
      if(file.size>CALENDAR_MAX_FILE_SIZE){showAttachmentError(`${file.name} มีขนาดเกิน 10 MB`);continue;}
      if(calendarDraftFiles.some(item=>item.name===file.name&&item.size===file.size)){showAttachmentError(`${file.name} ถูกเลือกไว้แล้ว`);continue;}
      calendarDraftFiles.push(file);
    }
    if(error&&calendarDraftFiles.length)error.hidden=true;
    renderCalendarFiles();
  }
  function showAttachmentError(message){const error=document.getElementById("eventFormError");if(error){error.textContent=message;error.hidden=false;}else showToast(message,"error");}
  function renderCalendarFiles(){
    const list=document.getElementById("calendarFileList");if(!list)return;
    list.innerHTML=calendarDraftFiles.length?calendarDraftFiles.map((file,index)=>`<div class="calendar-file-item"><span class="calendar-file-type"><i class="fa-solid ${calendarFileIcon(file)}"></i></span><div><strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong><small>${formatCalendarFileSize(file.size)} · พร้อมแนบ</small></div><button type="button" data-remove-calendar-file="${index}" title="นำไฟล์ออก"><i class="fa-solid fa-xmark"></i></button></div>`).join(""):`<div class="calendar-file-empty"><i class="fa-regular fa-folder-open"></i> ยังไม่ได้เลือกไฟล์</div>`;
  }
  function calendarFileIcon(file){const type=file.type||"",name=file.name.toLowerCase();if(type.includes("pdf")||name.endsWith(".pdf"))return "fa-file-pdf";if(type.includes("image"))return "fa-file-image";if(name.endsWith(".doc")||name.endsWith(".docx"))return "fa-file-word";if(name.endsWith(".xls")||name.endsWith(".xlsx"))return "fa-file-excel";if(name.endsWith(".ppt")||name.endsWith(".pptx"))return "fa-file-powerpoint";return "fa-file-lines";}
  function formatCalendarFileSize(bytes){if(bytes<1024)return `${bytes} B`;if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/1024/1024).toFixed(1)} MB`;}
  function resetCalendarAttachments(){calendarDraftFiles=[];renderCalendarFiles();}
  function bindEvents(){
    document.getElementById("manageCategoriesBtn").addEventListener("click",()=>openModal("categoryModal"));
    document.getElementById("addEventBtn").addEventListener("click",()=>{ renderCategorySelect(); openModal("eventFormModal"); });
    document.getElementById("categoryForm").addEventListener("submit",e=>{e.preventDefault();addCategory();});
    document.getElementById("eventForm").addEventListener("submit",e=>{e.preventDefault();saveEvent();});
    document.getElementById("fillSampleBtn").addEventListener("click",fillSample);
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
