import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log("calendar.js loaded: calendar-firebase-v3");

const CALENDAR_DRIVE_API_URL =
  "https://script.google.com/macros/s/AKfycbyPvAKHa1OYf7lAKYWMdZv7wrqtT80JVWODKci7vVlzgxVgBa8QaAqKDESHS6QMmNK6dw/exec";
const EVENTS_COLLECTION = "calendar_events";
const CATEGORIES_COLLECTION = "calendar_categories";
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PARALLEL_UPLOAD_LIMIT = 3;
const MONTHS_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const DEFAULT_CATEGORIES = [
  { id: "project", name: "ประชุมโครงการ", color: "#0ea5e9", icon: "fa-diagram-project" },
  { id: "visit", name: "คณะดูงาน", color: "#22c55e", icon: "fa-people-group" },
  { id: "training", name: "อบรม / สัมมนา", color: "#a855f7", icon: "fa-graduation-cap" },
  { id: "head", name: "ประชุมหัวหน้า", color: "#f59e0b", icon: "fa-user-tie" },
  { id: "holiday", name: "วันหยุด", color: "#fb7185", icon: "fa-flag" },
];
const STATUS_LABELS = { confirmed: "ยืนยันแล้ว", pending: "รอดำเนินการ", cancelled: "ยกเลิก" };

let currentUser = null;
let categories = [];
let events = [];
let currentDate = new Date();
let selectedCategories = new Set();
let selectedStatus = "all";
let keyword = "";
let selectedEventId = null;
let pendingConfirmAction = null;
let selectedFiles = [];
let unsubscribeEvents = null;
let unsubscribeCategories = null;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
document.addEventListener("shared:layout-ready", mount);

function mount() {
  const pageContent = document.getElementById("pageContent");
  const template = document.getElementById("calendarPageTemplate");
  if (!pageContent || !template) return window.setTimeout(mount, 80);
  if (pageContent.querySelector(".calendar-page")) return;

  pageContent.replaceChildren(template.content.cloneNode(true));
  moveOverlaysToBody();
  setupFormControls();
  bindEvents();
  renderAll();

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    setManagementState();
    if (!user) {
      categories = DEFAULT_CATEGORIES.map((item) => ({ ...item }));
      selectedCategories = new Set(categories.map((item) => item.id));
      events = [];
      renderAll();
      return;
    }
    await seedCategories();
    listenRealtime();
  });
}

function moveOverlaysToBody() {
  ["categoryModal", "eventFormModal", "eventDetailModal", "confirmModal", "toastContainer", "mobileFilterBackdrop"].forEach((id) => {
    const element = document.getElementById(id);
    if (element && element.parentElement !== document.body) document.body.appendChild(element);
  });
}

function setManagementState() {
  ["manageCategoriesBtn", "addEventBtn"].forEach((id) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.disabled = !currentUser;
    button.title = currentUser ? "" : "กรุณาเข้าสู่ระบบก่อนจัดการข้อมูล";
  });
}

