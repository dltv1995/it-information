// assets/js/meeting.js
// Meeting room booking for GitHub Pages + Firebase Hosting
// Split from meeting.html into HTML / CSS / JS
// Version: meeting-split-v1

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log('meeting.js loaded: meeting-split-v1');

const BOOKINGS_COLLECTION = 'meeting_bookings';
const LOCAL_BOOKINGS_KEY = 'meetingBookingsLocal';
const LOCAL_VOTES_KEY = 'meetingSuggestionVotes';
const LOCAL_COMMENTS_KEY = 'meetingSuggestionComments';

const ROOMS = {
  1: {
    id: 1,
    name: 'ห้องประชุม 1',
    size: '8 x 16 เมตร (128 ตร.ม.)',
    icon: 'fa-users',
    iconType: 'large',
    equipment: [
      { id: 'r1s', name: 'เครื่องเสียง', detail: 'Surround', icon: 'fa-volume-up' },
      { id: 'r1m', name: 'ไมค์ประชุม', detail: 'ไมค์ไร้สาย', icon: 'fa-microphone' },
      { id: 'r1p', name: 'โปรเจ็คเตอร์', detail: 'จอภาพใหญ่', icon: 'fa-film' },
      { id: 'r1t', name: 'ทีวี 49 นิ้ว', detail: '1 เครื่อง', icon: 'fa-tv' },
      { id: 'r1v', name: 'ชุดประชุมทางไกล', detail: 'กล้อง+ไมค์+ลำโพง', icon: 'fa-video' },
      { id: 'r1w', name: 'ไวท์บอร์ด', detail: 'เขียนลบได้', icon: 'fa-chalkboard' }
    ]
  },
  2: {
    id: 2,
    name: 'ห้องประชุม 2',
    size: '8 x 4 เมตร (32 ตร.ม.)',
    icon: 'fa-user-friends',
    iconType: 'small',
    equipment: [
      { id: 'r2t', name: 'ทีวี 75 นิ้ว', detail: '1 เครื่อง', icon: 'fa-tv' },
      { id: 'r2v', name: 'ชุดประชุมทางไกล', detail: 'กล้อง+ไมค์+ลำโพง', icon: 'fa-video' },
      { id: 'r2h', name: 'สาย HDMI', detail: 'เชื่อมต่อจอภาพ', icon: 'fa-plug' },
      { id: 'r2w', name: 'ไวท์บอร์ด', detail: 'เขียนลบได้', icon: 'fa-chalkboard' }
    ]
  }
};

const SUGGESTIONS = [
  { id: 's1', title: 'ระบบแจ้งเตือนอัตโนมัติ', detail: 'ส่งอีเมล/Line เมื่อจองสำเร็จ ก่อนประชุม 30 นาที และเมื่อยกเลิก', icon: 'fa-bell', color: '#ef4444', priority: 'high', priorityText: 'สูง' },
  { id: 's2', title: 'ระบบอนุมัติการจอง', detail: 'ห้องใหญ่ต้องมีอนุมัติจากผู้บริหารก่อน มีสถานะ รอ/อนุมัติ/ปฏิเสธ', icon: 'fa-user-check', color: '#f59e0b', priority: 'high', priorityText: 'สูง' },
  { id: 's3', title: 'ปฏิทินภาพรวม', detail: 'แสดงตารางแบบปฏิทินรายสัปดาห์/เดือน มองเห็นช่วงว่าง-ไม่ว่าง', icon: 'fa-calendar-alt', color: '#0d9488', priority: 'high', priorityText: 'สูง' },
  { id: 's4', title: 'เช็คอิน QR Code', detail: 'สแกน QR เมื่อเข้า-ออกห้อง บันทึกเวลาจริง เช็คว่ามาประชุมตามจอง', icon: 'fa-qrcode', color: '#6366f1', priority: 'medium', priorityText: 'กลาง' },
  { id: 's5', title: 'จองซ้ำ (Recurring)', detail: 'จองเป็นรายสัปดาห์/เดือน เช่น ทุกวันจันทร์ 09:00-10:00', icon: 'fa-redo', color: '#a855f7', priority: 'medium', priorityText: 'กลาง' },
  { id: 's7', title: 'ล็อกช่วงเวลาพิเศษ', detail: 'ผู้ดูแลล็อกเวลาบำรุงรักษา หรือกิจกรรมพิเศษ', icon: 'fa-lock', color: '#ec4899', priority: 'low', priorityText: 'ต่ำ' },
  { id: 's8', title: 'แจ้งซ่อมอุปกรณ์', detail: 'ปุ่มรายงานอุปกรณ์เสีย ทำเครื่องหมายไม่ใช้งานได้ชั่วคราว', icon: 'fa-wrench', color: '#fb923c', priority: 'low', priorityText: 'ต่ำ' },
  { id: 's9', title: 'จัดการอาหาร/เครื่องดื่ม', detail: 'เลือกเซ็ตอาหารว่าง/กาแฟ ส่งคำขอไปฝ่ายสนับสนุน', icon: 'fa-coffee', color: '#d4a853', priority: 'low', priorityText: 'ต่ำ' }
];

const state = {
  roomId: null,
  timeStart: null,
  timeEnd: null,
  equipment: [],
  bookings: [],
  firebaseEnabled: false,
  currentUser: null,
  unsubscribeBookings: null,
  pendingConfirm: null
};

let initialized = false;

initMeetingPage();

