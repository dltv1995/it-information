"use strict";
document.addEventListener("DOMContentLoaded",()=>{
 const $=s=>document.querySelector(s);
 const agencies=Array.isArray(window.AR_AGENCIES)?window.AR_AGENCIES:[];
 const scene=$("#arScene"),startScreen=$("#startScreen"),startButton=$("#startButton"),scannerUi=$("#scannerUi"),statusText=$("#statusText"),scanBox=$("#scanBox"),modal=$("#resultModal"),agencyTitle=$("#agencyTitle"),agencyDescription=$("#agencyDescription"),openDriveButton=$("#openDriveButton"),errorPanel=$("#errorPanel"),errorText=$("#errorText");
 let arSystem=null,starting=false,modalOpen=false,activeIndex=-1,foundTimer=null,lastOpenedAt=0;
 const FOUND_DELAY=450,REOPEN_COOLDOWN=1400;
 const setStatus=t=>statusText.textContent=t;
 const showError=t=>{starting=false;startButton.disabled=false;startButton.textContent="เปิดกล้อง";errorText.textContent=t;errorPanel.classList.remove("hidden")};
 scene.addEventListener("loaded",()=>{arSystem=scene.systems["mindar-image-system"]});
 scene.addEventListener("arReady",()=>setStatus("พร้อมแล้ว กรุณาส่องกล้องไปที่โลโก้"));
 scene.addEventListener("arError",()=>showError("เริ่มกล้องไม่สำเร็จ กรุณาตรวจสอบสิทธิ์กล้องและไฟล์ targets.mind"));
 async function waitForSystem(){if(arSystem)return arSystem;for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,100));arSystem=scene.systems["mindar-image-system"];if(arSystem)return arSystem}throw new Error("MindAR not ready")}
 async function startScanner(){if(starting)return;starting=true;errorPanel.classList.add("hidden");startButton.disabled=true;startButton.textContent="กำลังเปิดกล้อง...";try{const system=await waitForSystem();await system.start();startScreen.classList.add("hidden");scannerUi.classList.remove("hidden");setStatus("พร้อมแล้ว กรุณาส่องกล้องไปที่โลโก้");starting=false}catch(e){console.error(e);showError("เปิดกล้องไม่สำเร็จ กรุณาอนุญาตกล้อง เปิดผ่าน HTTPS และตรวจสอบ targets.mind")}}
 function validUrl(url){try{const u=new URL(url);return u.protocol==="https:"&&u.hostname.includes("drive.google.com")}catch{return false}}
 function showResult(index){if(modalOpen||Date.now()-lastOpenedAt<REOPEN_COOLDOWN)return;const data=agencies[index];if(!data)return;activeIndex=index;modalOpen=true;agencyTitle.textContent=data.title||`หน่วยงานที่ ${index+1}`;agencyDescription.textContent=data.description||"แตะปุ่มด้านล่างเพื่อเปิดวิดีโอใน Google Drive";modal.classList.remove("hidden");setStatus(`พบโลโก้ ${data.title||`หน่วยงานที่ ${index+1}`}`)}
 function closeResult(){clearTimeout(foundTimer);modal.classList.add("hidden");modalOpen=false;activeIndex=-1;lastOpenedAt=Date.now();scanBox.classList.remove("detecting");setStatus("ยกกล้องออกจากโลโก้ แล้วส่องใหม่เพื่อเปิดอีกครั้ง")}
 function openDrive(){const data=agencies[activeIndex];if(!data||!validUrl(data.driveUrl)){agencyDescription.textContent="ยังไม่ได้ใส่ลิงก์ Google Drive ที่ถูกต้องใน js/config.js";return}const newTab=window.open(data.driveUrl,"_blank","noopener,noreferrer");if(!newTab)window.location.href=data.driveUrl}
 agencies.forEach((_,index)=>{const target=$(`#target-${index}`);if(!target)return;target.addEventListener("targetFound",()=>{if(modalOpen)return;scanBox.classList.add("detecting");setStatus("พบโลโก้แล้ว กำลังยืนยัน...");clearTimeout(foundTimer);foundTimer=setTimeout(()=>showResult(index),FOUND_DELAY)});target.addEventListener("targetLost",()=>{clearTimeout(foundTimer);scanBox.classList.remove("detecting");if(!modalOpen)setStatus("กำลังค้นหาโลโก้...")})});
 startButton.addEventListener("click",startScanner);$("#retryButton").addEventListener("click",startScanner);$("#closeTop").addEventListener("click",closeResult);$("#scanAgainButton").addEventListener("click",closeResult);openDriveButton.addEventListener("click",openDrive);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden&&!modalOpen)setStatus("พร้อมแล้ว กรุณาส่องกล้องไปที่โลโก้")});
});
