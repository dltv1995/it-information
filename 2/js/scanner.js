"use strict";

(() => {
  const $ = (selector) => document.querySelector(selector);
  const config = window.AR_CONFIG;
  const targets = Array.isArray(window.AR_TARGETS)
    ? window.AR_TARGETS
    : [];

  const mindUrl = `${config.mindFile}?revision=${encodeURIComponent(config.mindRevision)}`;

  const scene = document.createElement("a-scene");
  const camera = document.createElement("a-camera");

  scene.id = "arScene";
  scene.setAttribute("embedded", "");
  scene.setAttribute(
    "mindar-image",
    [
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
  scene.appendChild(camera);

  const targetElements = new Map();

  targets.forEach((targetData) => {
    const targetElement = document.createElement("a-entity");

    targetElement.id = `target-${targetData.targetIndex}`;
    targetElement.setAttribute(
      "mindar-image-target",
      `targetIndex: ${targetData.targetIndex}`
    );

    scene.appendChild(targetElement);
    targetElements.set(targetData.targetIndex, targetElement);
  });

  $("#sceneHost").appendChild(scene);

  const startScreen = $("#startScreen");
  const scannerUi = $("#scannerUi");
  const statusText = $("#statusText");
  const scanFrame = $("#scanFrame");
  const resultModal = $("#resultModal");
  const errorPanel = $("#errorPanel");
  const startButton = $("#startButton");

  let arSystem = null;
  let starting = false;
  let activeTarget = null;
  let resultLocked = false;
  let foundTimer = null;
  let cooldownUntil = 0;

  scene.addEventListener("loaded", () => {
    arSystem = scene.systems["mindar-image-system"];
  });

  scene.addEventListener("arReady", () => {
    statusText.textContent = "พร้อมแล้ว ส่องโลโก้ใดก็ได้";
  });

  scene.addEventListener("arError", () => {
    showError(`MindAR เปิดไฟล์ไม่สำเร็จ: ${config.mindFile}`);
  });

  async function verifyMindFile() {
    try {
      const response = await fetch(mindUrl, {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const fileContent = await response.arrayBuffer();

      if (fileContent.byteLength < 100) {
        throw new Error("ไฟล์มีขนาดเล็กผิดปกติ");
      }

      $("#mindStatus").textContent =
        `พร้อมใช้งาน (${fileContent.byteLength.toLocaleString()} bytes)`;
      $("#mindStatus").classList.add("ok");
      startButton.disabled = false;
      startButton.textContent = "เปิดกล้องและเริ่มสแกน";
    } catch (error) {
      console.error("Mind file verification failed:", mindUrl, error);
      $("#mindStatus").textContent = "ไม่พบ targets-all.mind";
      $("#mindStatus").classList.add("bad");
      showError(`ตรวจสอบไฟล์ไม่สำเร็จ: ${config.mindFile}`);
    }
  }

  function showError(message) {
    starting = false;
    startButton.disabled = false;
    startButton.textContent = "ลองเปิดระบบอีกครั้ง";
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

  async function startScanner() {
    if (starting) {
      return;
    }

    starting = true;
    errorPanel.classList.add("hidden");
    startButton.disabled = true;
    startButton.textContent = "กำลังเปิดกล้อง...";

    try {
      await (await waitForSystem()).start();
      startScreen.classList.add("hidden");
      scannerUi.classList.remove("hidden");
      statusText.textContent = "กำลังค้นหาโลโก้...";
      starting = false;
      window.dispatchEvent(new Event("resize"));
    } catch (error) {
      console.error(error);
      showError("เปิดกล้องไม่สำเร็จ กรุณาตรวจสอบสิทธิ์กล้อง");
    }
  }

  function scheduleResult(targetData) {
    if (resultLocked || Date.now() < cooldownUntil) {
      return;
    }

    activeTarget = targetData;
    scanFrame.classList.add("detecting");
    statusText.textContent = `พบ ${targetData.title} กำลังยืนยัน...`;

    clearTimeout(foundTimer);
    foundTimer = setTimeout(() => {
      showResult(targetData);
    }, config.foundDelay);
  }

  function showResult(targetData) {
    if (resultLocked || activeTarget !== targetData) {
      return;
    }

    resultLocked = true;
    $("#resultTitle").textContent = targetData.title;
    $("#resultDescription").textContent = targetData.description;
    resultModal.classList.remove("hidden");
  }

  function closeResult() {
    clearTimeout(foundTimer);
    resultModal.classList.add("hidden");
    resultLocked = false;
    activeTarget = null;
    cooldownUntil = Date.now() + config.reopenCooldown;
    scanFrame.classList.remove("detecting");
    statusText.textContent = "ยกกล้องออกจากโลโก้ แล้วส่องใหม่";
  }

  function openAttachedLink() {
    if (!activeTarget) {
      return;
    }

    try {
      const link = new URL(activeTarget.linkUrl);

      if (link.protocol !== "https:") {
        throw new Error("Invalid protocol");
      }

      const newTab = window.open(
        link.href,
        "_blank",
        "noopener,noreferrer"
      );

      if (!newTab) {
        window.location.href = link.href;
      }
    } catch (error) {
      $("#resultDescription").textContent =
        "กรุณาใส่ลิงก์ที่ถูกต้องใน js/config.js";
    }
  }

  targets.forEach((targetData) => {
    const targetElement = targetElements.get(targetData.targetIndex);

    targetElement.addEventListener("targetFound", () => {
      scheduleResult(targetData);
    });

    targetElement.addEventListener("targetLost", () => {
      if (activeTarget !== targetData) {
        return;
      }

      clearTimeout(foundTimer);
      scanFrame.classList.remove("detecting");

      if (!resultLocked) {
        activeTarget = null;
        statusText.textContent = "กำลังค้นหาโลโก้...";
      }
    });
  });

  startButton.addEventListener("click", startScanner);
  $("#retryButton").addEventListener("click", startScanner);
  $("#closeResult").addEventListener("click", closeResult);
  $("#scanAgainButton").addEventListener("click", closeResult);
  $("#openLinkButton").addEventListener("click", openAttachedLink);

  verifyMindFile();
})();