async function initMeetingPage() {
  await loadSharedHeader();
  mountMeetingTemplate();
  bindHeaderUi();
  bindMeetingEvents();
  renderRooms();
  renderTimeSlots();
  renderSuggestions();
  populateStatsYears();
  setDefaultDates();
  initAuthAndBookings();
  document.getElementById('appBody')?.classList.remove('hidden');
}

async function loadSharedHeader() {
  const root = document.getElementById('layoutRoot');
  if (!root || document.getElementById('sidebar')) return;

  try {
    const response = await fetch('components/header.html', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    root.innerHTML = await response.text();
  } catch (error) {
    console.warn('Cannot load components/header.html, using fallback shell:', error);
    root.innerHTML = getFallbackHeaderHtml();
  }

  setPageHeaderText();
  ensureMeetingMenu();
}

function mountMeetingTemplate() {
  const pageContent = document.getElementById('pageContent');
  const template = document.getElementById('meetingTemplate');
  if (!pageContent || !template || document.querySelector('.meeting-page')) return;
  pageContent.appendChild(template.content.cloneNode(true));
}

function setPageHeaderText() {
  const title = document.body.dataset.title || 'ระบบจองห้องประชุม';
  const subtitle = document.body.dataset.subtitle || 'จองห้อง ตรวจสอบรายการ และดูสถิติการใช้งาน';
  const titleEl = document.getElementById('pageTitle');
  const subtitleEl = document.getElementById('pageSubtitle');
  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;
}

function ensureMeetingMenu() {
  const nav = document.getElementById('sidebarNav');
  if (!nav || nav.querySelector('[data-page="meeting"]')) return;
  const link = document.createElement('a');
  link.href = 'meeting.html';
  link.dataset.page = 'meeting';
  link.className = 'nav-item flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors';
  link.innerHTML = '<i class="ph ph-presentation-chart text-lg"></i><span>จองห้องประชุม</span>';
  nav.appendChild(link);
}

function bindHeaderUi() {
  const current = document.body.dataset.activeMenu || 'meeting';
  document.querySelectorAll('.nav-item').forEach(item => {
    const active = item.dataset.page === current;
    item.classList.toggle('active', active);
    item.classList.toggle('text-white', active);
    item.classList.toggle('bg-brand-600', active);
    item.classList.toggle('dark:bg-sky-600', active);
    item.classList.toggle('font-medium', active);
    item.classList.toggle('shadow-sm', active);
    if (active) item.classList.remove('text-slate-400', 'hover:text-white', 'hover:bg-slate-800');
  });

  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobileOverlay');
  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    sidebar?.classList.remove('-translate-x-full');
    overlay?.classList.remove('hidden');
    setTimeout(() => overlay?.classList.remove('opacity-0'), 10);
  });

  const closeSidebar = () => {
    sidebar?.classList.add('-translate-x-full');
    overlay?.classList.add('opacity-0');
    setTimeout(() => overlay?.classList.add('hidden'), 250);
  };
  document.getElementById('closeSidebarBtn')?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);

  document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('color-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    drawStatsChart();
  });
}

function bindMeetingEvents() {
  if (initialized) return;
  initialized = true;

  document.querySelectorAll('.meeting-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.getElementById('bookingDate')?.addEventListener('change', () => { resetTimeSelection(); renderTimeSlots(); updateSummary(); });
  document.getElementById('attendees')?.addEventListener('input', updateSummary);
  document.getElementById('bookerName')?.addEventListener('input', updateSummary);
  document.getElementById('bookerDept')?.addEventListener('change', updateSummary);
  document.getElementById('bookerPhone')?.addEventListener('input', updateSummary);
  document.getElementById('bookerEmail')?.addEventListener('input', updateSummary);
  document.getElementById('topic')?.addEventListener('input', updateSummary);
  document.getElementById('detail')?.addEventListener('input', updateSummary);
  document.getElementById('submitBookingBtn')?.addEventListener('click', confirmSubmitBooking);

  document.getElementById('filterRoom')?.addEventListener('change', renderBookingList);
  document.getElementById('filterDate')?.addEventListener('change', renderBookingList);
  document.getElementById('filterSearch')?.addEventListener('input', renderBookingList);
  document.getElementById('clearAllBtn')?.addEventListener('click', confirmClearAll);
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportCsv);
  document.getElementById('statsYear')?.addEventListener('change', renderStats);

  window.addEventListener('resize', () => {
    if (document.getElementById('tab-stats')?.classList.contains('active')) {
      setTimeout(drawStatsChart, 80);
    }
  });
}

function initAuthAndBookings() {
  const mockUserText = localStorage.getItem('mockUser');
  if (mockUserText) {
    try {
      state.currentUser = JSON.parse(mockUserText);
      setHeaderUser(state.currentUser, true);
    } catch {
      state.currentUser = null;
    }
    fallbackToLocalBookings('โหมดทดสอบ: ใช้ข้อมูลจองจากเครื่องนี้');
    return;
  }

  onAuthStateChanged(auth, user => {
    if (!user) {
      // ให้เปิดแบบ static preview ได้ แต่แจ้งว่าใช้ localStorage
      fallbackToLocalBookings('ยังไม่ได้เข้าสู่ระบบ Firebase จึงใช้ข้อมูลจองแบบ Local');
      setHeaderUser({ name: 'ผู้ใช้งานทั่วไป', role: 'staff' }, false);
      return;
    }

    state.currentUser = { uid: user.uid, email: user.email, name: user.displayName || user.email, role: 'staff' };
    setHeaderUser(state.currentUser, false);
    listenFirebaseBookings();
  });
}

