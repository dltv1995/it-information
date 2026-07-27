"use strict";
(()=>{
 const $=s=>document.querySelector(s), agencies=window.AR_AGENCIES||[];
 const index=Number(new URLSearchParams(location.search).get("agency")), data=agencies[index];
 if(!data){location.replace("./index.html");return}
 $("#selectedName").textContent=data.title; $("#activeAgency").textContent=data.title; $("#mindFileText").textContent=`ไฟล์ตรวจจับ: ${data.mindFile}`;
 const scene=document.createElement("a-scene"); scene.id="arScene"; scene.setAttribute("embedded","");
 scene.setAttribute("mindar-image",`imageTargetSrc: ${data.mindFile}; autoStart: false; maxTrack: 1; filterMinCF: 0.001; filterBeta: 1000; warmupTolerance: 2; missTolerance: 8; uiLoading: no; uiScanning: no; uiError: no;`);
 scene.setAttribute("renderer","colorManagement: true; physicallyCorrectLights: true; antialias: true; alpha: true;"); scene.setAttribute("vr-mode-ui","enabled: false"); scene.setAttribute("device-orientation-permission-ui","enabled: false"); scene.setAttribute("loading-screen","enabled: false");
 scene.innerHTML='<a-camera position="0 0 0" look-controls="enabled: false"></a-camera><a-entity id="imageTarget" mindar-image-target="targetIndex: 0"></a-entity>'; $("#sceneHost").appendChild(scene);
 const target=scene.querySelector("#imageTarget"), start=$("#startScreen"), scanner=$("#scannerUi"), status=$("#statusText"), frame=$("#scanFrame"), modal=$("#resultModal"), errorPanel=$("#errorPanel");
 let system=null, starting=false, locked=false, timer=null, cooldown=0;
 scene.addEventListener("loaded",()=>{system=scene.systems["mindar-image-system"]});
 scene.addEventListener("arReady",()=>{status.textContent="พร้อมแล้ว กรุณาส่องกล้องไปที่โลโก้"});
 scene.addEventListener("arError",()=>showError(`โหลด ${data.mindFile} หรือเปิดกล้องไม่สำเร็จ`));
 function showError(text){starting=false;$("#openCamera").disabled=false;$("#openCamera").textContent="เปิดกล้องเต็มหน้าจอ";$("#errorText").textContent=text;errorPanel.classList.remove("hidden")}
 async function waitForSystem(){if(system)return system;for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,100));system=scene.systems["mindar-image-system"];if(system)return system}throw new Error("MindAR not ready")}
 async function startCamera(){if(starting)return;starting=true;errorPanel.classList.add("hidden");$("#openCamera").disabled=true;$("#openCamera").textContent="กำลังเปิดกล้อง...";try{await (await waitForSystem()).start();start.classList.add("hidden");scanner.classList.remove("hidden");status.textContent=`กำลังสแกน ${data.title}`;starting=false;requestAnimationFrame(()=>window.dispatchEvent(new Event("resize")))}catch(e){console.error(e);showError(`เปิด ${data.mindFile} ไม่สำเร็จ กรุณาตรวจสอบชื่อไฟล์และสิทธิ์กล้อง`)}}
 function showResult(){if(locked||Date.now()<cooldown)return;locked=true;$("#resultTitle").textContent=data.title;$("#resultDescription").textContent=data.description||"แตะปุ่มด้านล่างเพื่อเปิดวิดีโอ";modal.classList.remove("hidden")}
 function closeResult(){clearTimeout(timer);modal.classList.add("hidden");locked=false;cooldown=Date.now()+1200;frame.classList.remove("detecting");status.textContent="ยกกล้องออกจากโลโก้ แล้วส่องใหม่"}
 function openDrive(){try{const u=new URL(data.driveUrl);if(u.protocol!=="https:")throw new Error();const w=window.open(u.href,"_blank","noopener,noreferrer");if(!w)location.href=u.href}catch{$("#resultDescription").textContent="กรุณาใส่ลิงก์ Google Drive ที่ถูกต้องใน js/config.js"}}
 target.addEventListener("targetFound",()=>{if(locked)return;frame.classList.add("detecting");status.textContent="พบโลโก้แล้ว กำลังยืนยัน...";clearTimeout(timer);timer=setTimeout(showResult,350)});
 target.addEventListener("targetLost",()=>{clearTimeout(timer);frame.classList.remove("detecting");if(!locked)status.textContent="กำลังค้นหาโลโก้..."});
 $("#openCamera").onclick=startCamera; $("#retry").onclick=startCamera; $("#closeResult").onclick=$("#scanAgain").onclick=closeResult; $("#openDrive").onclick=openDrive; $("#backStart").onclick=$("#changeAgency").onclick=()=>location.href="./index.html";
})();