async function seedCategories() {
  const batch = writeBatch(db);
  DEFAULT_CATEGORIES.forEach((item) => {
    batch.set(doc(db, CATEGORIES_COLLECTION, item.id), {
      name: item.name,
      color: item.color,
      icon: item.icon,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit();
}

function listenRealtime() {
  unsubscribeEvents?.();
  unsubscribeCategories?.();
  unsubscribeEvents = onSnapshot(collection(db, EVENTS_COLLECTION), (snapshot) => {
    events = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderAll();
  }, (error) => showToast(`โหลดกิจกรรมไม่สำเร็จ: ${error.message}`, "error"));
  unsubscribeCategories = onSnapshot(collection(db, CATEGORIES_COLLECTION), (snapshot) => {
    categories = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    selectedCategories = new Set(categories.map((item) => item.id));
    renderAll();
  }, (error) => showToast(`โหลดประเภทไม่สำเร็จ: ${error.message}`, "error"));
}

function bindEvents() {
  document.getElementById("manageCategoriesBtn").addEventListener("click", () => requireLogin(() => openModal("categoryModal")));
  document.getElementById("addEventBtn").addEventListener("click", () => requireLogin(() => { renderCategorySelect(); openModal("eventFormModal"); }));
  document.getElementById("categoryForm").addEventListener("submit", saveCategory);
  document.getElementById("eventForm").addEventListener("submit", saveEvent);
  document.getElementById("fillSampleBtn").addEventListener("click", fillSample);
  document.getElementById("chooseEventFilesBtn").addEventListener("click", () => document.getElementById("eventAttachments").click());
  document.getElementById("eventAttachments").addEventListener("change", (event) => { addFiles([...event.target.files]); event.target.value = ""; });
  document.getElementById("eventFileList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-file]");
    if (!button) return;
    selectedFiles.splice(Number(button.dataset.removeFile), 1);
    renderFiles();
  });
  document.getElementById("eventSearch").addEventListener("input", (event) => { keyword = event.target.value; renderCalendar(); renderUpcoming(); });
  document.getElementById("statusFilter").addEventListener("change", (event) => { selectedStatus = event.target.value; renderCalendar(); renderUpcoming(); });
  document.getElementById("categoryFilters").addEventListener("change", (event) => {
    if (!event.target.classList.contains("category-filter")) return;
    event.target.checked ? selectedCategories.add(event.target.value) : selectedCategories.delete(event.target.value);
    renderCalendar(); renderUpcoming();
  });
  document.getElementById("selectAllBtn").addEventListener("click", () => { selectedCategories = new Set(categories.map((item) => item.id)); renderAll(); });
  document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    selectedCategories = new Set(categories.map((item) => item.id));
    selectedStatus = "all"; keyword = "";
    document.getElementById("eventSearch").value = "";
    document.getElementById("statusFilter").value = "all";
    renderAll();
  });
  document.getElementById("prevMonthBtn").addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
  document.getElementById("nextMonthBtn").addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
  document.getElementById("todayBtn").addEventListener("click", () => { currentDate = new Date(); renderCalendar(); });
  document.getElementById("mobileFilterBtn").addEventListener("click", () => setFilterDrawer(true));
  document.getElementById("closeFilterBtn").addEventListener("click", () => setFilterDrawer(false));
  document.getElementById("mobileFilterBackdrop").addEventListener("click", () => setFilterDrawer(false));
  document.getElementById("deleteEventBtn").addEventListener("click", requestDeleteEvent);
  document.getElementById("cancelConfirmBtn").addEventListener("click", () => { pendingConfirmAction = null; closeModal("confirmModal"); });
  document.getElementById("acceptConfirmBtn").addEventListener("click", () => { const action = pendingConfirmAction; pendingConfirmAction = null; closeModal("confirmModal"); action?.(); });

  document.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-modal]");
    if (closeButton) closeModal(closeButton.dataset.closeModal);
    const eventButton = event.target.closest("[data-event-id]");
    if (eventButton) openEventDetail(eventButton.dataset.eventId);
    const categoryButton = event.target.closest("[data-delete-category]");
    if (categoryButton) requestDeleteCategory(categoryButton.dataset.deleteCategory);
    if (event.target.classList.contains("modal")) closeModal(event.target.id);
    if (!event.target.closest(".cal-control")) closePickers();
  });
}

function setupFormControls() {
  setupDatePicker();
  setupTimePicker("eventStartTime", "start");
  setupTimePicker("eventEndTime", "end");
  setDefaultDate();
  renderFiles();
}

function createPickerShell(input, className, icon) {
  input.type = "hidden";
  const wrapper = document.createElement("div");
  wrapper.className = `cal-control ${className}`;
  wrapper.innerHTML = `<button type="button" class="cal-trigger"><strong>--</strong><i class="fa-regular ${icon}"></i></button><div class="cal-pop" hidden></div>`;
  input.before(wrapper);
  wrapper.appendChild(input);
  return wrapper;
}

