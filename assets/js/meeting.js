// assets/js/meeting.js
// Version: meeting-firebase-attachments-v2
import { app, auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

console.log('meeting.js loaded: meeting-firebase-attachments-v2');

const storage = getStorage(app);
const COLLECTION = 'meeting_bookings';
const ROOMS = [
  { id: '1', name: 'ห้องประชุม 1', capacity: 40, icon: 'fa-users', detail: 'รองรับผู้เข้าประชุมได้สูงสุด 40 คน เหมาะกับการประชุมฝ่าย การประชุมคณะทำงาน และการอบรมขนาดกลาง' },
  { id: '2', name: 'ห้องประชุม 2', capacity: 10, icon: 'fa-user-group', detail: 'รองรับผู้เข้าประชุมได้สูงสุด 10 คน เหมาะกับการประชุมกลุ่มย่อย การนัดหมายภายใน และการประชุมออนไลน์' }
];
const EQUIPMENT = ['โปรเจกเตอร์','จอรับภาพ','ไมโครโฟน','ลำโพง','กล้องประชุมออนไลน์','สาย HDMI / Adapter','ไวท์บอร์ด','อินเทอร์เน็ตสำหรับประชุม'];
const TIME_START = 8, TIME_END = 18, SLOT_MINUTES = 30;

let currentUser = null, bookings = [], selectedRoom = null, selectedStart = null, selectedEnd = null;
let selectedEquipment = new Set(), selectedFiles = [], unsubscribeBookings = null, mounted = false, statsChart = null;
const els = {};

document.addEventListener('DOMContentLoaded', waitForHeaderAndMount);

function waitForHeaderAndMount() {
  const pageContent = document.getElementById('pageContent');
  const template = document.getElementById('meetingTemplate');
  if (pageContent && template && !mounted) {
    pageContent.innerHTML = '';
    pageContent.appendChild(template.content.cloneNode(true));
    mounted = true;
    initElements(); bindEvents(); renderRooms(); renderEquipment(); renderTimeSlots(); initAuth();
    return;
  }
  setTimeout(waitForHeaderAndMount, 80);
}

function initElements() {
  ['meetingStatus','roomGrid','bookingSteps','bookingDate','attendees','capacityHint','timeSlots','selectedTimeText','bookerName','bookerDept','bookerPhone','bookerEmail','topic','detail','equipmentList','summaryBox','summaryContent','submitBookingBtn','bookingList','bookingCountBadge','filterRoom','filterDate','filterSearch','clearAllBtn','exportCsvBtn','statsYear','meetingFiles','chooseFilesBtn','fileDropZone','fileList','statTotal','statRoom1','statRoom2','statToday','totalHours','room1Hours','room2Hours','averageHours','peakMonth','totalSessions','room1Sessions','room2Sessions'].forEach(id => els[id] = document.getElementById(id));
}

function bindEvents() {
  document.querySelectorAll('.meeting-tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  els.bookingDate?.addEventListener('change', () => { selectedStart = null; selectedEnd = null; renderTimeSlots(); updateSummary(); });
  els.attendees?.addEventListener('input', () => { validateCapacity(); updateSummary(); });
  [els.bookerName,els.bookerDept,els.bookerPhone,els.bookerEmail,els.topic,els.detail].forEach(el => ['input','change'].forEach(evt => el?.addEventListener(evt, updateSummary)));
  els.submitBookingBtn?.addEventListener('click', submitBooking);
  [els.filterRoom, els.filterDate, els.filterSearch].forEach(el => el?.addEventListener('input', renderBookingList));
  [els.filterRoom, els.filterDate].forEach(el => el?.addEventListener('change', renderBookingList));
  els.exportCsvBtn?.addEventListener('click', exportCsv);
  els.clearAllBtn?.addEventListener('click', clearAllBookings);
  els.statsYear?.addEventListener('change', renderStats);
  els.chooseFilesBtn?.addEventListener('click', () => els.meetingFiles?.click());
  els.meetingFiles?.addEventListener('change', e => addSelectedFiles(Array.from(e.target.files || [])));
  els.fileDropZone?.addEventListener('dragover', e => { e.preventDefault(); els.fileDropZone.classList.add('dragover'); });
  els.fileDropZone?.addEventListener('dragleave', () => els.fileDropZone.classList.remove('dragover'));
  els.fileDropZone?.addEventListener('drop', e => { e.preventDefault(); els.fileDropZone.classList.remove('dragover'); addSelectedFiles(Array.from(e.dataTransfer.files || [])); });
}

function initAuth() {
  onAuthStateChanged(auth, user => {
    if (!user) { showStatus('กรุณาเข้าสู่ระบบก่อนใช้งานระบบจองห้องประชุม', 'error'); return; }
    currentUser = user;
    if (els.bookerEmail && !els.bookerEmail.value) els.bookerEmail.value = user.email || '';
    if (els.bookerName && !els.bookerName.value) els.bookerName.value = localStorage.getItem('user_name') || user.displayName || '';
    listenBookings();
  });
}

function listenBookings() {
  if (typeof unsubscribeBookings === 'function') unsubscribeBookings();
  const q = query(collection(db, COLLECTION), orderBy('date', 'desc'));
  unsubscribeBookings = onSnapshot(q, snap => {
    bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTimeSlots(); renderBookingList(); renderStats(); updateSummary();
  }, err => showStatus(`โหลดรายการจองไม่สำเร็จ: ${err.code || err.message}`, 'error'));
}

function renderRooms() {
  els.roomGrid.innerHTML = ROOMS.map(room => `<article class="room-card ${selectedRoom?.id===room.id?'active':''}" data-room-id="${room.id}"><span class="room-badge"><i class="fa-solid ${room.icon}"></i> รองรับ ${room.capacity} คน</span><div class="room-title">${escapeHtml(room.name)}</div><div class="room-detail">${escapeHtml(room.detail)}</div><div class="room-capacity"><i class="fa-solid fa-users"></i> ความจุสูงสุด ${room.capacity} คน</div></article>`).join('');
  els.roomGrid.querySelectorAll('.room-card').forEach(card => card.addEventListener('click', () => { selectedRoom = ROOMS.find(r => r.id === card.dataset.roomId); selectedStart=null; selectedEnd=null; els.bookingSteps.classList.remove('disabled'); renderRooms(); renderTimeSlots(); validateCapacity(); updateSummary(); }));
}

function renderEquipment() {
  els.equipmentList.innerHTML = EQUIPMENT.map(item => `<label class="equipment-item ${selectedEquipment.has(item)?'selected':''}"><input type="checkbox" class="hidden" value="${escapeAttr(item)}" ${selectedEquipment.has(item)?'checked':''}/><i class="fa-solid fa-check-circle"></i><span>${escapeHtml(item)}</span></label>`).join('');
  els.equipmentList.querySelectorAll('.equipment-item').forEach(item => item.addEventListener('click', e => { e.preventDefault(); const value = item.querySelector('input')?.value; if (!value) return; selectedEquipment.has(value) ? selectedEquipment.delete(value) : selectedEquipment.add(value); renderEquipment(); updateSummary(); }));
}

function renderTimeSlots() {
  if (!els.timeSlots) return;
  const date = els.bookingDate?.value || '';
  const booked = selectedRoom && date ? bookings.filter(b => b.roomId === selectedRoom.id && b.date === date && b.status !== 'cancelled') : [];
  els.timeSlots.innerHTML = makeSlots().map(slot => {
    const end = addMinutes(slot, SLOT_MINUTES);
    const isBooked = booked.some(b => timeOverlaps(slot, end, b.startTime, b.endTime));
    const isSelected = selectedStart && selectedEnd && slot >= selectedStart && slot < selectedEnd;
    return `<button type="button" class="time-slot ${isBooked?'booked':''} ${isSelected?'selected':''}" data-time="${slot}" ${isBooked?'disabled':''}>${slot}</button>`;
  }).join('');
  els.timeSlots.querySelectorAll('.time-slot:not(.booked)').forEach(btn => btn.addEventListener('click', () => selectTime(btn.dataset.time)));
  if (selectedStart && selectedEnd) { els.selectedTimeText.textContent = `เลือกเวลา ${selectedStart} - ${selectedEnd}`; els.selectedTimeText.classList.remove('hidden'); } else els.selectedTimeText.classList.add('hidden');
}

function selectTime(time) {
  if (!selectedStart || selectedEnd) { selectedStart = time; selectedEnd = null; }
  else {
    selectedEnd = time <= selectedStart ? addMinutes(selectedStart, SLOT_MINUTES) : addMinutes(time, SLOT_MINUTES);
    if (rangeHasBookedSlot(selectedStart, selectedEnd)) { showStatus('ช่วงเวลาที่เลือกทับกับรายการจองเดิม กรุณาเลือกช่วงเวลาใหม่', 'error'); selectedStart = null; selectedEnd = null; }
  }
  renderTimeSlots(); updateSummary();
}

function rangeHasBookedSlot(start, end) {
  const date = els.bookingDate?.value || '';
  if (!selectedRoom || !date) return false;
  return bookings.some(b => b.roomId === selectedRoom.id && b.date === date && b.status !== 'cancelled' && timeOverlaps(start, end, b.startTime, b.endTime));
}

function validateCapacity() {
  const attendees = Number(els.attendees?.value || 0);
  if (!selectedRoom || !attendees) { els.capacityHint?.classList.add('hidden'); return true; }
  els.capacityHint.classList.remove('hidden');
  if (attendees > selectedRoom.capacity) { els.capacityHint.classList.add('error'); els.capacityHint.textContent = `จำนวนผู้เข้าร่วมเกินความจุของ${selectedRoom.name} ซึ่งรองรับสูงสุด ${selectedRoom.capacity} คน`; return false; }
  els.capacityHint.classList.remove('error'); els.capacityHint.textContent = `${selectedRoom.name} รองรับได้สูงสุด ${selectedRoom.capacity} คน`; return true;
}

function addSelectedFiles(files) {
  const allowed = ['pdf','doc','docx','xls','xlsx','ppt','pptx','jpg','jpeg','png'];
  files.forEach(file => { const ext = (file.name.split('.').pop() || '').toLowerCase(); if (allowed.includes(ext)) selectedFiles.push(file); else showStatus(`ไม่รองรับไฟล์ ${file.name}`, 'error'); });
  renderFileList(); updateSummary();
}

function renderFileList() {
  if (!selectedFiles.length) { els.fileList.classList.add('hidden'); els.fileList.innerHTML = ''; return; }
  els.fileList.classList.remove('hidden');
  els.fileList.innerHTML = selectedFiles.map((file, i) => `<div class="file-item"><div><div class="file-name"><i class="fa-solid fa-paperclip"></i> ${escapeHtml(file.name)}</div><div class="file-meta">${formatBytes(file.size)}</div></div><button type="button" class="file-remove" data-index="${i}"><i class="fa-solid fa-xmark"></i></button></div>`).join('');
  els.fileList.querySelectorAll('.file-remove').forEach(btn => btn.addEventListener('click', () => { selectedFiles.splice(Number(btn.dataset.index), 1); renderFileList(); updateSummary(); }));
}

function collectForm(throwError = true) {
  const data = { date: els.bookingDate?.value || '', attendees: Number(els.attendees?.value || 0), name: els.bookerName?.value.trim() || '', dept: els.bookerDept?.value || '', phone: els.bookerPhone?.value.trim() || '', email: els.bookerEmail?.value.trim() || '', topic: els.topic?.value.trim() || '', detail: els.detail?.value.trim() || '' };
  if (throwError) {
    if (!selectedRoom) throw new Error('กรุณาเลือกห้องประชุม'); if (!data.date) throw new Error('กรุณาเลือกวันที่'); if (!data.attendees) throw new Error('กรุณาระบุจำนวนผู้เข้าร่วม'); if (!validateCapacity()) throw new Error('จำนวนผู้เข้าร่วมเกินความจุห้อง'); if (!selectedStart || !selectedEnd) throw new Error('กรุณาเลือกช่วงเวลา'); if (!data.name) throw new Error('กรุณาระบุชื่อผู้จอง'); if (!data.dept) throw new Error('กรุณาเลือกแผนก/ฝ่าย'); if (!data.phone) throw new Error('กรุณาระบุเบอร์โทร'); if (!data.topic) throw new Error('กรุณาระบุหัวข้อประชุม');
  }
  return data;
}

function updateSummary() {
  const v = collectForm(false);
  if (!selectedRoom || !v.date || !selectedStart || !selectedEnd || !v.name || !v.dept || !v.phone || !v.topic) { els.summaryBox.classList.add('hidden'); return; }
  els.summaryBox.classList.remove('hidden');
  els.summaryContent.innerHTML = `<div><strong>ห้อง:</strong> ${escapeHtml(selectedRoom.name)} <span class="muted">รองรับ ${selectedRoom.capacity} คน</span></div><div><strong>วันที่:</strong> ${formatThaiDate(v.date)}</div><div><strong>เวลา:</strong> ${selectedStart} - ${selectedEnd}</div><div><strong>ผู้จอง:</strong> ${escapeHtml(v.name)} / ${escapeHtml(v.dept)}</div><div><strong>หัวข้อ:</strong> ${escapeHtml(v.topic)}</div><div><strong>อุปกรณ์:</strong> ${selectedEquipment.size ? Array.from(selectedEquipment).map(escapeHtml).join(', ') : '-'}</div><div><strong>เอกสารแนบ:</strong> ${selectedFiles.length ? `${selectedFiles.length} ไฟล์` : '-'}</div>`;
}

async function submitBooking() {
  try {
    if (!currentUser) throw new Error('กรุณาเข้าสู่ระบบก่อนจองห้องประชุม');
    const v = collectForm(true);
    if (rangeHasBookedSlot(selectedStart, selectedEnd)) throw new Error('ช่วงเวลาที่เลือกถูกจองแล้ว กรุณาเลือกช่วงเวลาใหม่');
    setSubmitting(true);
    const docRef = await addDoc(collection(db, COLLECTION), { roomId:selectedRoom.id, roomName:selectedRoom.name, roomCapacity:selectedRoom.capacity, date:v.date, startTime:selectedStart, endTime:selectedEnd, attendees:v.attendees, bookerName:v.name, bookerDept:v.dept, bookerPhone:v.phone, bookerEmail:v.email, topic:v.topic, detail:v.detail, equipment:Array.from(selectedEquipment), attachments:[], status:'confirmed', createdBy:currentUser.uid, createdByEmail:currentUser.email || '', createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
    const attachments = await uploadAttachments(docRef.id);
    if (attachments.length) await updateDoc(doc(db, COLLECTION, docRef.id), { attachments, updatedAt: serverTimestamp() });
    showStatus('บันทึกการจองห้องประชุมเรียบร้อยแล้ว', 'success'); resetForm(); switchTab('list');
  } catch(e) { console.error(e); showStatus(`บันทึกการจองไม่สำเร็จ: ${e.message || e}`, 'error'); }
  finally { setSubmitting(false); }
}

async function uploadAttachments(bookingId) {
  const out = [];
  for (const file of selectedFiles) {
    const path = `meeting_attachments/${currentUser.uid}/${bookingId}/${Date.now()}-${safeFileName(file.name)}`;
    const ref = storageRef(storage, path);
    const snap = await uploadBytes(ref, file, { contentType: file.type || 'application/octet-stream', customMetadata: { bookingId, uploadedBy: currentUser.uid }});
    out.push({ name:file.name, size:file.size, type:file.type || '', path, url: await getDownloadURL(snap.ref), uploadedAt:new Date().toISOString() });
  }
  return out;
}

function renderBookingList() {
  const list = getFilteredBookings();
  els.bookingCountBadge.textContent = bookings.length; els.bookingCountBadge.classList.toggle('hidden', !bookings.length);
  els.statTotal.textContent = bookings.length; els.statRoom1.textContent = bookings.filter(b=>b.roomId==='1').length; els.statRoom2.textContent = bookings.filter(b=>b.roomId==='2').length; els.statToday.textContent = bookings.filter(b=>b.date === new Date().toISOString().slice(0,10)).length;
  if (!list.length) { els.bookingList.innerHTML = '<div class="meeting-alert info">ยังไม่มีรายการจองตามเงื่อนไขที่เลือก</div>'; return; }
  els.bookingList.innerHTML = list.map(item => `<article class="booking-item"><div class="flex items-start justify-between gap-4 flex-wrap"><div><div class="booking-title">${escapeHtml(item.topic || '-')}</div><div class="booking-meta"><span><i class="fa-solid fa-door-open"></i> ${escapeHtml(item.roomName || `ห้อง ${item.roomId}`)}</span><span><i class="fa-solid fa-calendar"></i> ${formatThaiDate(item.date)}</span><span><i class="fa-solid fa-clock"></i> ${item.startTime} - ${item.endTime}</span><span><i class="fa-solid fa-users"></i> ${item.attendees || 0} คน</span></div><div class="booking-meta"><span><i class="fa-solid fa-user"></i> ${escapeHtml(item.bookerName || '-')}</span><span><i class="fa-solid fa-building"></i> ${escapeHtml(item.bookerDept || '-')}</span><span><i class="fa-solid fa-phone"></i> ${escapeHtml(item.bookerPhone || '-')}</span></div>${item.detail ? `<div class="booking-meta"><span>${escapeHtml(item.detail)}</span></div>` : ''}${renderAttachmentLinks(item.attachments)}</div><button class="btn-danger" type="button" onclick="window.cancelMeetingBooking('${item.id}')"><i class="fa-solid fa-trash"></i> ยกเลิก</button></div></article>`).join('');
}

function renderAttachmentLinks(files=[]) { return files.length ? `<div class="booking-files">${files.map(f => `<a class="booking-file-link" href="${escapeAttr(f.url)}" target="_blank" rel="noopener"><i class="fa-solid fa-paperclip"></i> ${escapeHtml(f.name || 'เอกสารแนบ')}</a>`).join('')}</div>` : ''; }

window.cancelMeetingBooking = async id => { if (!confirm('ต้องการยกเลิกรายการจองนี้ใช่หรือไม่')) return; try { const b = bookings.find(x=>x.id===id); await deleteDoc(doc(db, COLLECTION, id)); await deleteAttachments(b?.attachments || []); showStatus('ยกเลิกรายการจองเรียบร้อยแล้ว','success'); } catch(e) { showStatus(`ยกเลิกไม่สำเร็จ: ${e.code || e.message}`,'error'); } };
async function deleteAttachments(files) { for (const f of files) { if (!f.path) continue; try { await deleteObject(storageRef(storage, f.path)); } catch {} } }
async function clearAllBookings(){ if(!bookings.length || !confirm('ต้องการล้างรายการจองทั้งหมดใช่หรือไม่')) return; for(const b of bookings){ await deleteDoc(doc(db,COLLECTION,b.id)); await deleteAttachments(b.attachments || []); } }
function getFilteredBookings(){ const room=els.filterRoom?.value||'', date=els.filterDate?.value||'', search=(els.filterSearch?.value||'').toLowerCase().trim(); return [...bookings].filter(b=>!room||b.roomId===room).filter(b=>!date||b.date===date).filter(b=>!search||[b.topic,b.bookerName,b.bookerDept,b.roomName].some(v=>String(v||'').toLowerCase().includes(search))).sort((a,b)=>`${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`)); }

function renderStats(){ if(!els.statsYear) return; const years=new Set(bookings.map(b=>(b.date||'').slice(0,4)).filter(Boolean)); years.add(String(new Date().getFullYear())); const current=els.statsYear.value||String(new Date().getFullYear()); els.statsYear.innerHTML=Array.from(years).sort((a,b)=>b.localeCompare(a)).map(y=>`<option value="${y}">${Number(y)+543}</option>`).join(''); els.statsYear.value=years.has(current)?current:String(new Date().getFullYear()); const list=bookings.filter(b=>(b.date||'').startsWith(els.statsYear.value)); const room1=list.filter(b=>b.roomId==='1'), room2=list.filter(b=>b.roomId==='2'); const total=list.reduce((s,b)=>s+durationHours(b.startTime,b.endTime),0), h1=room1.reduce((s,b)=>s+durationHours(b.startTime,b.endTime),0), h2=room2.reduce((s,b)=>s+durationHours(b.startTime,b.endTime),0); els.totalHours.textContent=total.toFixed(1); els.room1Hours.textContent=h1.toFixed(1); els.room2Hours.textContent=h2.toFixed(1); els.averageHours.textContent=(total/12).toFixed(1); els.totalSessions.textContent=`${list.length} ครั้ง`; els.room1Sessions.textContent=`${room1.length} ครั้ง`; els.room2Sessions.textContent=`${room2.length} ครั้ง`; const monthly=Array.from({length:12},(_,i)=>({month:i+1,room1:0,room2:0})); list.forEach(b=>{const m=Number((b.date||'').slice(5,7)); if(monthly[m-1]) monthly[m-1][b.roomId==='1'?'room1':'room2']+=durationHours(b.startTime,b.endTime);}); const peak=monthly.reduce((best,row)=>(row.room1+row.room2)>(best.room1+best.room2)?row:best,monthly[0]); els.peakMonth.textContent=peak?`สูงสุดเดือน ${peak.month}`:'-'; renderStatsChart(monthly); }
function renderStatsChart(monthly){ const c=document.getElementById('statsChart'); if(!c||typeof Chart==='undefined') return; if(statsChart) statsChart.destroy(); statsChart=new Chart(c,{type:'bar',data:{labels:monthly.map(r=>`เดือน ${r.month}`),datasets:[{label:'ห้องประชุม 1',data:monthly.map(r=>r.room1),backgroundColor:'#0284c7'},{label:'ห้องประชุม 2',data:monthly.map(r=>r.room2),backgroundColor:'#10b981'}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}}); }
function switchTab(tab){ document.querySelectorAll('.meeting-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab)); document.querySelectorAll('.meeting-panel').forEach(p=>p.classList.toggle('active',p.id===`tab-${tab}`)); if(tab==='stats') renderStats(); }
function exportCsv(){ const rows=[['ห้อง','วันที่','เวลาเริ่ม','เวลาสิ้นสุด','หัวข้อ','ผู้จอง','แผนก','จำนวนผู้เข้าร่วม','เอกสารแนบ']]; bookings.forEach(b=>rows.push([b.roomName||b.roomId,b.date,b.startTime,b.endTime,b.topic,b.bookerName,b.bookerDept,b.attendees,(b.attachments||[]).map(f=>f.name).join('; ')])); const csv=rows.map(row=>row.map(cell=>`"${String(cell??'').replace(/"/g,'""')}"`).join(',')).join('\n'); const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`meeting-bookings-${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function resetForm(){ selectedRoom=null; selectedStart=null; selectedEnd=null; selectedEquipment.clear(); selectedFiles=[]; ['bookingDate','attendees','bookerName','bookerDept','bookerPhone','bookerEmail','topic','detail'].forEach(k=>{ if(els[k]) els[k].value='';}); if(els.meetingFiles) els.meetingFiles.value=''; els.bookingSteps.classList.add('disabled'); renderRooms(); renderEquipment(); renderFileList(); renderTimeSlots(); updateSummary(); }
function setSubmitting(v){ if(!els.submitBookingBtn) return; els.submitBookingBtn.disabled=v; els.submitBookingBtn.innerHTML=v?'<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...':'<i class="fa-solid fa-paper-plane"></i> ยืนยันการจอง'; }
function makeSlots(){ const a=[]; for(let h=TIME_START;h<TIME_END;h++){a.push(`${String(h).padStart(2,'0')}:00`);a.push(`${String(h).padStart(2,'0')}:30`)} return a; }
function addMinutes(time,minutes){const [h,m]=time.split(':').map(Number),t=h*60+m+minutes;return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`}
function toMinutes(time){const [h,m]=String(time||'00:00').split(':').map(Number);return h*60+m}
function timeOverlaps(a,b,c,d){return toMinutes(a)<toMinutes(d)&&toMinutes(b)>toMinutes(c)}
function durationHours(s,e){return Math.max(0,(toMinutes(e)-toMinutes(s))/60)}
function showStatus(msg,type='info'){ if(!els.status) return; els.status.textContent=msg; els.status.className=`meeting-alert ${type}`; els.status.classList.remove('hidden'); setTimeout(()=>els.status?.classList.add('hidden'),4200); }
function formatThaiDate(v){ if(!v) return '-'; return new Date(`${v}T00:00:00`).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'}); }
function formatBytes(bytes){ if(!bytes) return '0 B'; const u=['B','KB','MB','GB']; let v=bytes,i=0; while(v>=1024&&i<u.length-1){v/=1024;i++} return `${v.toFixed(i===0?0:1)} ${u[i]}`; }
function safeFileName(n){return String(n||'file').replace(/[^a-zA-Z0-9ก-๙_.-]/g,'_')}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function escapeAttr(v){return escapeHtml(v).replace(/`/g,'&#96;')}
