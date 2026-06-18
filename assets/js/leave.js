// assets/js/leave.js
// Standalone like projects.js, no header include/template
// Version: leave-standalone-like-projects-v6
import { db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
console.log('leave.js loaded: leave-standalone-like-projects-v6');
const TYPES={annual:'ลาพักร้อน',sick:'ลาป่วย',personal:'ลากิจ'};
const ROLE_LABELS={admin:'ผู้ดูแลระบบ',manager:'หัวหน้าฝ่าย',secretary:'เลขาฯ',staff:'เจ้าหน้าที่',employee:'เจ้าหน้าที่'};
let currentUser=null,currentUserUid=null,isMockMode=false,canApprove=false;
const $=(id)=>document.getElementById(id);
const esc=(v)=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const setText=(id,v)=>{const el=$(id); if(el) el.textContent=v??'-';};
const quota=(u,t)=>u?.leaveQuota?.[t]??u?.leave_quota?.[t]??(t==='annual'?10:30);
document.addEventListener('DOMContentLoaded',()=>{ setupSharedUI(); initAuth(); });
function setupSharedUI(){
 const themeToggleBtn=$('themeToggleBtn');
 themeToggleBtn?.addEventListener('click',()=>{document.documentElement.classList.toggle('dark');localStorage.setItem('color-theme',document.documentElement.classList.contains('dark')?'dark':'light');});
 const mobileMenuBtn=$('mobileMenuBtn'),closeSidebarBtn=$('closeSidebarBtn'),sidebar=$('sidebar'),overlay=$('mobileOverlay');
 const toggleMenu=()=>{ if(!sidebar||!overlay)return; sidebar.classList.toggle('-translate-x-full'); overlay.classList.toggle('hidden'); setTimeout(()=>overlay.classList.toggle('opacity-0'),10); };
 mobileMenuBtn?.addEventListener('click',toggleMenu); closeSidebarBtn?.addEventListener('click',toggleMenu); overlay?.addEventListener('click',toggleMenu);
}
function initAuth(){
 const mock=localStorage.getItem('mockUser');
 if(mock){isMockMode=true; currentUser=JSON.parse(mock); currentUserUid='mock-uid'; initPage(); return;}
 onAuthStateChanged(auth,async(user)=>{
  if(!user){window.location.href='login.html';return;}
  currentUserUid=user.uid;
  try{ const snap=await getDoc(doc(db,'users',user.uid)); if(!snap.exists()){window.location.href='login.html';return;} currentUser={uid:user.uid,email:user.email,...snap.data()}; initPage(); }
  catch(e){console.error('Auth Error:',e); window.location.href='login.html';}
 });
}
async function initPage(){
 $('appBody')?.classList.remove('hidden'); setupUserHeader(); canApprove=await checkPermission(currentUser,currentUserUid,'approve_leave');
 if(canApprove){ $('tabApprovals')?.classList.remove('hidden'); await loadPendingApprovals(); }
 setText('quotaAnnual',quota(currentUser,'annual')); setText('quotaSick',quota(currentUser,'sick'));
 setupTabs(); setupLeaveModal(); await loadMyLeaves(currentUserUid);
}
function setupUserHeader(){
 setText('userName',currentUser?.name||currentUser?.email||'ผู้ใช้งานระบบ'); setText('userRole',ROLE_LABELS[currentUser?.role]||currentUser?.role||'เจ้าหน้าที่');
 if(String(currentUser?.role||'').toLowerCase()==='admin'||currentUser?.role==='ผู้ดูแลระบบ') $('adminMenu')?.classList.remove('hidden');
 const logoutBtn=$('logoutBtn'); if(logoutBtn) logoutBtn.onclick=()=>{ if(isMockMode){localStorage.removeItem('mockUser'); window.location.href='login.html';return;} signOut(auth).then(()=>window.location.href='login.html'); };
}
async function checkPermission(user,uid,action){
 if(isMockMode) return action==='approve_leave'?['admin','manager'].includes(user.role):true;
 try{const snap=await getDoc(doc(db,'user_overrides',uid)); const override=snap.exists()?snap.data()?.overrides?.[action]:null; if(override==='allow')return true; if(override==='deny')return false;}catch(e){console.warn('permission override error',e);}
 const roleDefaults={admin:['approve_leave','manage_users'],manager:['approve_leave'],secretary:[],staff:[],employee:[]}; return (roleDefaults[user?.role]||[]).includes(action);
}
function setupTabs(){
 const tabMy=$('tabMyLeaves'),tabAp=$('tabApprovals'),viewMy=$('viewMyLeaves'),viewAp=$('viewApprovals'); if(!tabMy||!tabAp||!viewMy||!viewAp)return;
 const active=['text-brand-600','dark:text-sky-400','border-brand-600','dark:border-sky-400','bg-brand-50','dark:bg-slate-800/50']; const inactive=['text-slate-500','dark:text-slate-400','border-transparent','hover:text-slate-800','dark:hover:text-white'];
 tabMy.onclick=()=>{viewMy.classList.remove('hidden');viewAp.classList.add('hidden');tabMy.classList.add(...active);tabMy.classList.remove(...inactive);tabAp.classList.add(...inactive);tabAp.classList.remove(...active);};
 tabAp.onclick=()=>{viewMy.classList.add('hidden');viewAp.classList.remove('hidden');tabAp.classList.add(...active);tabAp.classList.remove(...inactive);tabMy.classList.add(...inactive);tabMy.classList.remove(...active);};
}
function setupLeaveModal(){
 const modal=$('leaveModal'),content=$('leaveModalContent'),form=$('leaveForm'); if(!modal||!content||!form)return;
 const close=()=>{modal.classList.add('opacity-0');content.classList.add('scale-95');document.body.style.overflow='';setTimeout(()=>{modal.classList.add('hidden');},250);form.reset();$('leaveModalError')?.classList.add('hidden');};
 const open=()=>{modal.classList.remove('hidden');document.body.style.overflow='hidden';setTimeout(()=>{modal.classList.remove('opacity-0');content.classList.remove('scale-95');},10);};
 $('requestLeaveBtn')?.addEventListener('click',open); $('closeLeaveModalBtn')?.addEventListener('click',close); $('cancelLeaveModalBtn')?.addEventListener('click',close); modal.addEventListener('click',e=>{if(e.target===modal)close();});
 form.addEventListener('submit',async(e)=>{e.preventDefault();const err=$('leaveModalError'),btn=$('saveLeaveBtn'),sp=$('saveLeaveSpinner');err?.classList.add('hidden');if(btn)btn.disabled=true;sp?.classList.remove('hidden');try{const type=$('leaveType').value,start=$('leaveStart').value,end=$('leaveEnd').value,reason=$('leaveReason').value.trim();const sd=new Date(`${start}T00:00:00`),ed=new Date(`${end}T00:00:00`);if(!type||!start||!end||!reason)throw new Error('กรุณากรอกข้อมูลให้ครบถ้วน');if(ed<sd)throw new Error('วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น');const totalDays=Math.ceil(Math.abs(ed-sd)/86400000)+1;if(isMockMode){alert('Mock Mode: ส่งใบลาสำเร็จ');close();return;}await addDoc(collection(db,'leaves'),{userId:currentUserUid,userName:currentUser?.name||currentUser?.email||'Unknown',userEmail:currentUser?.email||'',type,startDate:Timestamp.fromDate(sd),endDate:Timestamp.fromDate(ed),totalDays,reason,status:'pending',createdAt:Timestamp.now()});close();loadMyLeaves(currentUserUid);}catch(error){console.error('Save Leave Error:',error);if(err){err.textContent=error.message||'เกิดข้อผิดพลาดในการบันทึกข้อมูล';err.classList.remove('hidden');}}finally{if(btn)btn.disabled=false;sp?.classList.add('hidden');}});
}
function statusBadge(s){return {pending:'<span class="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-medium border border-amber-200 dark:border-amber-800/50">รออนุมัติ</span>',approved:'<span class="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-800/50">อนุมัติแล้ว</span>',rejected:'<span class="inline-block px-3 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-medium border border-red-200 dark:border-red-800/50">ไม่อนุมัติ</span>'}[s]||esc(s);}
function dateRange(d){const s=d.startDate?.toDate?d.startDate.toDate().toLocaleDateString('th-TH'):'-';const e=d.endDate?.toDate?d.endDate.toDate().toLocaleDateString('th-TH'):'-';return s===e?s:`${s} - ${e}`;}
async function loadMyLeaves(uid){const tbody=$('myLeavesTableBody'); if(!tbody)return;if(isMockMode){tbody.innerHTML='<tr><td colspan="5" class="py-6 text-center text-slate-500">Mock Data Mode</td></tr>';return;}try{const snap=await getDocs(query(collection(db,'leaves'),where('userId','==',uid)));const leaves=[];snap.forEach(d=>leaves.push({id:d.id,...d.data()}));leaves.sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));if(!leaves.length){tbody.innerHTML='<tr><td colspan="5" class="py-6 text-center text-slate-500">ไม่มีประวัติการลา</td></tr>';return;}tbody.innerHTML=leaves.map(d=>`<tr class="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors"><td class="py-4 px-4 font-medium">${esc(TYPES[d.type]||d.type)}</td><td class="py-4 px-4 text-slate-500 dark:text-slate-400">${esc(dateRange(d))}</td><td class="py-4 px-4 text-center">${esc(d.totalDays)}</td><td class="py-4 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate" title="${esc(d.reason)}">${esc(d.reason)}</td><td class="py-4 px-4 text-center">${statusBadge(d.status)}</td></tr>`).join('');}catch(e){console.error('Error loading leaves:',e);tbody.innerHTML='<tr><td colspan="5" class="py-6 text-center text-red-500">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';}}
async function loadPendingApprovals(){const tbody=$('approvalsTableBody'),badge=$('pendingBadge'); if(!tbody||isMockMode)return;try{const snap=await getDocs(query(collection(db,'leaves'),where('status','==','pending')));const items=[];snap.forEach(d=>items.push({id:d.id,...d.data()}));items.sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));if(!items.length){tbody.innerHTML='<tr><td colspan="4" class="py-6 text-center text-slate-500">ไม่มีรายการรออนุมัติ</td></tr>';badge?.classList.add('hidden');return;}if(badge){badge.textContent=items.length;badge.classList.remove('hidden');}tbody.innerHTML=items.map(d=>`<tr class="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors"><td class="py-4 px-4 font-medium">${esc(d.userName||'Unknown')}</td><td class="py-4 px-4"><div class="font-medium text-slate-800 dark:text-white">${esc(TYPES[d.type]||d.type)} (${esc(d.totalDays)} วัน)</div><div class="text-xs text-slate-500 dark:text-slate-400">${esc(dateRange(d))}</div></td><td class="py-4 px-4 text-sm max-w-xs truncate" title="${esc(d.reason)}">${esc(d.reason)}</td><td class="py-4 px-4 text-right whitespace-nowrap"><button class="approve-btn bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 px-3 py-1.5 rounded-lg text-xs font-medium mr-2" data-id="${esc(d.id)}">อนุมัติ</button><button class="reject-btn bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 px-3 py-1.5 rounded-lg text-xs font-medium" data-id="${esc(d.id)}">ปฏิเสธ</button></td></tr>`).join('');tbody.querySelectorAll('.approve-btn').forEach(b=>b.onclick=()=>handleApproval(b.dataset.id,'approved'));tbody.querySelectorAll('.reject-btn').forEach(b=>b.onclick=()=>handleApproval(b.dataset.id,'rejected'));}catch(e){console.error('Error loading approvals:',e);tbody.innerHTML='<tr><td colspan="4" class="py-6 text-center text-red-500">เกิดข้อผิดพลาด</td></tr>';}}
async function handleApproval(id,status){if(!confirm(`ยืนยันการ${status==='approved'?'อนุมัติ':'ปฏิเสธ'}ใบลา?`))return;try{await updateDoc(doc(db,'leaves',id),{status,approverId:currentUserUid,updatedAt:Timestamp.now()});if(status==='approved')await deductQuota(id);loadPendingApprovals();}catch(e){console.error('Error updating status',e);alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ');}}
async function deductQuota(id){const leaveSnap=await getDoc(doc(db,'leaves',id));if(!leaveSnap.exists())return;const l=leaveSnap.data();const uRef=doc(db,'users',l.userId);const uSnap=await getDoc(uRef);if(!uSnap.exists())return;const u=uSnap.data();if(l.type==='annual'){const next=Math.max(Number(quota(u,'annual'))-Number(l.totalDays||0),0);await updateDoc(uRef,{'leaveQuota.annual':next,'leave_quota.annual':next});}if(l.type==='sick'){const next=Math.max(Number(quota(u,'sick'))-Number(l.totalDays||0),0);await updateDoc(uRef,{'leaveQuota.sick':next,'leave_quota.sick':next});}}
