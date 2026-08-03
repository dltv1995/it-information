"use strict";

(() => {
  const $ = (selector) => document.querySelector(selector);
  const config = window.AR_CONFIG;
  const targets = Array.isArray(window.AR_TARGETS) ? window.AR_TARGETS : [];
  const mindUrl = `${config.mindFile}?revision=${encodeURIComponent(config.mindRevision)}`;

  const scene = document.createElement("a-scene");
  const camera = document.createElement("a-camera");
  const targetElements = new Map();

  scene.id = "arScene";
  scene.setAttribute("embedded", "");
  scene.setAttribute("mindar-image", [
    `imageTargetSrc: ${mindUrl}`,
    "autoStart: false",
    "maxTrack: 1",
    "filterMinCF: 0.001",
    "filterBeta: 1000",
    "warmupTolerance: 3",
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
    const element = document.createElement("a-entity");
    element.id = `target-${item.targetIndex}`;
    element.setAttribute("mindar-image-target", `targetIndex: ${item.targetIndex}`);
    scene.appendChild(element);
    targetElements.set(item.targetIndex, element);
  });

  $("#sceneHost").appendChild(scene);

  let system = null;
  let starting = false;
  let viewerOpen = false;
  let activeTarget = null;
  let foundTimer = null;

  scene.addEventListener("loaded", () => {
    system = scene.systems["mindar-image-system"];
  });

  scene.addEventListener("arReady", () => {
    $("#statusText").textContent = "พร้อมแล้ว ส่องโลโก้หน่วยงาน";
  });

  async function verifyMind() {
    const response = await fetch(mindUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.arrayBuffer();
    if (data.byteLength < 100) throw new Error("ไฟล์ .mind ผิดปกติ");
    $("#mindStatus").textContent = `พร้อมใช้งาน (${data.byteLength.toLocaleString()} bytes)`;
    $("#mindStatus").classList.add("ok");
  }

  async function waitForSystem() {
    if (system) return system;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      system = scene.systems["mindar-image-system"];
      if (system) return system;
    }
    throw new Error("MindAR ยังไม่พร้อม");
  }

  async function startCamera() {
    if (starting || viewerOpen) return;
    starting = true;
    try {
      await (await waitForSystem()).start();
      $("#startScreen").classList.add("hidden");
      $("#scannerUi").classList.remove("hidden");
      $("#statusText").textContent = "กำลังค้นหาโลโก้...";
      starting = false;
      window.dispatchEvent(new Event("resize"));
    } catch (error) {
      starting = false;
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

  function toEmbedUrl(rawUrl) {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") throw new Error("URL ต้องเป็น HTTPS");

    if (url.hostname === "drive.google.com") {
      const match = url.pathname.match(/\/file\/d\/([^/]+)/);
      if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
    }

    return url.href;
  }

  function openViewer(item) {
    if (viewerOpen || activeTarget !== item) return;

    try {
      const embedUrl = toEmbedUrl(item.linkUrl);
      viewerOpen = true;
      clearTimeout(foundTimer);

      $("#viewerTitle").textContent = item.title;
      $("#viewerFrame").src = embedUrl;
      $("#openExternal").href = item.linkUrl;
      $("#viewer").classList.remove("hidden");
      $("#scannerUi").classList.add("hidden");

      if (system) system.pause(true);
    } catch (error) {
      console.error(error);
      activeTarget = null;
      $("#scanFrame").classList.remove("detecting");
      $("#statusText").textContent = `ลิงก์ของ ${item.title} ไม่ถูกต้อง`;
    }
  }

  function closeViewer() {
    $("#viewerFrame").src = "about:blank";
    $("#viewer").classList.add("hidden");
    $("#scannerUi").classList.remove("hidden");
    $("#scanFrame").classList.remove("detecting");
    $("#statusText").textContent = "ยกกล้องออกจากโลโก้ แล้วส่องใหม่";

    viewerOpen = false;
    activeTarget = null;

    if (system) system.unpause();
  }

  targets.forEach((item) => {
    const element = targetElements.get(item.targetIndex);

    element.addEventListener("targetFound", () => {
      if (viewerOpen) return;
      activeTarget = item;
      $("#scanFrame").classList.add("detecting");
      $("#statusText").textContent = `พบ ${item.title} กำลังเปิด...`;
      clearTimeout(foundTimer);
      foundTimer = setTimeout(() => openViewer(item), config.foundDelay);
    });

    element.addEventListener("targetLost", () => {
      if (viewerOpen || activeTarget !== item) return;
      clearTimeout(foundTimer);
      activeTarget = null;
      $("#scanFrame").classList.remove("detecting");
      $("#statusText").textContent = "กำลังค้นหาโลโก้...";
    });
  });

  $("#closeViewer").addEventListener("click", closeViewer);
  $("#startButton").addEventListener("click", startCamera);
  $("#retryButton").addEventListener("click", startCamera);

  (async () => {
    try {
      await verifyMind();
      if (config.autoStartCamera) await startCamera();
      else showFallback("แตะเพื่อเปิดกล้อง");
    } catch (error) {
      $("#mindStatus").textContent = "ไม่พบ targets-all.mind";
      $("#mindStatus").classList.add("bad");
      $("#errorText").textContent = `ตรวจไฟล์ไม่สำเร็จ: ${config.mindFile}`;
      $("#errorPanel").classList.remove("hidden");
      showFallback("กรุณาตรวจสอบไฟล์ targets-all.mind");
    }
  })();
})();