function setHeaderUser(user, isMock) {
  const userName = document.getElementById('userName');
  const userRole = document.getElementById('userRole');
  const logoutBtn = document.getElementById('logoutBtn');
  if (userName) userName.textContent = user?.name || user?.email || 'ผู้ใช้งานระบบ';
  if (userRole) userRole.textContent = roleText(user?.role || 'staff');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      if (isMock) localStorage.removeItem('mockUser');
      window.location.href = 'login.html';
    };
  }
}

function listenFirebaseBookings() {
  if (typeof state.unsubscribeBookings === 'function') state.unsubscribeBookings();
  try {
    const bookingsRef = query(collection(db, BOOKINGS_COLLECTION), orderBy('date', 'asc'));
    state.unsubscribeBookings = onSnapshot(bookingsRef, snapshot => {
      state.firebaseEnabled = true;
      state.bookings = snapshot.docs.map(docSnap => normalizeBooking(docSnap.id, docSnap.data(), true));
      renderAll();
      showStatus('เชื่อมต่อ Firebase แล้ว', 'success', true);
    }, error => {
      console.error('Meeting bookings listener error:', error);
      fallbackToLocalBookings(`อ่านข้อมูล Firebase ไม่สำเร็จ: ${error.code || error.message || error}`);
    });
  } catch (error) {
    console.error('Meeting firebase init error:', error);
    fallbackToLocalBookings('ไม่สามารถเริ่ม Firebase booking ได้ ใช้ข้อมูล Local แทน');
  }
}

function fallbackToLocalBookings(message) {
  state.firebaseEnabled = false;
  state.bookings = readLocalBookings();
  renderAll();
  showStatus(message, 'info');
}

function renderAll() {
  renderTimeSlots();
  renderBookingList();
  updateBookingBadge();
  renderStats();
}

function switchTab(tabName) {
  document.querySelectorAll('.meeting-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
  document.querySelectorAll('.meeting-panel').forEach(panel => panel.classList.remove('active'));
  document.getElementById(`tab-${tabName}`)?.classList.add('active');
  if (tabName === 'list') renderBookingList();
  if (tabName === 'stats') renderStats();
}

function renderRooms() {
  const grid = document.getElementById('roomGrid');
  if (!grid) return;
  grid.innerHTML = Object.values(ROOMS).map(room => `
    <article class="room-card" data-room-id="${room.id}">
      <div class="room-head">
        <div class="room-icon"><i class="fa-solid ${room.icon}"></i></div>
        <div>
          <div class="room-name">${escapeHtml(room.name)}</div>
          <div class="room-size">${escapeHtml(room.size)}</div>
        </div>
      </div>
      <div class="equipment-tags">
        ${room.equipment.map(item => `<span class="equipment-tag"><i class="fa-solid ${item.icon}"></i>${escapeHtml(item.name)}</span>`).join('')}
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('.room-card').forEach(card => {
    card.addEventListener('click', () => selectRoom(Number(card.dataset.roomId)));
  });
}

function selectRoom(roomId) {
  state.roomId = roomId;
  state.timeStart = null;
  state.timeEnd = null;
  state.equipment = [];
  document.querySelectorAll('.room-card').forEach(card => card.classList.toggle('selected', Number(card.dataset.roomId) === roomId));
  document.getElementById('bookingSteps')?.classList.remove('disabled');
  renderEquipmentList();
  renderTimeSlots();
  updateSummary();
}

function setDefaultDates() {
  const today = new Date().toISOString().split('T')[0];
  const bookingDate = document.getElementById('bookingDate');
  const filterDate = document.getElementById('filterDate');
  if (bookingDate) { bookingDate.min = today; bookingDate.value = today; }
  if (filterDate) filterDate.min = today;
}

function getTimeSlots() {
  const slots = [];
  for (let hour = 8; hour <= 20; hour += 1) {
    slots.push(hour * 60);
    if (hour < 20) slots.push(hour * 60 + 30);
  }
  return slots;
}

function renderTimeSlots() {
  const container = document.getElementById('timeSlots');
  if (!container) return;
  const date = document.getElementById('bookingDate')?.value;
  container.innerHTML = getTimeSlots().map(minutes => {
    const disabled = date && isBooked(date, minutes);
    let cls = 'time-slot';
    if (disabled) cls += ' disabled';
    if (state.timeStart !== null && state.timeEnd !== null) {
      if (minutes === state.timeStart || minutes === state.timeEnd) cls += ' selected';
      else if (minutes > state.timeStart && minutes < state.timeEnd) cls += ' range';
    } else if (state.timeStart !== null && minutes === state.timeStart) {
      cls += ' selected';
    }
    return `<button type="button" class="${cls}" data-time="${minutes}" ${disabled ? 'disabled' : ''}>${formatTime(minutes)}</button>`;
  }).join('');

  container.querySelectorAll('.time-slot:not(.disabled)').forEach(slot => {
    slot.addEventListener('click', () => handleTimeClick(Number(slot.dataset.time)));
  });

  updateSelectedTimeText();
}

function handleTimeClick(minutes) {
  const date = document.getElementById('bookingDate')?.value;
  if (!state.roomId) return toast('กรุณาเลือกห้องประชุมก่อน', 'error');
  if (!date) return toast('กรุณาเลือกวันที่ก่อน', 'error');
  if (isBooked(date, minutes)) return toast('ช่วงเวลานี้ถูกจองแล้ว', 'error');

  if (state.timeStart === null) {
    state.timeStart = minutes;
    state.timeEnd = null;
  } else if (state.timeEnd === null) {
    if (minutes <= state.timeStart) {
      state.timeStart = minutes;
      state.timeEnd = null;
    } else {
      const blocked = getTimeSlots().some(slot => slot >= state.timeStart && slot < minutes && isBooked(date, slot));
      if (blocked) {
        toast('มีช่วงที่จองแล้วในช่วงที่เลือก', 'error');
        state.timeStart = minutes;
        state.timeEnd = null;
      } else {
        state.timeEnd = minutes;
      }
    }
  } else {
    state.timeStart = minutes;
    state.timeEnd = null;
  }

  renderTimeSlots();
  updateSummary();
}

function resetTimeSelection() {
  state.timeStart = null;
  state.timeEnd = null;
}

function updateSelectedTimeText() {
  const el = document.getElementById('selectedTimeText');
  if (!el) return;
  if (state.timeStart !== null && state.timeEnd !== null) {
    el.classList.remove('hidden');
    el.innerHTML = `<i class="fa-solid fa-clock"></i> ${formatTime(state.timeStart)} - ${formatTime(state.timeEnd)} (${formatDuration(state.timeEnd - state.timeStart)})`;
  } else {
    el.classList.add('hidden');
    el.textContent = '';
  }
}

function renderEquipmentList() {
  const container = document.getElementById('equipmentList');
  if (!container) return;
  if (!state.roomId) { container.innerHTML = ''; return; }
  const room = ROOMS[state.roomId];
  container.innerHTML = room.equipment.map(item => `
    <div class="equipment-item ${state.equipment.includes(item.id) ? 'checked' : ''}" data-equipment-id="${item.id}">
      <div class="equipment-check"><i class="fa-solid fa-check"></i></div>
      <div>
        <div class="equipment-name"><i class="fa-solid ${item.icon}"></i> ${escapeHtml(item.name)}</div>
        <div class="equipment-detail">${escapeHtml(item.detail)}</div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.equipment-item').forEach(item => {
    item.addEventListener('click', () => toggleEquipment(item.dataset.equipmentId));
  });
}

