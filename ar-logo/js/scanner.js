"use strict";
document.addEventListener("DOMContentLoaded",()=>{
 const $=s=>document.querySelector(s), agencies=window.AR_AGENCIES||[];
 const scene=$("#arScene"),target=$("#singleTarget"),startScreen=$("#startScreen"),agencyList=$("#agencyList"),startButton=$("#startButton"),scannerUi=$("#scannerUi"),statusText=$("#statusText"),scanBox=$("#scanBox"),activeAgencyName=$("#activeAgencyName"),modal=$("#resultModal"),agencyTitle=$("#agencyTitle"),agencyDescription=$("#agencyDescription"),errorPanel=$("#errorPanel"),errorText=$("#errorText");
 let arSystem=null,selectedIndex=-1,starting=false,modalOpen=false,foundTimer=null,lastOpenedAt=0;
 const FOUND_DELAY=450,REOPEN_COOLDOWN=1400;
 const setStatus=t=>statusText.textContent=t;
 function renderAgencies(){agencyList.innerHTML="";agencies.forEach((a,i)=>{const b=document.createElement("button");b.type="button";b.className="agency-item";b.dataset.index=i;b.innerHTML=`<img src="${a.logo||''}" alt="" onerror="this.style.display='none'"><span>${a.title||`หน่วยงานที่ ${i+1}`}</span>`;b.addEventListener("click",()=>selectAgency(i));agencyList.appendChild(b)})}
 function selectAgency(i){selectedIndex=i;document.querySelectorAll(".agency-item").forEach((el,n)=>el.classList.toggle("selected",n===i));startButton.disabled=false;startButton.textContent=`เปิดกล้องสแกน ${agencies[i].title}`}
 const showError=t=>{starting=false;startButton.disabled=false;errorText.textContent=t;errorPanel.classList.remove("hidden")};
 scene.addEventListener("loaded",()=>{arSystem=scene.systems["mindar-image-system"]});
 scene.addEventListener("arReady",()=>setStatus("พร้อมแล้ว กรุณาส่องกล้องไปที่โลโก้"));
 scene.addEventListener("arError",()=>showError("โหลดไฟล์ .mind หรือเปิดกล้องไม่สำเร็จ กรุณาตรวจสอบชื่อไฟล์และสิทธิ์กล้อง"));
 async function waitSystem(){if(arSystem)return arSystem;for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,100));arSystem=scene.systems["mindar-image-system"];if(arSystem)return arSystem}throw new Error("MindAR not ready")}
 async function startScanner(){if(starting||selectedIndex<0)return;starting=true;errorPanel.classList.add("hidden");startButton.disabled=true;startButton.textContent="กำลังเปิดกล้อง...";const data=agencies[selectedIndex];try{const system=await waitSystem();scene.setAttribute("mindar-image",`imageTargetSrc: ${data.mindFile}; autoStart: false; maxTrack: 1; filterMinCF: 0.001; filterBeta: 0.01; warmupTolerance: 4; missTolerance: 8; uiLoading: no; uiScanning: no; uiError: no;`);await new Promise(r=>setTimeout(r,120));arSystem=scene.systems["mindar-image-system"];await arSystem.start();startScreen.classList.add("hidden");scannerUi.classList.remove("hidden");activeAgencyName.textContent=data.title;setStatus("พร้อมแล้ว กรุณาส่องกล้องไปที่โลโก้");starting=false}catch(e){console.error(e);showError(`เปิด ${data.mindFile} ไม่สำเร็จ กรุณาตรวจสอบว่าไฟล์อยู่ตรงตำแหน่ง`);startButton.textContent=`เปิดกล้องสแกน ${data.title}`}}
 async function changeAgency(){clearTimeout(foundTimer);modal.classList.add("hidden");modalOpen=false;try{if(arSystem)await arSystem.stop()}catch(e){console.warn(e)}scannerUi.classList.add("hidden");startScreen.classList.remove("hidden");startButton.disabled=selectedIndex<0;startButton.textContent=selectedIndex<0?"เลือกหน่วยงานก่อน":`เปิดกล้องสแกน ${agencies[selectedIndex].title}`}
 function showResult(){if(modalOpen||selectedIndex<0||Date.now()-lastOpenedAt<REOPEN_COOLDOWN)return;const a=agencies[selectedIndex];modalOpen=true;agencyTitle.textContent=a.title;agencyDescription.textContent=a.description||"แตะปุ่มด้านล่างเพื่อเปิดวิดีโอใน Google Drive";modal.classList.remove("hidden")}
 function closeResult(){clearTimeout(foundTimer);modal.classList.add("hidden");modalOpen=false;lastOpenedAt=Date.now();scanBox.classList.remove("detecting");setStatus("ยกกล้องออกจากโลโก้ แล้วส่องใหม่เพื่อเปิดอีกครั้ง")}
 function validDrive(url){try{const u=new URL(url);return u.protocol==="https:"&&u.hostname.includes("drive.google.com")}catch{return false}}
 function openDrive(){const a=agencies[selectedIndex];if(!a||!validDrive(a.driveUrl)){agencyDescription.textContent="ยังไม่ได้ใส่ลิงก์ Google Drive ที่ถูกต้องใน js/config.js";return}const w=window.open(a.driveUrl,"_blank","noopener,noreferrer");if(!w)location.href=a.driveUrl}
 target.addEventListener("targetFound",()=>{if(modalOpen)return;scanBox.classList.add("detecting");setStatus("พบโลโก้แล้ว กำลังยืนยัน...");clearTimeout(foundTimer);foundTimer=setTimeout(showResult,FOUND_DELAY)});
 target.addEventListener("targetLost",()=>{clearTimeout(foundTimer);scanBox.classList.remove("detecting");if(!modalOpen)setStatus("กำลังค้นหาโลโก้...")});
 startButton.addEventListener("click",startScanner);$("#changeAgencyButton").addEventListener("click",changeAgency);$("#closeTop").addEventListener("click",closeResult);$("#scanAgainButton").addEventListener("click",closeResult);$("#openDriveButton").addEventListener("click",openDrive);$("#retryButton").addEventListener("click",startScanner);
 renderAgencies();
});
