import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
console.log('meeting.js loaded: meeting-24h-summary-v12');
const ROOMS=[{id:'1',name:'ห้องประชุม 1'},{id:'2',name:'ห้องประชุม 2'}];
const EQUIPMENT=[['โปรเจกเตอร์','fa-video','blue'],['จอรับภาพ','fa-display','indigo'],['ไมโครโฟน','fa-microphone-lines','rose'],['ลำโพง','fa-volume-high','amber'],['กล้องประชุมออนไลน์','fa-camera','emerald'],['สาย HDMI / Adapter','fa-plug','cyan'],['อินเทอร์เน็ตสำหรับประชุม','fa-wifi','sky']];
let user=null,room=null,bookings=[],files=[],unsubscribe=null;const selected=new Set(),E={};
document.addEventListener('DOMContentLoaded',mount);
function mount(){const p=document.getElementById('pageContent'),t=document.getElementById('meetingTemplate');if(!p||!t)return setTimeout(mount,80);p.innerHTML='';p.append(t.content.cloneNode(true));['meetingStatus','roomGrid','bookingSteps','bookingDate','startTime','endTime','attendees','selectedTimeText','bookerName','bookerDept','bookerPhone','externalOrgField','externalOrgName','topic','detail','equipmentList','equipmentCount','meetingFiles','chooseFilesBtn','fileList','summaryContent','bookNowBtn','bookingCountBadge','bookingList','filterRoom','filterDate','filterSearch','exportCsvBtn'].forEach(id=>E[id]=document.getElementById(id));init24HourTimeSelects();bind();renderRooms();renderEquipment();onAuthStateChanged(auth,u=>{user=u;if(!u)return notify('กรุณาเข้าสู่ระบบ','error');E.bookerName.value=localStorage.getItem('user_name')||u.displayName||'';listen()})}
function init24HourTimeSelects(){const make=(select,label)=>{select.innerHTML=`<option value="">${label}</option>`;for(let h=0;h<24;h++){for(let m=0;m<60;m+=5){const value=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;select.insertAdjacentHTML('beforeend',`<option value="${value}">${value}</option>`)}}};make(E.startTime,'-- เลือกเวลาเริ่มต้น --');make(E.endTime,'-- เลือกเวลาสิ้นสุด --')}
function bind(){document.querySelectorAll('.meeting-tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));[E.bookingDate,E.startTime,E.endTime,E.attendees,E.bookerName,E.bookerPhone,E.externalOrgName,E.topic,E.detail].forEach(x=>x.oninput=update);E.bookerDept.onchange=()=>{E.externalOrgField.classList.toggle('hidden',E.bookerDept.value!=='หน่วยงานภายนอก');if(E.bookerDept.value!=='หน่วยงานภายนอก')E.externalOrgName.value='';update()};E.bookNowBtn.onclick=save;E.chooseFilesBtn.onclick=()=>E.meetingFiles.click();E.meetingFiles.onchange=e=>addFiles([...e.target.files]);[E.filterRoom,E.filterDate,E.filterSearch].forEach(x=>x.oninput=renderList);E.exportCsvBtn.onclick=exportCsv}
function listen(){if(unsubscribe)unsubscribe();unsubscribe=onSnapshot(collection(db,'meeting_bookings'),s=>{bookings=s.docs.map(d=>({id:d.id,...d.data()}));renderList();update()},e=>notify('โหลดรายการไม่สำเร็จ: '+e.message,'error'))}
function renderRooms(){E.roomGrid.innerHTML=ROOMS.map(r=>`<button class="room-card ${room?.id===r.id?'active':''}" data-id="${r.id}" type="button"><strong>${r.name}</strong><p>เลือกวัน เวลา และกรอกจำนวนผู้เข้าร่วม</p></button>`).join('');E.roomGrid.querySelectorAll('button').forEach(b=>b.onclick=()=>{room=ROOMS.find(r=>r.id===b.dataset.id);E.bookingSteps.classList.remove('disabled');E.attendees.removeAttribute('max');renderRooms();update()})}
function renderEquipment(){E.equipmentList.innerHTML=EQUIPMENT.map(([n,i,c])=>`<button type="button" class="equipment-card tone-${c} ${selected.has(n)?'selected':''}" data-name="${n}"><i class="fa-solid ${i}"></i><strong>${n}</strong><small>เลือกใช้งานสำหรับการประชุม</small></button>`).join('');E.equipmentCount.textContent=`เลือกแล้ว ${selected.size} รายการ`;E.equipmentList.querySelectorAll('button').forEach(b=>b.onclick=()=>{selected.has(b.dataset.name)?selected.delete(b.dataset.name):selected.add(b.dataset.name);renderEquipment();update()})}
function addFiles(items){items.forEach(f=>{if(files.length<5&&f.size<=10*1024*1024)files.push(f)});renderFiles();update()}
function renderFiles(){E.fileList.innerHTML=files.map((f,i)=>`<div class="file-item">${escapeHtml(f.name)} <button data-index="${i}" type="button">นำออก</button></div>`).join('');E.fileList.querySelectorAll('button').forEach(b=>b.onclick=()=>{files.splice(+b.dataset.index,1);renderFiles();update()})}
function getData(){return{date:E.bookingDate.value,start:E.startTime.value,end:E.endTime.value,attendees:+E.attendees.value||0,name:E.bookerName.value.trim(),dept:E.bookerDept.value,phone:E.bookerPhone.value.trim(),externalOrgName:E.bookerDept.value==='หน่วยงานภายนอก'?E.externalOrgName.value.trim():'',topic:E.topic.value.trim(),detail:E.detail.value.trim()}}
function validate(){const v=getData();if(!room)throw Error('กรุณาเลือกห้อง');if(!v.date||!v.start||!v.end)throw Error('กรุณาเลือกวันที่และเวลา');if(toMinutes(v.end)<=toMinutes(v.start))throw Error('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');if(v.attendees<1)throw Error('กรุณากรอกจำนวนผู้เข้าร่วม');if(!v.name||!v.dept||!v.phone||!v.topic)throw Error('กรุณากรอกข้อมูลที่มี * ให้ครบ');if(v.dept==='หน่วยงานภายนอก'&&!v.externalOrgName)throw Error('กรุณาระบุชื่อหน่วยงานภายนอก');if(bookings.some(b=>b.roomId===room.id&&b.date===v.date&&toMinutes(v.start)<toMinutes(b.endTime)&&toMinutes(v.end)>toMinutes(b.startTime)))throw Error('ช่วงเวลานี้ถูกจองแล้ว');return v}
function update(){
  const v=getData();
  if(v.start&&v.end){
    const ok=toMinutes(v.end)>toMinutes(v.start);
    const duration=ok?toMinutes(v.end)-toMinutes(v.start):0;
    const hours=Math.floor(duration/60),minutes=duration%60;
    E.selectedTimeText.className=`time-result ${ok?'success':'error'}`;
    E.selectedTimeText.innerHTML=ok
      ? `<i class="fa-solid fa-clock"></i><div><small>ช่วงเวลาแบบ 24 ชั่วโมง</small><strong>${v.start} – ${v.end}</strong><span>${hours?hours+' ชม. ':''}${minutes?minutes+' นาที':''}</span></div>`
      : '<i class="fa-solid fa-circle-exclamation"></i><strong>เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น</strong>';
  }else{
    E.selectedTimeText.className='time-result muted-result';
    E.selectedTimeText.innerHTML='<i class="fa-regular fa-clock"></i><div><small>ช่วงเวลาแบบ 24 ชั่วโมง</small><strong>รอเลือกเวลา</strong></div>';
  }
  const org=v.externalOrgName||v.dept||'-';
  const equip=[...selected];
  if(!room){
    E.summaryContent.className='booking-summary summary-empty-state';
    E.summaryContent.innerHTML='<div class="summary-placeholder-icon"><i class="fa-solid fa-clipboard-list"></i></div><div><strong>สรุปรายการจอง</strong><p>เลือกห้องและกรอกข้อมูล ระบบจะแสดงรายละเอียดแบบเรียลไทม์ที่นี่</p></div>';
    return;
  }
  E.summaryContent.className='booking-summary summary-dashboard';
  E.summaryContent.innerHTML=`
    <div class="summary-top">
      <div class="summary-room-icon"><i class="fa-solid fa-door-open"></i></div>
      <div class="summary-heading"><small>ห้องที่เลือก</small><strong>${escapeHtml(room.name)}</strong><span>${escapeHtml(v.topic||'ยังไม่ได้ระบุหัวข้อประชุม')}</span></div>
      <span class="summary-status"><i class="fa-solid fa-circle-check"></i> พร้อมตรวจสอบ</span>
    </div>
    <div class="summary-metrics">
      <div class="summary-metric blue-metric"><i class="fa-regular fa-calendar"></i><div><small>วันที่</small><strong>${escapeHtml(v.date||'-')}</strong></div></div>
      <div class="summary-metric violet-metric"><i class="fa-regular fa-clock"></i><div><small>เวลา 24 ชั่วโมง</small><strong>${escapeHtml(v.start||'--:--')} – ${escapeHtml(v.end||'--:--')}</strong></div></div>
      <div class="summary-metric emerald-metric"><i class="fa-solid fa-users"></i><div><small>ผู้เข้าร่วม</small><strong>${v.attendees||0} คน</strong></div></div>
      <div class="summary-metric amber-metric"><i class="fa-solid fa-building"></i><div><small>ส่วนงาน</small><strong>${escapeHtml(org)}</strong></div></div>
    </div>
    <div class="summary-detail-row"><span><i class="fa-solid fa-user"></i> ${escapeHtml(v.name||'ยังไม่ได้ระบุผู้จอง')}</span><span><i class="fa-solid fa-phone"></i> ${escapeHtml(v.phone||'-')}</span><span><i class="fa-solid fa-toolbox"></i> ${equip.length?equip.length+' รายการ':'ไม่เลือกอุปกรณ์'}</span><span><i class="fa-solid fa-paperclip"></i> ${files.length?files.length+' ไฟล์แบบร่าง':'ไม่มีไฟล์แนบ'}</span></div>`;
}

async function save(){try{if(!user)throw Error('กรุณาเข้าสู่ระบบ');const v=validate();E.bookNowBtn.disabled=true;await addDoc(collection(db,'meeting_bookings'),{roomId:room.id,roomName:room.name,roomCapacity:null,date:v.date,startTime:v.start,endTime:v.end,attendees:v.attendees,bookerName:v.name,bookerDept:v.dept,externalOrgName:v.externalOrgName,bookerPhone:v.phone,topic:v.topic,detail:v.detail,equipment:[...selected],attachments:[],attachmentDrafts:files.map(f=>({name:f.name,size:f.size,type:f.type,status:'draft_not_uploaded'})),attachmentMode:'draft_only',status:'confirmed',createdBy:user.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});notify('จองห้องประชุมเรียบร้อยแล้ว','success');reset();switchTab('list')}catch(e){notify('จองไม่สำเร็จ: '+e.message,'error')}finally{E.bookNowBtn.disabled=false}}
function renderList(){const q=E.filterSearch.value.toLowerCase(),list=bookings.filter(b=>(!E.filterRoom.value||b.roomId===E.filterRoom.value)&&(!E.filterDate.value||b.date===E.filterDate.value)&&(!q||[b.topic,b.bookerName,b.bookerDept,b.externalOrgName].some(x=>String(x||'').toLowerCase().includes(q))));E.bookingCountBadge.textContent=bookings.length;E.bookingList.innerHTML=list.length?list.map(b=>`<div class="booking-item"><b>${escapeHtml(b.topic)}</b><div>${escapeHtml(b.roomName)} · ${b.date} · ${b.startTime}-${b.endTime} · ${b.attendees} คน</div><div>${escapeHtml(b.bookerName)} · ${escapeHtml(b.externalOrgName||b.bookerDept)}</div><button type="button" data-delete="${b.id}">ลบ</button></div>`).join(''):'ยังไม่มีรายการ';E.bookingList.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(confirm('ลบรายการนี้?'))await deleteDoc(doc(db,'meeting_bookings',b.dataset.delete))})}
function switchTab(name){document.querySelectorAll('.meeting-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));document.querySelectorAll('.meeting-panel').forEach(p=>p.classList.toggle('active',p.id===`tab-${name}`))}
function reset(){room=null;selected.clear();files=[];['bookingDate','startTime','endTime','attendees','bookerName','bookerDept','bookerPhone','externalOrgName','topic','detail'].forEach(id=>E[id].value='');E.externalOrgField.classList.add('hidden');E.bookingSteps.classList.add('disabled');renderRooms();renderEquipment();renderFiles();update()}
function exportCsv(){const rows=[['ห้อง','วันที่','เริ่ม','สิ้นสุด','จำนวน','หัวข้อ'],...bookings.map(b=>[b.roomName,b.date,b.startTime,b.endTime,b.attendees,b.topic])],blob=new Blob(['\ufeff'+rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='meeting.csv';a.click()}
function notify(text,type){E.meetingStatus.textContent=text;E.meetingStatus.className=`meeting-alert ${type}`;setTimeout(()=>E.meetingStatus.classList.add('hidden'),4500)}function toMinutes(t){const[h,m]=String(t||'0:0').split(':').map(Number);return h*60+m}function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