function toggleEquipment(id) {
  const index = state.equipment.indexOf(id);
  if (index >= 0) state.equipment.splice(index, 1);
  else state.equipment.push(id);
  renderEquipmentList();
  updateSummary();
}

function updateSummary() {
  const summaryBox = document.getElementById('summaryBox');
  const summaryContent = document.getElementById('summaryContent');
  if (!summaryBox || !summaryContent) return;

  const data = collectFormData(false);
  if (!data.valid) {
    summaryBox.classList.add('hidden');
    return;
  }

  const room = ROOMS[state.roomId];
  const dateText = new Date(`${data.date}T00:00:00`).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const equipmentTags = state.equipment.length
    ? `<div class="summary-tags">${state.equipment.map(id => {
        const item = room.equipment.find(e => e.id === id);
        return item ? `<span class="summary-tag">${escapeHtml(item.name)}</span>` : '';
      }).join('')}</div>`
    : '<span class="muted">ไม่ได้เลือก</span>';

  summaryContent.innerHTML = `
    ${summaryRow('ห้อง', room.name)}
    ${summaryRow('ขนาด', room.size)}
    ${summaryRow('วันที่', dateText)}
    ${summaryRow('เวลา', `${formatTime(state.timeStart)} - ${formatTime(state.timeEnd)} (${formatDuration(state.timeEnd - state.timeStart)})`)}
    ${summaryRow('ผู้เข้าร่วม', data.attendees || '-')}
    ${summaryRow('ผู้จอง', `${data.bookerName} (${data.bookerDept})`)}
    ${summaryRow('เบอร์โทร', data.bookerPhone)}
    ${summaryRow('หัวข้อ', data.topic)}
    ${summaryRow('อุปกรณ์', equipmentTags, true)}
  `;
  summaryBox.classList.remove('hidden');
}

function summaryRow(label, value, raw = false) {
  return `<div class="summary-row"><span>${escapeHtml(label)}</span><strong>${raw ? value : escapeHtml(value)}</strong></div>`;
}

function collectFormData(showError = true) {
  const data = {
    date: document.getElementById('bookingDate')?.value || '',
    attendees: document.getElementById('attendees')?.value || '',
    bookerName: document.getElementById('bookerName')?.value.trim() || '',
    bookerDept: document.getElementById('bookerDept')?.value || '',
    bookerPhone: document.getElementById('bookerPhone')?.value.trim() || '',
    bookerEmail: document.getElementById('bookerEmail')?.value.trim() || '',
    topic: document.getElementById('topic')?.value.trim() || '',
    detail: document.getElementById('detail')?.value.trim() || ''
  };
  const invalid = [];
  if (!state.roomId) invalid.push('เลือกห้องประชุม');
  if (!data.date) invalid.push('เลือกวันที่');
  if (state.timeStart === null || state.timeEnd === null) invalid.push('เลือกช่วงเวลาให้ครบ');
  if (!data.bookerName) invalid.push('กรอกชื่อ-นามสกุล');
  if (!data.bookerDept) invalid.push('เลือกแผนก/ฝ่าย');
  if (!data.bookerPhone) invalid.push('กรอกเบอร์โทร');
  if (!data.topic) invalid.push('กรอกหัวข้อประชุม');

  if (invalid.length && showError) toast(invalid[0], 'error');
  return { ...data, valid: invalid.length === 0 };
}