function setupDatePicker() {
  const input = document.getElementById("eventDate");
  const wrapper = createPickerShell(input, "cal-date", "fa-calendar");
  const trigger = wrapper.querySelector(".cal-trigger");
  const panel = wrapper.querySelector(".cal-pop");
  let view = new Date();
  let mode = "day";

  function draw() {
    const year = view.getFullYear();
    const month = view.getMonth();
    let title = "";
    let content = "";

    if (mode === "day") {
      title = `${MONTHS_TH[month]} ${year + 543}`;
      const first = new Date(year, month, 1);
      const start = new Date(year, month, 1 - first.getDay());
      let buttons = "";
      for (let index = 0; index < 42; index += 1) {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        const key = toDateKey(date);
        buttons += `<button type="button" data-date="${key}" class="${date.getMonth() !== month ? "muted " : ""}${key === input.value ? "on" : ""}">${date.getDate()}</button>`;
      }
      content = `<div class="cal-week">${["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day) => `<b>${day}</b>`).join("")}</div><div class="cal-days">${buttons}</div>`;
    } else if (mode === "month") {
      title = String(year + 543);
      content = `<div class="cal-choices">${MONTHS_TH.map((name, index) => `<button type="button" data-month="${index}">${name}</button>`).join("")}</div>`;
    } else {
      const firstYear = Math.floor(year / 12) * 12;
      title = `${firstYear + 543} - ${firstYear + 554}`;
      content = `<div class="cal-choices">${Array.from({ length: 12 }, (_, index) => firstYear + index).map((value) => `<button type="button" data-year="${value}">${value + 543}</button>`).join("")}</div>`;
    }

    panel.innerHTML = `<header><button type="button" data-level>${title} <i class="fa-solid fa-chevron-down"></i></button><span><button type="button" data-prev>‹</button><button type="button" data-next>›</button><button type="button" data-close>×</button></span></header>${content}<footer><button type="button" data-clear>ล้าง</button><button type="button" data-today>วันนี้</button></footer>`;
    panel.onclick = (event) => event.stopPropagation();
    panel.querySelector("[data-close]").onclick = () => { panel.hidden = true; };
    panel.querySelector("[data-level]").onclick = (event) => { event.stopPropagation(); mode = mode === "day" ? "month" : mode === "month" ? "year" : "day"; draw(); panel.hidden = false; };
    panel.querySelector("[data-prev]").onclick = (event) => { event.stopPropagation(); mode === "day" ? view.setMonth(month - 1) : view.setFullYear(year - (mode === "year" ? 12 : 1)); draw(); panel.hidden = false; };
    panel.querySelector("[data-next]").onclick = (event) => { event.stopPropagation(); mode === "day" ? view.setMonth(month + 1) : view.setFullYear(year + (mode === "year" ? 12 : 1)); draw(); panel.hidden = false; };
    panel.querySelector("[data-clear]").onclick = () => { input.value = ""; refreshPickerLabels(); panel.hidden = true; };
    panel.querySelector("[data-today]").onclick = () => { input.value = toDateKey(new Date()); refreshPickerLabels(); panel.hidden = true; };
    panel.querySelectorAll("[data-date]").forEach((button) => { button.onclick = () => { input.value = button.dataset.date; refreshPickerLabels(); panel.hidden = true; }; });
    panel.querySelectorAll("[data-month]").forEach((button) => { button.onclick = (event) => { event.stopPropagation(); view.setMonth(Number(button.dataset.month)); mode = "day"; draw(); panel.hidden = false; }; });
    panel.querySelectorAll("[data-year]").forEach((button) => { button.onclick = (event) => { event.stopPropagation(); view.setFullYear(Number(button.dataset.year)); mode = "month"; draw(); panel.hidden = false; }; });
  }

  trigger.onclick = (event) => {
    event.stopPropagation();
    closePickers(panel);
    const selected = input.value ? parseDateKey(input.value) : new Date();
    view = new Date(selected.getFullYear(), selected.getMonth(), 1);
    mode = "day";
    draw();
    panel.hidden = false;
  };
}

