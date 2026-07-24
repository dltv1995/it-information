"use strict";

/* แก้ชื่อหน่วยงานได้ที่ title และใส่วิดีโอไว้ในโฟลเดอร์ videos */
const agencyData = [
  { title: "วิดีโอแนะนำ: หน่วยงานที่ 1", videoUrl: "./videos/agency1.mp4" },
  { title: "วิดีโอแนะนำ: หน่วยงานที่ 2", videoUrl: "./videos/agency2.mp4" },
  { title: "วิดีโอแนะนำ: หน่วยงานที่ 3", videoUrl: "./videos/agency3.mp4" },
  { title: "วิดีโอแนะนำ: หน่วยงานที่ 4", videoUrl: "./videos/agency4.mp4" },
  { title: "วิดีโอแนะนำ: หน่วยงานที่ 5", videoUrl: "./videos/agency5.mp4" },
  { title: "วิดีโอแนะนำ: หน่วยงานที่ 6", videoUrl: "./videos/agency6.mp4" }
];

document.addEventListener("DOMContentLoaded", () => {
  const scene = document.querySelector("#arScene");
  const startScreen = document.querySelector("#startScreen");
  const startButton = document.querySelector("#startButton");
  const scannerUi = document.querySelector("#scannerUi");
  const statusPill = document.querySelector("#statusPill");
  const modal = document.querySelector("#videoModal");
  const player = document.querySelector("#popupVideo");
  const agencyTitle = document.querySelector("#agencyTitle");
  const videoLoading = document.querySelector("#videoLoading");
  const soundButton = document.querySelector("#soundButton");
  const closeButton = document.querySelector("#closeButton");
  const closeBottomButton = document.querySelector("#closeBottomButton");
  const errorBox = document.querySelector("#errorBox");
  const errorMessage = document.querySelector("#errorMessage");
  const retryButton = document.querySelector("#retryButton");

  let arSystem = null;
  let starting = false;
  let modalOpen = false;
  let activeTargetIndex = null;
  const blockedTargets = new Set();

  const setStatus = (message) => {
    statusPill.textContent = message;
  };

  const showError = (message) => {
    starting = false;
    startButton.disabled = false;
    startButton.textContent = "เปิดกล้อง";
    errorMessage.textContent = message;
    errorBox.hidden = false;
  };

  scene.addEventListener("loaded", () => {
    arSystem = scene.systems["mindar-image-system"];
  });

  scene.addEventListener("arReady", () => {
    setStatus("พร้อมแล้ว กรุณาส่องกล้องไปที่โลโก้");
  });

  scene.addEventListener("arError", () => {
    showError("เริ่มระบบ AR ไม่สำเร็จ กรุณาใช้ Safari หรือ Chrome รุ่นปัจจุบัน และตรวจสอบสิทธิ์กล้อง");
  });

  async function startScanner() {
    if (starting) return;
    starting = true;
    errorBox.hidden = true;
    startButton.disabled = true;
    startButton.textContent = "กำลังเปิดกล้อง...";

    try {
      if (!arSystem) {
        await new Promise((resolve, reject) => {
          let tries = 0;
          const timer = setInterval(() => {
            arSystem = scene.systems["mindar-image-system"];
            tries += 1;
            if (arSystem) {
              clearInterval(timer);
              resolve();
            } else if (tries >= 50) {
              clearInterval(timer);
              reject(new Error("AR system was not ready"));
            }
          }, 100);
        });
      }

      await arSystem.start();
      startScreen.classList.add("is-hidden");
      scannerUi.classList.remove("is-hidden");
      setStatus("พร้อมแล้ว กรุณาส่องกล้องไปที่โลโก้");
      starting = false;
    } catch (error) {
      console.error(error);
      showError("เปิดกล้องไม่สำเร็จ กรุณาอนุญาตการใช้กล้อง แล้วเปิดหน้าเว็บผ่าน HTTPS");
    }
  }

  async function showVideo(index) {
    if (modalOpen || blockedTargets.has(index)) return;

    const data = agencyData[index];
    if (!data) return;

    modalOpen = true;
    activeTargetIndex = index;
    blockedTargets.add(index);
    agencyTitle.textContent = data.title;
    videoLoading.hidden = false;
    modal.hidden = false;

    player.pause();
    player.removeAttribute("src");
    player.load();
    player.src = data.videoUrl;
    player.muted = true;
    player.load();
    soundButton.textContent = "เปิดเสียง";

    try {
      await player.play();
    } catch (error) {
      console.warn("Autoplay was blocked:", error);
      videoLoading.textContent = "แตะปุ่มเล่นบนวิดีโอเพื่อเริ่มรับชม";
    }
  }

  function closeVideo() {
    if (!modalOpen) return;

    player.pause();
    player.currentTime = 0;
    player.removeAttribute("src");
    player.load();
    modal.hidden = true;
    videoLoading.hidden = false;
    videoLoading.textContent = "กำลังโหลดวิดีโอ...";
    modalOpen = false;
    activeTargetIndex = null;
    setStatus("ปิดวิดีโอแล้ว กรุณาส่องโลโก้อื่น หรือยกกล้องออกแล้วส่องซ้ำ");
  }

  agencyData.forEach((_, index) => {
    const target = document.querySelector(`#target-${index}`);
    if (!target) return;

    target.addEventListener("targetFound", () => {
      setStatus(`พบโลโก้หน่วยงานที่ ${index + 1}`);
      showVideo(index);
    });

    target.addEventListener("targetLost", () => {
      blockedTargets.delete(index);
      if (!modalOpen) {
        setStatus("กำลังค้นหาโลโก้...");
      }
    });
  });

  player.addEventListener("canplay", () => {
    videoLoading.hidden = true;
  });

  player.addEventListener("waiting", () => {
    videoLoading.textContent = "กำลังโหลดวิดีโอ...";
    videoLoading.hidden = false;
  });

  player.addEventListener("playing", () => {
    videoLoading.hidden = true;
  });

  player.addEventListener("error", () => {
    videoLoading.textContent = "เปิดวิดีโอไม่ได้ กรุณาตรวจสอบชื่อและตำแหน่งไฟล์ MP4";
    videoLoading.hidden = false;
  });

  soundButton.addEventListener("click", async () => {
    player.muted = !player.muted;
    soundButton.textContent = player.muted ? "เปิดเสียง" : "ปิดเสียง";
    try {
      await player.play();
    } catch (error) {
      console.warn("Video play failed:", error);
    }
  });

  startButton.addEventListener("click", startScanner);
  retryButton.addEventListener("click", startScanner);
  closeButton.addEventListener("click", closeVideo);
  closeBottomButton.addEventListener("click", closeVideo);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !player.paused) player.pause();
  });
});