function confirmSubmitBooking() {
  const data = collectFormData(true);
  if (!data.valid) return;
  const room = ROOMS[state.roomId];
  const dateText = new Date(`${data.date}T00:00:00`).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  showConfirm({
    title: 'ยืนยันการจอง',
    message: `<strong>${escapeHtml(data.bookerName)}</strong> จอง <strong>${escapeHtml(room.name)}</strong><br>${escapeHtml(dateText)}<br>${formatTime(state.timeStart)} - ${formatTime(state.timeEnd)} (${formatDuration(state.timeEnd - state.timeStart)})<br>หัวข้อ: ${escapeHtml(data.topic)}`,
    onConfirm: () => submitBooking(data)
  });
}

async function submitBooking(data) {
  const booking = {
    roomId: state.roomId,
    roomName: ROOMS[state.roomId].name,
    date: data.date,
    timeStart: state.timeStart,
    timeEnd: state.timeEnd,
    attendees: Number(data.attendees || 0),
    bookerName: data.bookerName,
    bookerDept: data.bookerDept,
    bookerPhone: data.bookerPhone,
    bookerEmail: data.bookerEmail,
    topic: data.topic,
    detail: data.detail,
    equipment: [...state.equipment],
    userId: auth?.currentUser?.uid || state.currentUser?.uid || '',
    createdBy: auth?.currentUser?.uid || state.currentUser?.uid || '',
    createdAt: serverTimestamp()
  };

  try {
    if (state.firebaseEnabled && auth?.currentUser) {
      await addDoc(collection(db, BOOKINGS_COLLECTION), booking);
    } else {
      addLocalBooking({ ...booking, id: makeLocalId(), createdAt: new Date().toISOString() });
      fallbackToLocalBookings('บันทึกข้อมูลในเครื่องนี้แล้ว');
    }
    toast('จองห้องประชุมสำเร็จ', 'success');
    resetForm();
  } catch (error) {
    console.error('Submit meeting booking error:', error);
    toast(`บันทึก Firebase ไม่สำเร็จ: ${error.code || error.message || error}`, 'error');
  }
}

function resetForm() {
  state.roomId = null;
  state.timeStart = null;
  state.timeEnd = null;
  state.equipment = [];
  document.querySelectorAll('.room-card').forEach(card => card.classList.remove('selected'));
  document.getElementById('bookingSteps')?.classList.add('disabled');
  ['attendees','bookerName','bookerPhone','bookerEmail','topic','detail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const dept = document.getElementById('bookerDept');
  if (dept) dept.value = '';
  setDefaultDates();
  renderEquipmentList();
  renderTimeSlots();
  updateSummary();
}

function renderBookingList() {
  const list = document.getElementById('bookingList');
  if (!list) return;
  updateStatsCards();

  const filterRoom = document.getElementById('filterRoom')?.value || '';
  const filterDate = document.getElementById('filterDate')?.value || '';
  const filterSearch = (document.getElementById('filterSearch')?.value || '').trim().toLowerCase();

  let items = state.bookings.filter(booking => {
    if (filterRoom && String(booking.roomId) !== String(filterRoom)) return false;
    if (filterDate && booking.date !== filterDate) return false;
    if (filterSearch) {
      const haystack = `${booking.bookerName} ${booking.topic} ${booking.bookerDept}`.toLowerCase();
      if (!haystack.includes(filterSearch)) return false;
    }
    return true;
  });

  items.sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : Number(a.timeStart) - Number(b.timeStart));

  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-calendar-times"></i><p>${state.bookings.length ? 'ไม่พบรายการที่ตรงเงื่อนไข' : 'ยังไม่มีรายการจอง'}</p></div>`;
    return;
  }

  list.innerHTML = items.map(renderBookingItem).join('');
  list.querySelectorAll('[data-delete-booking]').forEach(button => {
    button.addEventListener('click', () => confirmDeleteBooking(button.dataset.deleteBooking));
  });
}

function renderBookingItem(booking) {
  const date = new Date(`${booking.date}T00:00:00`);
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const room = ROOMS[booking.roomId] || { equipment: [] };
  const equipment = (booking.equipment || [])
    .map(id => room.equipment.find(item => item.id === id)?.name)
    .filter(Boolean);

  return `
    <article class="booking-item">
      <div class="booking-date"><b>${date.getDate()}</b><span>${months[date.getMonth()]} ${date.getFullYear() + 543}</span></div>
      <div class="booking-info">
        <div class="booking-room">${escapeHtml(booking.roomName)}</div>
        <div class="booking-meta">
          <span><i class="fa-solid fa-clock"></i> ${formatTime(booking.timeStart)}-${formatTime(booking.timeEnd)} (${formatDuration(booking.timeEnd - booking.timeStart)})</span>
          <span><i class="fa-solid fa-user"></i> ${escapeHtml(booking.bookerName)}</span>
          <span><i class="fa-solid fa-building"></i> ${escapeHtml(booking.bookerDept)}</span>
          ${booking.attendees ? `<span><i class="fa-solid fa-users"></i> ${booking.attendees} คน</span>` : ''}
        </div>
        <div class="booking-topic"><i class="fa-solid fa-clipboard"></i>${escapeHtml(booking.topic)}</div>
        ${equipment.length ? `<div class="equipment-tags mt-2">${equipment.map(name => `<span class="summary-tag">${escapeHtml(name)}</span>`).join('')}</div>` : ''}
      </div>
      <button type="button" class="btn-danger" data-delete-booking="${escapeAttr(booking.id)}"><i class="fa-solid fa-trash-alt"></i> ยกเลิก</button>
    </article>
  `;
}

