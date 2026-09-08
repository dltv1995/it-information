(() => {
  const categories = {
    project: { label: "ประชุมโครงการ", color: "bg-sky-500", className: "event-project", icon: "fa-diagram-project" },
    visit: { label: "คณะดูงาน", color: "bg-green-500", className: "event-visit", icon: "fa-people-group" },
    training: { label: "อบรม / สัมมนา", color: "bg-purple-500", className: "event-training", icon: "fa-graduation-cap" },
    head: { label: "ประชุมหัวหน้า", color: "bg-amber-500", className: "event-head", icon: "fa-user-tie" },
    holiday: { label: "วันหยุด", color: "bg-rose-400", className: "event-holiday", icon: "fa-flag" }
  };

  const events = [
    { id: 1, day: 1, title: "ประชุมหัวหน้าฝ่าย", time: "09:00", end: "10:30", category: "head", status: "confirmed", location: "ห้องประชุม 1 ชั้น 2", description: "ประชุมติดตามงานประจำเดือนของหัวหน้าฝ่าย" },
    { id: 2, day: 3, title: "คณะดูงานจากหน่วยงานภายนอก", time: "08:30", end: "16:30", category: "visit", status: "confirmed", location: "อาคารสำนักงาน", description: "ต้อนรับและนำเสนอภาพรวมระบบงานขององค์กร" },
    { id: 3, day: 5, title: "อบรมการใช้งานระบบ", time: "13:00", end: "16:00", category: "training", status: "confirmed", location: "ห้องอบรมคอมพิวเตอร์", description: "อบรมการใช้งานระบบสำหรับเจ้าหน้าที่" },
    { id: 4, day: 8, title: "ประชุมโครงการระบบ HR", time: "09:00", end: "11:00", category: "project", status: "confirmed", location: "ห้องประชุม 2 ชั้น 3", description: "ติดตามความคืบหน้าและประเด็นงานของโครงการ" },
    { id: 5, day: 8, title: "ประชุมคณะทำงานโครงการ", time: "14:00", end: "15:30", category: "project", status: "pending", location: "ห้องประชุมออนไลน์", description: "ทบทวนแผนงานและผู้รับผิดชอบ" },
    { id: 6, day: 10, title: "คณะดูงานด้านสารสนเทศ", time: "08:30", end: "12:00", category: "visit", status: "confirmed", location: "ฝ่ายเทคโนโลยีสารสนเทศ", description: "แลกเปลี่ยนการดำเนินงานด้านเทคโนโลยี" },
    { id: 7, day: 13, title: "วันหยุดราชการ", time: "ทั้งวัน", end: "", category: "holiday", status: "confirmed", location: "-", description: "วันหยุดตามปฏิทินตัวอย่าง" },
    { id: 8, day: 15, title: "ประชุมโครงการพัฒนาระบบ", time: "10:00", end: "11:30", category: "project", status: "confirmed", location: "ห้องประชุม 3", description: "สรุปผลการพัฒนาในรอบปัจจุบัน" },
    { id: 9, day: 17, title: "อบรมการจัดเก็บเอกสาร", time: "09:00", end: "12:00", category: "training", status: "pending", location: "ห้องอบรม 1", description: "แนวทางจัดเก็บและค้นคืนเอกสาร" },
    { id: 10, day: 19, title: "ประชุมโครงการงบประมาณ", time: "13:30", end: "15:00", category: "project", status: "confirmed", location: "ห้องประชุม 2", description: "ตรวจสอบกรอบงานและงบประมาณโครงการ" },
    { id: 11, day: 22, title: "คณะดูงานระบบบริหาร", time: "08:30", end: "15:30", category: "visit", status: "confirmed", location: "อาคารสำนักงาน", description: "กิจกรรมศึกษาดูงานระบบบริหารจัดการ" },
    { id: 12, day: 24, title: "ประชุมหัวหน้าฝ่าย", time: "09:30", end: "11:00", category: "head", status: "confirmed", location: "ห้องประชุม 1 ชั้น 2", description: "ติดตามข้อสั่งการและผลการดำเนินงาน" },
    { id: 13, day: 29, title: "ประชุมโครงการระบบเอกสาร", time: "09:00", end: "10:30", category: "project", status: "confirmed", location: "ห้องประชุมออนไลน์", description: "ทดสอบระบบและสรุปประเด็นก่อนเปิดใช้งาน" }
  ];

  let selectedCategories = new Set(Object.keys(categories));
  let keyword = "";
  let selectedStatus = "all";

  function waitForHeader() {
    if (document.getElementById("pageContent")) return mountPage();
    document.addEventListener("shared:header-ready", mountPage, { once: true });
  }

  function mountPage() {
    const pageContent = document.getElementById("pageContent");
    const template = document.getElementById("calendarPageTemplate");
    if (!pageContent || !template || pageContent.dataset.calendarMounted === "true") return;
    pageContent.dataset.calendarMounted = "true";
    pageContent.appendChild(template.content.cloneNode(true));
    buildFilters();
    bindPageEvents();
    render();
  }

  function filteredEvents() {
    const q = keyword.trim().toLowerCase();
    return events.filter(event => {
      const text = [event.title, event.location, event.description, categories[event.category].label].join(" ").toLowerCase();
      return selectedCategories.has(event.category)
        && (selectedStatus === "all" || event.status === selectedStatus)
        && (!q || text.includes(q));
    });
  }

  function buildFilters() {
    const wrap = document.getElementById("categoryFilters");
    wrap.innerHTML = Object.entries(categories).map(([key, item]) => {
      const count = events.filter(event => event.category === key).length;
      return `<label class="flex items-center gap-3 cursor-pointer group">
        <input class="filter-check category-filter" type="checkbox" value="${key}" checked />
        <i class="filter-dot ${item.color}"></i>
        <span class="flex-1 text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">${item.label}</span>
        <span class="min-w-7 h-7 px-2 inline-flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-300">${count}</span>
      </label>`;
    }).join("");
  }

  function render() {
    renderCalendar();
    renderUpcoming();
  }

  function renderCalendar() {
    const grid = document.getElementById("calendarGrid");
    const weekdays = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    let html = weekdays.map((day, index) => `<div class="weekday ${index === 0 || index === 6 ? "weekend" : ""}">${day}</div>`).join("");
    const cells = [
      { day: 30, outside: true }, { day: 31, outside: true },
      ...Array.from({ length: 30 }, (_, i) => ({ day: i + 1, outside: false })),
      { day: 1, outside: true }, { day: 2, outside: true }, { day: 3, outside: true }, { day: 4, outside: true }, { day: 5, outside: true }
    ];
    const visible = filteredEvents();
    cells.forEach((cell, index) => {
      const weekdayIndex = index % 7;
      const dayEvents = cell.outside ? [] : visible.filter(event => event.day === cell.day);
      const classes = ["calendar-day", cell.outside ? "outside" : "", cell.day === 8 && !cell.outside ? "today" : "", weekdayIndex === 0 ? "sunday" : "", weekdayIndex === 6 ? "saturday" : ""].filter(Boolean).join(" ");
      html += `<div class="${classes}"><span class="day-number">${cell.day}</span>${dayEvents.map(event => {
        const cat = categories[event.category];
        return `<button type="button" class="event-pill ${cat.className}" data-event-id="${event.id}" title="${event.title}">${event.title}<span class="event-time">${event.time}</span></button>`;
      }).join("")}</div>`;
    });
    grid.innerHTML = html;
    grid.querySelectorAll("[data-event-id]").forEach(button => button.addEventListener("click", () => openEvent(Number(button.dataset.eventId))));
  }

  function renderUpcoming() {
    const visible = filteredEvents().filter(event => event.day >= 8).slice(0, 4);
    document.getElementById("resultCount").textContent = `พบ ${filteredEvents().length} รายการ`;
    document.getElementById("upcomingList").innerHTML = visible.length ? visible.map(event => {
      const cat = categories[event.category];
      return `<button type="button" data-upcoming-id="${event.id}" class="w-full flex gap-3 text-left rounded-xl p-2 -mx-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition">
        <span class="upcoming-icon rounded-xl ${cat.className} inline-flex items-center justify-center"><i class="fa-solid ${cat.icon}"></i></span>
        <span class="min-w-0">
          <strong class="block text-sm truncate text-slate-800 dark:text-white">${event.title}</strong>
          <span class="block text-xs text-slate-500 dark:text-slate-400 mt-1">${event.day} ก.ย. 2569 ${event.time}${event.end ? ` - ${event.end}` : ""}</span>
          <span class="block text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">${event.location}</span>
        </span>
      </button>`;
    }).join("") : `<div class="py-8 text-center text-sm text-slate-400"><i class="fa-regular fa-calendar-xmark text-2xl mb-2 block"></i>ไม่พบกิจกรรม</div>`;
    document.querySelectorAll("[data-upcoming-id]").forEach(button => button.addEventListener("click", () => openEvent(Number(button.dataset.upcomingId))));
  }

  function openEvent(id) {
    const event = events.find(item => item.id === id);
    if (!event) return;
    const cat = categories[event.category];
    document.getElementById("modalTitle").textContent = event.title;
    document.getElementById("modalCategory").textContent = cat.label;
    document.getElementById("modalDate").textContent = `${event.day} กันยายน 2569`;
    document.getElementById("modalTime").textContent = event.end ? `${event.time} ถึง ${event.end} น.` : event.time;
    document.getElementById("modalLocation").textContent = event.location;
    document.getElementById("modalDescription").textContent = event.description;
    document.getElementById("eventModal").hidden = false;
  }

  function closeEvent() { document.getElementById("eventModal").hidden = true; }

  function setFilterDrawer(open) {
    document.getElementById("filterDrawer").classList.toggle("open", open);
    document.getElementById("mobileFilterBackdrop").classList.toggle("open", open);
  }

  function bindPageEvents() {
    document.getElementById("eventSearch").addEventListener("input", event => { keyword = event.target.value; render(); });
    document.getElementById("statusFilter").addEventListener("change", event => { selectedStatus = event.target.value; render(); });
    document.getElementById("categoryFilters").addEventListener("change", event => {
      if (!event.target.classList.contains("category-filter")) return;
      event.target.checked ? selectedCategories.add(event.target.value) : selectedCategories.delete(event.target.value);
      render();
    });
    document.getElementById("selectAllBtn").addEventListener("click", () => {
      selectedCategories = new Set(Object.keys(categories));
      document.querySelectorAll(".category-filter").forEach(box => box.checked = true);
      render();
    });
    document.getElementById("clearFiltersBtn").addEventListener("click", () => {
      selectedCategories = new Set(Object.keys(categories)); keyword = ""; selectedStatus = "all";
      document.getElementById("eventSearch").value = "";
      document.getElementById("statusFilter").value = "all";
      document.querySelectorAll(".category-filter").forEach(box => box.checked = true);
      render();
    });
    document.getElementById("mobileFilterBtn").addEventListener("click", () => setFilterDrawer(true));
    document.getElementById("closeFilterBtn").addEventListener("click", () => setFilterDrawer(false));
    document.getElementById("mobileFilterBackdrop").addEventListener("click", () => setFilterDrawer(false));
    document.getElementById("closeModalBtn").addEventListener("click", closeEvent);
    document.getElementById("eventModal").addEventListener("click", event => { if (event.target.id === "eventModal") closeEvent(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape") { closeEvent(); setFilterDrawer(false); } });
    document.querySelectorAll(".view-btn").forEach(button => button.addEventListener("click", () => {
      document.querySelectorAll(".view-btn").forEach(item => item.className = "view-btn px-4 py-2 text-sm font-medium rounded-md text-slate-600 dark:text-slate-300");
      button.className = "view-btn px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white";
    }));
    document.getElementById("addEventBtn").addEventListener("click", () => alert("ขั้นตอนนี้จัดทำเฉพาะหน้า UI ปุ่มเพิ่มกิจกรรมจะเชื่อม Firebase ในขั้นถัดไป"));
    document.getElementById("todayBtn").addEventListener("click", () => document.querySelector(".today")?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }));
  }

  waitForHeader();
})();