function setupTimePicker(inputId, kind) {
  const input = document.getElementById(inputId);
  const wrapper = createPickerShell(input, `cal-time ${kind}`, "fa-clock");
  const trigger = wrapper.querySelector(".cal-trigger");
  const panel = wrapper.querySelector(".cal-pop");
  let hour = null;
  let minute = null;

  function draw() {
    const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
    const minutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));
    panel.innerHTML = `<header><strong>${kind === "start" ? "เวลาเริ่ม" : "เวลาสิ้นสุด"} ระบบ 24 ชั่วโมง</strong><button type="button" data-close>×</button></header><div class="cal-preview">${hour || "--"} : ${minute || "--"}</div><small>เลือกชั่วโมง</small><div class="cal-time-grid">${hours.map((value) => `<button type="button" data-hour="${value}" class="${hour === value ? "on" : ""}">${value}</button>`).join("")}</div><small>เลือกนาที</small><div class="cal-time-grid">${minutes.map((value) => `<button type="button" data-minute="${value}" class="${minute === value ? "on" : ""}">${value}</button>`).join("")}</div><button type="button" class="cal-apply" ${hour === null || minute === null ? "disabled" : ""}>ใช้เวลานี้</button>`;
    panel.onclick = (event) => event.stopPropagation();
    panel.querySelector("[data-close]").onclick = () => { panel.hidden = true; };
    panel.querySelectorAll("[data-hour]").forEach((button) => { button.onclick = (event) => { event.stopPropagation(); hour = button.dataset.hour; draw(); panel.hidden = false; }; });
    panel.querySelectorAll("[data-minute]").forEach((button) => { button.onclick = (event) => { event.stopPropagation(); minute = button.dataset.minute; draw(); panel.hidden = false; }; });
    panel.querySelector(".cal-apply").onclick = (event) => { event.stopPropagation(); if (hour === null || minute === null) return; input.value = `${hour}:${minute}`; refreshPickerLabels(); panel.hidden = true; };
  }

  trigger.onclick = (event) => {
    event.stopPropagation();
    closePickers(panel);
    const values = (input.value || "").split(":");
    hour = values[0] || null;
    minute = values[1] || null;
    draw();
    panel.hidden = false;
  };
}

function closePickers(except = null) {
  document.querySelectorAll(".cal-pop").forEach((panel) => { if (panel !== except) panel.hidden = true; });
}

function refreshPickerLabels() {
  const dateInput = document.getElementById("eventDate");
  const dateLabel = dateInput?.closest(".cal-date")?.querySelector(".cal-trigger strong");
  if (dateLabel) dateLabel.textContent = dateInput.value ? formatThaiDate(dateInput.value) : "เลือกวันที่";
  ["eventStartTime", "eventEndTime"].forEach((id) => {
    const input = document.getElementById(id);
    const label = input?.closest(".cal-time")?.querySelector(".cal-trigger strong");
    if (label) label.textContent = input.value || "--:--";
  });
}

function setDefaultDate() {
  document.getElementById("eventDate").value = toDateKey(new Date());
  refreshPickerLabels();
}