function confirmDeleteBooking(id) {
  showConfirm({
    title: 'ยืนยันยกเลิก',
    message: 'ยกเลิกการจองนี้? ไม่สามารถเรียกคืนได้',
    onConfirm: () => deleteBooking(id)
  });
}

async function deleteBooking(id) {
  try {
    if (state.firebaseEnabled) {
      await deleteDoc(doc(db, BOOKINGS_COLLECTION, id));
    } else {
      writeLocalBookings(state.bookings.filter(item => item.id !== id));
      fallbackToLocalBookings('อัปเดตข้อมูลในเครื่องนี้แล้ว');
    }
    toast('ยกเลิกสำเร็จ', 'info');
  } catch (error) {
    console.error('Delete booking error:', error);
    toast(`ยกเลิกไม่สำเร็จ: ${error.code || error.message || error}`, 'error');
  }
}

function confirmClearAll() {
  if (!state.bookings.length) return toast('ไม่มีรายการ', 'info');
  if (state.firebaseEnabled) return toast('โหมด Firebase ไม่อนุญาตล้างทั้งหมดจากหน้านี้', 'error');
  showConfirm({
    title: 'ล้างข้อมูล',
    message: `ลบรายการทั้งหมด ${state.bookings.length} รายการ?`,
    onConfirm: () => {
      writeLocalBookings([]);
      fallbackToLocalBookings('ล้างข้อมูลในเครื่องนี้แล้ว');
    }
  });
}

function updateStatsCards() {
  const today = new Date().toISOString().split('T')[0];
  setText('statTotal', state.bookings.length);
  setText('statRoom1', state.bookings.filter(item => Number(item.roomId) === 1).length);
  setText('statRoom2', state.bookings.filter(item => Number(item.roomId) === 2).length);
  setText('statToday', state.bookings.filter(item => item.date === today).length);
  updateBookingBadge();
}

function updateBookingBadge() {
  const badge = document.getElementById('bookingCountBadge');
  if (!badge) return;
  if (state.bookings.length) {
    badge.classList.remove('hidden');
    badge.textContent = state.bookings.length;
  } else {
    badge.classList.add('hidden');
  }
}

function populateStatsYears() {
  const select = document.getElementById('statsYear');
  if (!select) return;
  const year = new Date().getFullYear();
  select.innerHTML = '';
  for (let y = year + 1; y >= year - 3; y -= 1) {
    const option = document.createElement('option');
    option.value = String(y);
    option.textContent = String(y + 543);
    if (y === year) option.selected = true;
    select.appendChild(option);
  }
}

function renderStats() {
  const year = Number(document.getElementById('statsYear')?.value || new Date().getFullYear());
  const monthly = buildMonthlyStats(year);
  const room1Minutes = monthly.reduce((sum, item) => sum + item.room1, 0);
  const room2Minutes = monthly.reduce((sum, item) => sum + item.room2, 0);
  const room1Count = countBookingsByRoomAndYear(1, year);
  const room2Count = countBookingsByRoomAndYear(2, year);
  const totalHours = (room1Minutes + room2Minutes) / 60;
  const activeMonths = monthly.filter(item => item.total > 0).length;
  const peak = monthly.reduce((best, item) => item.total > best.total ? item : best, { label: '-', total: 0 });

  setText('totalHours', formatHours(room1Minutes + room2Minutes));
  setText('totalSessions', `${room1Count + room2Count} ครั้ง`);
  setText('room1Hours', formatHours(room1Minutes));
  setText('room1Sessions', `${room1Count} ครั้ง`);
  setText('room2Hours', formatHours(room2Minutes));
  setText('room2Sessions', `${room2Count} ครั้ง`);
  setText('averageHours', activeMonths ? (totalHours / activeMonths).toFixed(1) : '0');
  setText('peakMonth', peak.total ? `พีค: ${peak.label}` : '-');
  drawStatsChart();
}

function buildMonthlyStats(year) {
  const labels = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return labels.map((label, index) => {
    let room1 = 0;
    let room2 = 0;
    state.bookings.forEach(booking => {
      const date = new Date(`${booking.date}T00:00:00`);
      if (date.getFullYear() === year && date.getMonth() === index) {
        const duration = Number(booking.timeEnd) - Number(booking.timeStart);
        if (Number(booking.roomId) === 1) room1 += duration;
        else if (Number(booking.roomId) === 2) room2 += duration;
      }
    });
    return { label, room1, room2, total: room1 + room2 };
  });
}

function countBookingsByRoomAndYear(roomId, year) {
  return state.bookings.filter(booking => Number(booking.roomId) === Number(roomId) && new Date(`${booking.date}T00:00:00`).getFullYear() === year).length;
}

