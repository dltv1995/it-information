"use strict";

(() => {
  const $ = (selector) => document.querySelector(selector);
  const agencies = Array.isArray(window.AR_AGENCIES)
    ? window.AR_AGENCIES
    : [];

  const parameters = new URLSearchParams(window.location.search);
  const agencyIndex = Number(parameters.get("agency"));
  const agencyId = parameters.get("id");
  const data = agencies[agencyIndex];

  if (
    !Number.isInteger(agencyIndex) ||
    agencyIndex < 0 ||
    agencyIndex >= agencies.length ||
    !data ||
    data.id !== agencyId
  ) {
    window.location.replace("./index.html?v=12");
    return;
  }

  const revision = encodeURIComponent(data.revision ?? 1);
  const mindUrl = `${data.mindFile}?revision=${revision}`;

  const startScreen = $("#startScreen");
  const scannerUi = $("#scannerUi");
  const statusText = $("#statusText");
  const scanFrame = $("#scanFrame");
  const resultModal = $("#resultModal");
  const errorPanel = $("#errorPanel");
  const openCameraButton = $("#openCamera");

  let arSystem = null;
  let starting = false;
  let resultLocked = false;
  let foundTimer = null;
  let cooldownUntil = 0;

  $("#selectedName").textContent = data.title;
  $("#activeAgency").textContent = data.title;
  $("#agencyIndexText").textContent = `${agencyIndex + 1} / ${agencies.length}`;
  $("#mindFileText").textContent = data.mindFile;

  function createScene() {
    const scene = document.createElement("a-scene");
    const camera = document.createElement("a-camera");
    const target = document.createElement("a-entity");

    scene.id = "arScene";
    scene.setAttribute("embedded", "");
    scene.setAttribute(
      "mindar-image",
      [
        `imageTargetSrc: ${mindUrl}`,
        "autoStart: false",
        "maxTrack: 1",
        "filterMinCF: 0.001",
        "filterBeta: 1000",
        "warmupTolerance: 2",
        "missTolerance: 8",
        "uiLoading: no",
        "uiScanning: no",
        "uiError: no"
      ].join("; ") + ";"
    );
    scene.setAttribute(
      "renderer",
      "colorManagement: true; physicallyCorrectLights: true; antialias: true; alpha: true;"
    );
    scene.setAttribute("vr-mode-ui", "enabled: false");
    scene.setAttribute("device-orientation-permission-ui", "enabled: false");
    scene.setAttribute("loading-screen", "enabled: false");

    camera.setAttribute("position", "0 0 0");
    camera.setAttribute("look-controls", "enabled: false");

    target.id = "imageTarget";
    target.setAttribute(
      "mindar-image-target",
      `targetIndex: ${Number(data.targetIndex ?? 0)}`
    );

    scene.appendChild(camera);
    scene.appendChild(target);
    $("#sceneHost").appendChild(scene);

    return { scene, target };
  }

  async function verifyMindFile() {
    try {
      const response = await fetch(mindUrl, {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const content = await response.arrayBuffer();

      if (content.byteLength < 100) {
        throw new Error("ไฟล์มีขนาดเล็กผิดปกติ");
      }

      $("#mindCheckText").textContent = `พร้อมใช้งาน (${content.byteLength.toLocaleString()} bytes)`;
      $("#mindCheckText").classList.add("ok");
      openCameraButton.disabled = false;
      openCameraButton.textContent = "เปิดกล้องเต็มหน้าจอ";
    } catch (error) {
      console.error("Mind file check failed:", mindUrl, error);
      $("#mindCheckText").textContent = "ไม่พบหรืออ่านไฟล์ไม่ได้";
      $("#mindCheckText").classList.add("bad");
      showError(`ตรวจสอบไฟล์ไม่สำเร็จ: ${data.mindFile}`);
    }
  }

  const { scene, target } = createScene();

  scene.addEventListener("loaded", () => {
    arSystem = scene.systems["mindar-image-system"];
  });

  scene.addEventListener("arReady", () => {
    statusText.textContent = "พร้อมแล้ว กรุณาส่องกล้องไปที่โลโก้";
  });

  scene.addEventListener("arError", () => {
    showError(`MindAR เปิดไฟล์ไม่สำเร็จ: ${data.mindFile}`);
  });

  function showError(message) {
    starting = false;
    openCameraButton.disabled = false;
    openCameraButton.textContent = "ลองเปิดกล้องอีกครั้ง";
    $("#errorText").textContent = message;
    errorPanel.classList.remove("hidden");
  }

  async function waitForSystem() {
    if (arSystem) {
      return arSystem;
    }

    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      arSystem = scene.systems["mindar-image-system"];

      if (arSystem) {
        return arSystem;
      }
    }

    throw new Error("MindAR system not ready");
  }

  async function startCamera() {
    if (starting) {
      return;
    }

    starting = true;
    errorPanel.classList.add("hidden");
    openCameraButton.disabled = true;
    openCameraButton.textContent = "กำลังเปิดกล้อง...";

    try {
      await (await waitForSystem()).start();
      startScreen.classList.add("hidden");
      scannerUi.classList.remove("hidden");
      statusText.textContent = `กำลังสแกน ${data.title}`;
      starting = false;
      window.dispatchEvent(new Event("resize"));
    } catch (error) {
      console.error(error);
      showError(`เปิด ${data.mindFile} ไม่สำเร็จ`);
    }
  }

  function showResult() {
    if (resultLocked || Date.now() < cooldownUntil) {
      return;
    }

    resultLocked = true;
    $("#resultTitle").textContent = data.title;
    $("#resultDescription").textContent = data.description;
    resultModal.classList.remove("hidden");
  }

  function closeResult() {
    clearTimeout(foundTimer);
    resultModal.classList.add("hidden");
    resultLocked = false;
    cooldownUntil = Date.now() + 1200;
    scanFrame.classList.remove("detecting");
    statusText.textContent = "ยกกล้องออกจากโลโก้ แล้วส่องใหม่";
  }

  function openDrive() {
    try {
      const driveUrl = new URL(data.driveUrl);

      if (driveUrl.protocol !== "https:") {
        throw new Error("Invalid protocol");
      }

      const newTab = window.open(
        driveUrl.href,
        "_blank",
        "noopener,noreferrer"
      );

      if (!newTab) {
        window.location.href = driveUrl.href;
      }
    } catch (error) {
      $("#resultDescription").textContent =
        "กรุณาใส่ลิงก์ Google Drive ที่ถูกต้องใน js/config.js";
    }
  }

  target.addEventListener("targetFound", () => {
    if (resultLocked) {
      return;
    }

    scanFrame.classList.add("detecting");
    statusText.textContent = "พบโลโก้แล้ว กำลังยืนยัน...";
    clearTimeout(foundTimer);
    foundTimer = setTimeout(showResult, 350);
  });

  target.addEventListener("targetLost", () => {
    clearTimeout(foundTimer);
    scanFrame.classList.remove("detecting");

    if (!resultLocked) {
      statusText.textContent = "กำลังค้นหาโลโก้...";
    }
  });

  openCameraButton.addEventListener("click", startCamera);
  $("#retry").addEventListener("click", startCamera);
  $("#closeResult").addEventListener("click", closeResult);
  $("#scanAgain").addEventListener("click", closeResult);
  $("#openDrive").addEventListener("click", openDrive);

  $("#backStart").addEventListener("click", () => {
    window.location.href = "./index.html?v=12";
  });

  $("#changeAgency").addEventListener("click", () => {
    window.location.href = "./index.html?v=12";
  });

  verifyMindFile();
})();
