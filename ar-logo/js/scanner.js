"use strict";
const agencyData = [
  {
    title: "วิดีโอแนะนำ: หน่วยงานที่ 1",
    driveUrl: "https://drive.google.com/file/d/1Kddr-ZIiviiKm2yCYJtZa7GFrcrlXjtF/view?usp=sharing"
  },
  {
    title: "วิดีโอแนะนำ: หน่วยงานที่ 2",
    driveUrl: "วางลิงก์ Google Drive คลิปที่ 2"
  },
  {
    title: "วิดีโอแนะนำ: หน่วยงานที่ 3",
    driveUrl: "วางลิงก์ Google Drive คลิปที่ 3"
  },
  {
    title: "วิดีโอแนะนำ: หน่วยงานที่ 4",
    driveUrl: "วางลิงก์ Google Drive คลิปที่ 4"
  },
  {
    title: "วิดีโอแนะนำ: หน่วยงานที่ 5",
    driveUrl: "วางลิงก์ Google Drive คลิปที่ 5"
  },
  {
    title: "วิดีโอแนะนำ: หน่วยงานที่ 6",
    driveUrl: "วางลิงก์ Google Drive คลิปที่ 6"
  }
];
document.addEventListener("DOMContentLoaded",()=>{
 const $=s=>document.querySelector(s),scene=$("#arScene"),startScreen=$("#startScreen"),startButton=$("#startButton"),overlay=$("#scannerOverlay"),status=$("#statusText"),modal=$("#videoModal"),player=$("#popupVideo"),title=$("#videoTitle"),message=$("#videoMessage"),sound=$("#soundButton"),errorPanel=$("#errorPanel"),errorText=$("#errorText");
 let arSystem=null,starting=false,modalOpen=false;const blocked=new Set();
 const setStatus=t=>status.textContent=t;
 const fail=t=>{starting=false;startButton.disabled=false;startButton.textContent="เปิดกล้อง";errorText.textContent=t;errorPanel.classList.remove("hidden")};
 scene.addEventListener("loaded",()=>{arSystem=scene.systems["mindar-image-system"]});
 scene.addEventListener("arReady",()=>setStatus("พร้อมแล้ว กรุณาส่องกล้องไปที่โลโก้"));
 scene.addEventListener("arError",()=>fail("เริ่มกล้องไม่สำเร็จ กรุณาตรวจสอบสิทธิ์กล้องและเปิดผ่าน HTTPS"));
 async function getSystem(){if(arSystem)return arSystem;for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,100));arSystem=scene.systems["mindar-image-system"];if(arSystem)return arSystem}throw new Error("MindAR system not ready")}
 async function start(){if(starting)return;starting=true;errorPanel.classList.add("hidden");startButton.disabled=true;startButton.textContent="กำลังเปิดกล้อง...";try{const system=await getSystem();await system.start();startScreen.classList.add("hidden");overlay.classList.remove("hidden");setStatus("พร้อมแล้ว กรุณาส่องกล้องไปที่โลโก้");starting=false}catch(e){console.error(e);fail("เปิดกล้องไม่สำเร็จ กรุณาอนุญาตสิทธิ์กล้อง ตรวจสอบ targets.mind และรีเฟรชหน้า")}}
 async function openVideo(i){
  if(modalOpen||blocked.has(i))return;
  const data=agencyData[i];
  modalOpen=true;
  blocked.add(i);
  title.textContent=data.title;
  message.textContent="กำลังโหลดวิดีโอ...";
  message.classList.remove("hidden");
  modal.classList.remove("hidden");
  player.muted=true;
  sound.textContent="เปิดเสียง";
  player.src=data.videoUrl;
  player.load();
  try{
   await player.play();
  }catch(e){
   console.warn("play() blocked or failed",e);
   if(!player.error){
    message.textContent="แตะปุ่มเล่นบนวิดีโอเพื่อเริ่มรับชม";
    message.classList.remove("hidden");
   }
  }
 }
 function closeVideo(){
  player.pause();
  player.currentTime=0;
  modal.classList.add("hidden");
  message.classList.add("hidden");
  modalOpen=false;
  setStatus("ยกกล้องออกจากโลโก้ แล้วส่องใหม่เพื่อเล่นอีกครั้ง");
 }
 agencyData.forEach((_,i)=>{
  const target=$(`#target-${i}`);
  target.addEventListener("targetFound",()=>{
   setStatus(`พบโลโก้หน่วยงานที่ ${i+1}`);
   openVideo(i);
  });
  target.addEventListener("targetLost",()=>{
   blocked.delete(i);
   if(!modalOpen)setStatus("กำลังค้นหาโลโก้...");
  });
 });
 player.addEventListener("loadstart",()=>{
  message.textContent="กำลังโหลดวิดีโอ...";
  message.classList.remove("hidden");
 });
 player.addEventListener("loadedmetadata",()=>message.classList.add("hidden"));
 player.addEventListener("canplay",()=>message.classList.add("hidden"));
 player.addEventListener("playing",()=>message.classList.add("hidden"));
 player.addEventListener("waiting",()=>{
  message.textContent="กำลังโหลดวิดีโอ...";
  message.classList.remove("hidden");
 });
 player.addEventListener("error",()=>{
  const code=player.error?.code||0;
  const details={1:"การเล่นถูกยกเลิก",2:"เกิดปัญหาเครือข่ายระหว่างโหลดวิดีโอ",3:"เบราว์เซอร์ถอดรหัสวิดีโอนี้ไม่ได้",4:"รูปแบบวิดีโอหรือ URL ไม่รองรับ"};
  message.textContent=details[code]||"เปิดวิดีโอไม่สำเร็จ";
  message.classList.remove("hidden");
  console.error("Video error",{code,currentSrc:player.currentSrc,error:player.error});
 });
 sound.addEventListener("click",async()=>{player.muted=!player.muted;sound.textContent=player.muted?"เปิดเสียง":"ปิดเสียง";try{await player.play()}catch(e){console.warn(e)}});
 startButton.addEventListener("click",start);$("#retryButton").addEventListener("click",start);$("#closeTop").addEventListener("click",closeVideo);$("#closeBottom").addEventListener("click",closeVideo);
});