function drawStatsChart() {
  const canvas = document.getElementById('statsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(canvas.parentElement.clientWidth - 20, 320);
  const height = 300;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const year = Number(document.getElementById('statsYear')?.value || new Date().getFullYear());
  const data = buildMonthlyStats(year);
  const maxValue = Math.max(...data.map(item => Math.max(item.room1, item.room2, item.total) / 60), 1);
  const yMax = Math.ceil(maxValue * 1.2) || 5;
  const padding = { top: 18, right: 18, bottom: 44, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  for (let i = 0; i <= 5; i += 1) {
    const y = padding.top + chartHeight - (i / 5) * chartHeight;
    ctx.strokeStyle = document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.08)';
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Sarabun';
    ctx.textAlign = 'right';
    ctx.fillText(((yMax / 5) * i).toFixed(1), padding.left - 7, y + 3);
  }

  const groupWidth = chartWidth / 12;
  const barWidth = Math.min(groupWidth * .22, 18);
  data.forEach((item, index) => {
    const centerX = padding.left + groupWidth * index + groupWidth / 2;
    const room1Hours = item.room1 / 60;
    const room2Hours = item.room2 / 60;
    const h1 = (room1Hours / yMax) * chartHeight;
    const h2 = (room2Hours / yMax) * chartHeight;
    const x1 = centerX - barWidth - 3;
    const x2 = centerX + 3;
    if (h1 > 0) {
      ctx.fillStyle = '#14b8a6';
      roundRect(ctx, x1, padding.top + chartHeight - h1, barWidth, h1, 4);
    }
    if (h2 > 0) {
      ctx.fillStyle = '#d4a853';
      roundRect(ctx, x2, padding.top + chartHeight - h2, barWidth, h2, 4);
    }
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Sarabun';
    ctx.textAlign = 'center';
    ctx.fillText(item.label, centerX, padding.top + chartHeight + 20);
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function renderSuggestions() {
  const grid = document.getElementById('suggestionGrid');
  if (!grid) return;
  const votes = readJson(LOCAL_VOTES_KEY, {});
  const comments = readJson(LOCAL_COMMENTS_KEY, {});

  grid.innerHTML = SUGGESTIONS.map(item => {
    const voted = Boolean(votes[item.id]);
    const list = comments[item.id] || [];
    return `
      <article class="suggestion-card ${voted ? 'voted' : ''}" id="suggestion-${item.id}">
        <div class="suggestion-head">
          <div class="suggestion-icon" style="background:${item.color}22;color:${item.color}"><i class="fa-solid ${item.icon}"></i></div>
          <div>
            <h3 class="text-sm font-extrabold text-slate-900 dark:text-white">${escapeHtml(item.title)}</h3>
            <span class="priority-badge ${item.priority}">${escapeHtml(item.priorityText)}</span>
          </div>
        </div>
        <p class="muted mt-3">${escapeHtml(item.detail)}</p>
        <div class="toolbar-row between mt-4">
          <button type="button" class="btn-small" data-vote="${item.id}"><i class="fa-solid ${voted ? 'fa-check-circle' : 'fa-thumbs-up'}"></i>${voted ? 'โหวตแล้ว' : 'เห็นด้วย'}</button>
          <small class="muted"><i class="fa-solid fa-comment"></i> ${list.length} ความเห็น</small>
        </div>
        <button type="button" class="btn-small mt-3" data-toggle-comment="${item.id}"><i class="fa-solid fa-comment"></i> แสดงความคิดเห็น</button>
        <div class="comment-area">
          <div class="comment-list">${list.map(comment => `<div class="comment-item"><strong>${escapeHtml(comment.name)}:</strong> ${escapeHtml(comment.text)}</div>`).join('')}</div>
          <div class="comment-row">
            <input class="form-control" id="commentName-${item.id}" placeholder="ชื่อ" />
            <input class="form-control" id="commentText-${item.id}" placeholder="ความคิดเห็น..." />
            <button class="btn-primary" type="button" data-add-comment="${item.id}">ส่ง</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('[data-vote]').forEach(button => button.addEventListener('click', () => toggleVote(button.dataset.vote)));
  grid.querySelectorAll('[data-toggle-comment]').forEach(button => button.addEventListener('click', () => document.getElementById(`suggestion-${button.dataset.toggleComment}`)?.classList.toggle('show-comments')));
  grid.querySelectorAll('[data-add-comment]').forEach(button => button.addEventListener('click', () => addComment(button.dataset.addComment)));
}

function toggleVote(id) {
  const votes = readJson(LOCAL_VOTES_KEY, {});
  votes[id] = !votes[id];
  localStorage.setItem(LOCAL_VOTES_KEY, JSON.stringify(votes));
  renderSuggestions();
  if (votes[id]) toast('บันทึกการโหวตแล้ว ขอบคุณครับ', 'success');
}

function addComment(id) {
  const name = document.getElementById(`commentName-${id}`)?.value.trim();
  const text = document.getElementById(`commentText-${id}`)?.value.trim();
  if (!name || !text) return toast('กรอกชื่อและความคิดเห็นก่อน', 'error');
  const comments = readJson(LOCAL_COMMENTS_KEY, {});
  if (!comments[id]) comments[id] = [];
  comments[id].push({ name, text, createdAt: new Date().toISOString() });
  localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(comments));
  renderSuggestions();
  setTimeout(() => document.getElementById(`suggestion-${id}`)?.classList.add('show-comments'), 20);
}

function exportCsv() {
  if (!state.bookings.length) return toast('ไม่มีข้อมูลสำหรับส่งออก', 'info');
  let csv = '\uFEFFห้อง,วันที่,เวลาเริ่ม,เวลาสิ้นสุด,ระยะเวลา,ชั่วโมง,ผู้จอง,แผนก/ฝ่าย,เบอร์โทร,อีเมล,จำนวนเข้าร่วม,หัวข้อ,รายละเอียด,อุปกรณ์\n';
  state.bookings.forEach(booking => {
    const room = ROOMS[booking.roomId] || { equipment: [] };
    const date = new Date(`${booking.date}T00:00:00`);
    const dateText = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear() + 543}`;
    const duration = Number(booking.timeEnd) - Number(booking.timeStart);
    const equipment = (booking.equipment || [])
      .map(id => room.equipment.find(item => item.id === id)?.name)
      .filter(Boolean)
      .join('; ');
    csv += `"${booking.roomName}","${dateText}","${formatTime(booking.timeStart)}","${formatTime(booking.timeEnd)}","${formatDuration(duration)}","${formatHours(duration)}","${booking.bookerName}","${booking.bookerDept}","${booking.bookerPhone}","${booking.bookerEmail || ''}","${booking.attendees || ''}","${booking.topic}","${String(booking.detail || '').replace(/"/g, '""')}","${equipment}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `meeting_bookings_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast('ส่งออก CSV สำเร็จ', 'success');
}

function isBooked(date, minutes) {
  if (!state.roomId || !date) return false;
  return state.bookings.some(booking => Number(booking.roomId) === Number(state.roomId) && booking.date === date && minutes >= Number(booking.timeStart) && minutes < Number(booking.timeEnd));
}

function normalizeBooking(id, data, fromFirebase = false) {
  return {
    id,
    fromFirebase,
    roomId: Number(data.roomId),
    roomName: data.roomName || ROOMS[data.roomId]?.name || 'ไม่ระบุห้อง',
    date: data.date || '',
    timeStart: Number(data.timeStart || 0),
    timeEnd: Number(data.timeEnd || 0),
    attendees: Number(data.attendees || 0),
    bookerName: data.bookerName || data.userName || '',
    bookerDept: data.bookerDept || data.userDept || '',
    bookerPhone: data.bookerPhone || data.userPhone || '',
    bookerEmail: data.bookerEmail || data.userEmail || '',
    topic: data.topic || '',
    detail: data.detail || '',
    equipment: Array.isArray(data.equipment) ? data.equipment : []
  };
}

function readLocalBookings() {
  return readJson(LOCAL_BOOKINGS_KEY, []).map(item => normalizeBooking(item.id, item, false));
}

function writeLocalBookings(bookings) {
  localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(bookings));
}

function addLocalBooking(booking) {
  const current = readJson(LOCAL_BOOKINGS_KEY, []);
  current.push(booking);
  writeLocalBookings(current);
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

function showStatus(message, type = 'info', autoHide = false) {
  const el = document.getElementById('meetingStatus');
  if (!el) return;
  el.className = `meeting-alert ${type === 'success' ? 'success' : type === 'error' ? 'error' : ''}`;
  el.textContent = message;
  el.classList.remove('hidden');
  if (autoHide) setTimeout(() => el.classList.add('hidden'), 2500);
}

function toast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  container.appendChild(item);
  setTimeout(() => item.remove(), 3400);
}

function showConfirm({ title, message, onConfirm }) {
  closeConfirm();
  const modal = document.createElement('div');
  modal.className = 'meeting-modal';
  modal.id = 'meetingConfirmModal';
  modal.innerHTML = `
    <div class="meeting-modal-box">
      <h3 class="text-lg font-extrabold text-slate-900 dark:text-white">${escapeHtml(title)}</h3>
      <p class="muted mt-3">${message}</p>
      <div class="meeting-modal-actions">
        <button type="button" class="btn-ghost" id="meetingCancelConfirm">ยกเลิก</button>
        <button type="button" class="btn-primary" id="meetingOkConfirm">ยืนยัน</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('meetingCancelConfirm')?.addEventListener('click', closeConfirm);
  document.getElementById('meetingOkConfirm')?.addEventListener('click', async () => {
    closeConfirm();
    await onConfirm?.();
  });
  modal.addEventListener('click', event => { if (event.target === modal) closeConfirm(); });
}

function closeConfirm() {
  document.getElementById('meetingConfirmModal')?.remove();
}

function getFallbackHeaderHtml() {
  return `
    <main class="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 transition-theme">
      <header class="bg-white dark:bg-slate-800 h-20 flex items-center justify-between px-6 lg:px-8 z-30 sticky top-0 border-b border-slate-200 dark:border-slate-700 shadow-sm transition-theme">
        <div>
          <h2 id="pageTitle" class="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">ระบบจองห้องประชุม</h2>
          <p id="pageSubtitle" class="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">จองห้อง ตรวจสอบรายการ และดูสถิติการใช้งาน</p>
        </div>
        <button id="themeToggleBtn" class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">🌙</button>
      </header>
      <div class="flex-1 overflow-y-auto p-6 lg:p-8 z-10" id="pageContent"></div>
    </main>
  `;
}

function formatTime(minutes) {
  const h = Math.floor(Number(minutes) / 60);
  const m = Number(minutes) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDuration(minutes) {
  const h = Math.floor(Number(minutes) / 60);
  const m = Number(minutes) % 60;
  if (!h) return `${m} นาที`;
  if (!m) return `${h} ชม.`;
  return `${h} ชม. ${m} นาที`;
}

function formatHours(minutes) {
  const hours = Number(minutes || 0) / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function makeLocalId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function roleText(role) {
  return ({ admin: 'ผู้ดูแลระบบ', manager: 'หัวหน้างาน', secretary: 'เลขาฯ', staff: 'เจ้าหน้าที่', employee: 'เจ้าหน้าที่' })[role] || role || 'เจ้าหน้าที่';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