async function saveCategory(event) {
  event.preventDefault();
  if (!currentUser) return showToast("กรุณาเข้าสู่ระบบก่อนเพิ่มประเภท", "error");
  const input = document.getElementById("newCategoryName");
  const color = document.getElementById("newCategoryColor");
  const errorBox = document.getElementById("categoryError");
  const name = input.value.trim();
  if (!name) return;
  if (categories.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
    errorBox.textContent = "ชื่อหัวข้อนี้มีอยู่แล้ว";
    errorBox.hidden = false;
    return;
  }
  try {
    const categoryRef = doc(collection(db, CATEGORIES_COLLECTION));
    await setDoc(categoryRef, { name, color: color.value, icon: "fa-calendar-check", createdBy: currentUser.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    input.value = "";
    errorBox.hidden = true;
    showToast("เพิ่มหัวข้อเรียบร้อยแล้ว");
  } catch (error) {
    errorBox.textContent = `เพิ่มหัวข้อไม่สำเร็จ: ${error.message}`;
    errorBox.hidden = false;
  }
}

async function saveEvent(event) {
  event.preventDefault();
  if (!currentUser) return showToast("กรุณาเข้าสู่ระบบก่อนบันทึกกิจกรรม", "error");
  const errorBox = document.getElementById("eventFormError");
  const data = {
    title: document.getElementById("eventTitle").value.trim(),
    date: document.getElementById("eventDate").value,
    categoryId: document.getElementById("eventCategory").value,
    start: document.getElementById("eventStartTime").value,
    end: document.getElementById("eventEndTime").value,
    location: document.getElementById("eventLocation").value.trim(),
    description: document.getElementById("eventDescription").value.trim(),
    status: document.getElementById("eventStatus").value,
  };
  if (!data.title || !data.date || !data.categoryId || !data.start || !data.end) {
    errorBox.textContent = "กรุณากรอกหัวข้อ วันที่ ประเภท และเวลาให้ครบ";
    errorBox.hidden = false;
    return;
  }
  if (data.end <= data.start) {
    errorBox.textContent = "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม";
    errorBox.hidden = false;
    return;
  }
  const saveButton = document.getElementById("saveEventBtn");
  saveButton.disabled = true;
  try {
    const eventRef = doc(collection(db, EVENTS_COLLECTION));
    const attachments = await uploadFiles(eventRef.id, data);
    await setDoc(eventRef, { ...data, attachments, createdBy: currentUser.uid, createdByEmail: currentUser.email || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    document.getElementById("eventForm").reset();
    selectedFiles = [];
    setDefaultDate();
    renderFiles();
    errorBox.hidden = true;
    closeModal("eventFormModal");
    showToast("บันทึกกิจกรรมเรียบร้อยแล้ว");
  } catch (error) {
    errorBox.textContent = `บันทึกไม่สำเร็จ: ${error.message}`;
    errorBox.hidden = false;
  } finally {
    saveButton.disabled = false;
  }
}

function addFiles(files) {
  for (const file of files) {
    if (selectedFiles.length >= MAX_FILES) return showToast("แนบได้สูงสุด 5 ไฟล์", "error");
    if (file.size > MAX_FILE_SIZE) { showToast(`${file.name} มีขนาดเกิน 10 MB`, "error"); continue; }
    if (!selectedFiles.some((item) => item.name === file.name && item.size === file.size)) selectedFiles.push(file);
  }
  renderFiles();
}

function renderFiles() {
  const list = document.getElementById("eventFileList");
  if (!list) return;
  list.innerHTML = selectedFiles.length ? selectedFiles.map((file, index) => `<div><i class="fa-regular fa-file"></i><span>${escapeHtml(file.name)}<small>${formatFileSize(file.size)}</small></span><button type="button" data-remove-file="${index}">×</button></div>`).join("") : "<p>ยังไม่ได้เลือกไฟล์</p>";
}

async function uploadFiles(eventId, data) {
  if (!selectedFiles.length) return [];
  const queue = [...selectedFiles];
  const attachments = [];
  async function worker() {
    while (queue.length) {
      const file = queue.shift();
      const encoded = await fileToPayload(file);
      const result = await callDriveApi({ action: "calendarUploadV1", eventId, topic: data.title, date: data.date, files: [encoded] });
      if (result.attachments?.[0]) attachments.push(result.attachments[0]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL_UPLOAD_LIMIT, queue.length) }, () => worker()));
  return attachments;
}

async function callDriveApi(payload) {
  const idToken = await currentUser.getIdToken(true);
  const response = await fetch(CALENDAR_DRIVE_API_URL, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ ...payload, idToken }) });
  const result = await response.json();
  if (!result.success) throw new Error(result.message || "จัดการ Google Drive ไม่สำเร็จ");
  return result;
}

function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, mimeType: file.type || "application/octet-stream", base64: String(reader.result).split(",")[1] || "" });
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

function requestDeleteEvent() {
  const item = events.find((event) => event.id === selectedEventId);
  if (!item) return;
  askConfirm("ลบกิจกรรม", `ต้องการลบกิจกรรม “${item.title}” พร้อมไฟล์แนบหรือไม่`, async () => {
    try {
      if (item.attachments?.length) await callDriveApi({ action: "calendarDeleteEventV1", eventId: item.id, driveFileIds: item.attachments.map((file) => file.driveFileId).filter(Boolean) });
      await deleteDoc(doc(db, EVENTS_COLLECTION, item.id));
      closeModal("eventDetailModal");
      showToast("ลบกิจกรรมเรียบร้อยแล้ว");
    } catch (error) {
      showToast(`ลบกิจกรรมไม่สำเร็จ: ${error.message}`, "error");
    }
  });
}

