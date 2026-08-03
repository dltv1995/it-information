"use strict";
(() => {
  const $ = (selector) => document.querySelector(selector);
  const config = window.AR_CONFIG;
  const targets = window.AR_TARGETS || [];
  const mindUrl = `${config.mindFile}?revision=${encodeURIComponent(config.mindRevision)}`;

  const scene = document.createElement("a-scene");
  const camera = document.createElement("a-camera");
  const elements = new Map();

  scene.id = "arScene";
  scene.setAttribute("embedded", "");
  scene.setAttribute("mindar-image", [
    `imageTargetSrc: ${mindUrl}`,
    "autoStart: false",
    `maxTrack: ${targets.length}`,
    "filterMinCF: 0.001",
    "filterBeta: 1000",
    "warmupTolerance: 2",
    "missTolerance: 8",
    "uiLoading: no",
    "uiScanning: no",
    "uiError: no"
  ].join("; ") + ";");
  scene.setAttribute("renderer", "colorManagement: true; antialias: true; alpha: true;");
  scene.setAttribute("vr-mode-ui", "enabled: false");
  scene.setAttribute("device-orientation-permission-ui", "enabled: false");
  camera.setAttribute("position", "0 0 0");
  camera.setAttribute("look-controls", "enabled: false");
  scene.appendChild(camera);

  targets.forEach((item) => {
    const target = document.createElement("a-entity");
    target.setAttribute("mindar-image-target", `targetIndex: ${item.targetIndex}`);
    scene.appendChild(target);
    elements.set(item.targetIndex, target);
  });
  $("#sceneHost").appendChild(scene);

  let system = null;
  let starting = false;
  let redirecting = false;
  let active = null;
  let foundTimer = null;
  let redirectTimer = null;

  scene.addEventListener("loaded", () => {
    system = scene.systems["mindar-image-system"];
  });

  scene.addEventListener("arReady", () => {
    $("#statusText").textContent = "พร้อมแล้ว ส่องโลโก้ใดก็ได้";
  });

  async function verifyMind() {
    const response = await fetch(mindUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.arrayBuffer();
    if (data.byteLength < 100) throw new Error("ไฟล์ .mind ผิดปกติ");
    $("#mindStatus").textContent = `พร้อมใช้งาน (${data.byteLength.toLocaleString()} bytes)`;
    $("#mindStatus").classList.add("ok");
  }

  async function waitSystem() {
    if (system) return system;
    for (let i = 0; i < 60; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      system = scene.systems["mindar-image-system"];
      if (system) return system;
    }
    throw new Error("MindAR ยังไม่พร้อม");
  }

  async function startCamera() {
    if (starting || redirecting) return;
    starting = true;
    $("#errorPanel").classList.add("hidden");
    try {
      await (await waitSystem()).start();
      $("#startScreen").classList.add("hidden");
      $("#scannerUi").classList.remove("hidden");
      $("#statusText").textContent = "กำลังค้นหาโลโก้...";
      starting = false;
      window.dispatchEvent(new Event("resize"));
    } catch (error) {
      starting = false;
      console.warn("Auto start blocked", error);
      showFallback("เบราว์เซอร์ต้องการให้แตะก่อนเปิดกล้อง");
    }
  }

  function showFallback(message) {
    $("#startScreen").classList.remove("hidden");
    $("#startTitle").textContent = "แตะเพื่อเปิดกล้อง";
    $("#startMessage").textContent = message;
    $("#spinner").classList.add("hidden");
    $("#startButton").classList.remove("hidden");
  }

  function redirectTo(item) {
    if (redirecting || active !== item) return;
    try {
      const destination = new URL(item.linkUrl);
      if (destination.protocol !== "https:") throw new Error("ต้องเป็น HTTPS");
      redirecting = true;
      $("#statusText").textContent = `กำลังเปิด ${item.title}...`;
      redirectTimer = setTimeout(() => {
        window.location.assign(destination.href);
      }, config.redirectDelay);
    } catch (error) {
      console.error(error);
      active = null;
      $("#scanFrame").classList.remove("detecting");
      $("#statusText").textContent = `ลิงก์ของ ${item.title} ไม่ถูกต้อง`;
    }
  }

  targets.forEach((item) => {
    const element = elements.get(item.targetIndex);
    element.addEventListener("targetFound", () => {
      if (redirecting) return;
      active = item;
      $("#scanFrame").classList.add("detecting");
      $("#statusText").textContent = `พบ ${item.title} กำลังยืนยัน...`;
      clearTimeout(foundTimer);
      foundTimer = setTimeout(() => redirectTo(item), config.foundDelay);
    });
    element.addEventListener("targetLost", () => {
      if (redirecting || active !== item) return;
      clearTimeout(foundTimer);
      clearTimeout(redirectTimer);
      active = null;
      $("#scanFrame").classList.remove("detecting");
      $("#statusText").textContent = "กำลังค้นหาโลโก้...";
    });
  });

  $("#startButton").addEventListener("click", startCamera);
  $("#retryButton").addEventListener("click", startCamera);

  (async () => {
    try {
      await verifyMind();
      if (config.autoStartCamera) await startCamera();
      else showFallback("แตะเพื่อเปิดกล้อง");
    } catch (error) {
      console.error(error);
      $("#mindStatus").textContent = "ไม่พบ targets-all.mind";
      $("#mindStatus").classList.add("bad");
      $("#errorText").textContent = `ตรวจไฟล์ไม่สำเร็จ: ${config.mindFile}`;
      $("#errorPanel").classList.remove("hidden");
      showFallback("กรุณาตรวจสอบไฟล์ targets-all.mind");
    }
  })();
})();