function requestDeleteCategory(id) {
  const category = categories.find((item) => item.id === id);
  if (!category) return;
  askConfirm("ลบหัวข้อ", `ต้องการลบหัวข้อ “${category.name}” หรือไม่`, async () => {
    try { await deleteDoc(doc(db, CATEGORIES_COLLECTION, id)); showToast("ลบหัวข้อเรียบร้อยแล้ว"); }
    catch (error) { showToast(`ลบหัวข้อไม่สำเร็จ: ${error.message}`, "error"); }
  });
}

function renderAll() { renderFilters(); renderCategorySelect(); renderCategoryManager(); renderCalendar(); renderUpcoming(); renderLegend(); }
function filteredEvents() { const queryText = keyword.trim().toLowerCase(); return events.filter((event) => { const category = getCategory(event.categoryId); const text = [event.title, event.location, event.description, category?.name].join(" ").toLowerCase(); return category && selectedCategories.has(event.categoryId) && (selectedStatus === "all" || event.status === selectedStatus) && (!queryText || text.includes(queryText)); }); }
function renderFilters() { const container = document.getElementById("categoryFilters"); if (!container) return; container.innerHTML = categories.map((category) => `<label class="filter-row"><input class="filter-check category-filter" type="checkbox" value="${category.id}" ${selectedCategories.has(category.id) ? "checked" : ""}><i class="filter-dot" style="background:${category.color}"></i><span class="flex-1 text-sm">${escapeHtml(category.name)}</span><span class="filter-count">${events.filter((event) => event.categoryId === category.id).length}</span></label>`).join(""); }
function renderCategorySelect() { const select = document.getElementById("eventCategory"); if (!select) return; const oldValue = select.value; select.innerHTML = categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join(""); if (categories.some((category) => category.id === oldValue)) select.value = oldValue; }
function renderCategoryManager() { const container = document.getElementById("categoryManageList"); if (!container) return; container.innerHTML = categories.map((category) => `<div class="category-manage-item"><i class="category-color" style="background:${category.color}"></i><div class="min-w-0 flex-1"><div class="category-name truncate">${escapeHtml(category.name)}</div><div class="category-meta">${events.filter((event) => event.categoryId === category.id).length} กิจกรรม</div></div><button type="button" class="delete-category-btn" data-delete-category="${category.id}"><i class="fa-regular fa-trash-can"></i></button></div>`).join(""); }
function renderLegend() { const container = document.getElementById("calendarLegend"); if (container) container.innerHTML = categories.map((category) => `<span class="legend-item"><i class="filter-dot" style="background:${category.color}"></i>${escapeHtml(category.name)}</span>`).join(""); }
function renderCalendar() { const year = currentDate.getFullYear(), month = currentDate.getMonth(); const title = document.getElementById("calendarMonthTitle"), grid = document.getElementById("calendarGrid"); if (!title || !grid) return; title.textContent = `${MONTHS_TH[month]} ${year + 543}`; let html = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map((day, index) => `<div class="weekday ${index === 0 || index === 6 ? "weekend" : ""}">${day}</div>`).join(""); const first = new Date(year, month, 1), start = new Date(year, month, 1 - first.getDay()), visible = filteredEvents(); for (let index = 0; index < 42; index += 1) { const date = new Date(start); date.setDate(start.getDate() + index); const key = toDateKey(date), outside = date.getMonth() !== month, weekend = date.getDay() === 0 ? "sunday" : date.getDay() === 6 ? "saturday" : ""; const items = outside ? [] : visible.filter((event) => event.date === key).sort((a, b) => a.start.localeCompare(b.start)); html += `<div class="calendar-day ${outside ? "outside" : ""} ${weekend} ${key === toDateKey(new Date()) ? "today" : ""}"><span class="day-number">${date.getDate()}</span>${items.map((event) => { const category = getCategory(event.categoryId); return `<button type="button" class="event-pill" data-event-id="${event.id}" style="color:${category.color};background:${category.color}18;border-color:${category.color}44">${escapeHtml(event.title)}<span class="event-time">${event.start} - ${event.end}</span></button>`; }).join("")}</div>`; } grid.innerHTML = html; }
function renderUpcoming() { const container = document.getElementById("upcomingList"); if (!container) return; const visible = filteredEvents().filter((event) => event.date >= toDateKey(new Date())).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 5); document.getElementById("resultCount").textContent = `พบ ${filteredEvents().length} รายการ`; container.innerHTML = visible.map((event) => { const category = getCategory(event.categoryId); return `<button type="button" class="upcoming-button" data-event-id="${event.id}"><span class="upcoming-icon" style="color:${category.color};background:${category.color}18"><i class="fa-solid ${category.icon || "fa-calendar"}"></i></span><span class="min-w-0"><strong class="block text-sm truncate">${escapeHtml(event.title)}</strong><span class="block text-xs text-slate-500 mt-1">${formatThaiDate(event.date)} ${event.start} - ${event.end}</span></span></button>`; }).join("") || `<div class="py-8 text-center text-sm text-slate-400">ไม่พบกิจกรรม</div>`; }
function openEventDetail(id) { const event = events.find((item) => item.id === id), category = event && getCategory(event.categoryId); if (!event || !category) return; selectedEventId = id; document.getElementById("detailTitle").textContent = event.title; document.getElementById("detailCategory").textContent = category.name; document.getElementById("detailDate").textContent = formatThaiDate(event.date); document.getElementById("detailTime").textContent = `${event.start} ถึง ${event.end} น.`; document.getElementById("detailLocation").textContent = event.location || "ไม่ระบุสถานที่"; document.getElementById("detailStatus").textContent = STATUS_LABELS[event.status] || event.status; document.getElementById("detailDescription").innerHTML = `<div>${escapeHtml(event.description || "ไม่มีรายละเอียดเพิ่มเติม")}</div>${(event.attachments || []).map((file) => `<div><a href="${escapeHtml(file.viewUrl)}" target="_blank" rel="noopener"><i class="fa-brands fa-google-drive"></i> ${escapeHtml(file.name)}</a></div>`).join("")}`; openModal("eventDetailModal"); }
function fillSample() { document.getElementById("eventTitle").value = "ประชุมเตรียมต้อนรับคณะดูงาน"; document.getElementById("eventDate").value = toDateKey(new Date()); document.getElementById("eventStartTime").value = "09:30"; document.getElementById("eventEndTime").value = "11:00"; document.getElementById("eventLocation").value = "ห้องประชุม 2 ชั้น 3"; document.getElementById("eventDescription").value = "เตรียมกำหนดการ ผู้รับผิดชอบ และเอกสารประกอบ"; refreshPickerLabels(); }
function requireLogin(action) { if (!currentUser) return showToast("กรุณาเข้าสู่ระบบก่อนจัดการข้อมูล", "error"); action(); }
function getCategory(id) { return categories.find((item) => item.id === id); }
function openModal(id) { const element = document.getElementById(id); if (element) { if (element.parentElement !== document.body) document.body.appendChild(element); element.hidden = false; document.body.style.overflow = "hidden"; } }
function closeModal(id) { const element = document.getElementById(id); if (element) { element.hidden = true; if (!document.querySelector("body > .modal:not([hidden])")) document.body.style.overflow = ""; } }
function askConfirm(title, message, action) { pendingConfirmAction = action; document.getElementById("confirmTitle").textContent = title; document.getElementById("confirmMessage").textContent = message; openModal("confirmModal"); }
function showToast(message, type = "success") { const container = document.getElementById("toastContainer"); if (!container) return; const toast = document.createElement("div"); toast.className = `toast ${type}`; toast.textContent = message; container.appendChild(toast); window.setTimeout(() => toast.remove(), 3200); }
function setFilterDrawer(open) { document.getElementById("filterDrawer").classList.toggle("open", open); document.getElementById("mobileFilterBackdrop").classList.toggle("open", open); }
function toDateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function parseDateKey(key) { const [year, month, day] = key.split("-").map(Number); return new Date(year, month - 1, day); }
function formatThaiDate(key) { const date = parseDateKey(key); return `${date.getDate()} ${MONTHS_TH[date.getMonth()]} ${date.getFullYear() + 543}`; }
function formatFileSize(bytes) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
