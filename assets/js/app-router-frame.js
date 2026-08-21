// assets/js/app-router-fetch.js
// Version: app-shell-fetch-v3

console.log("app-router-fetch.js loaded: app-shell-fetch-v3");

(() => {
  const THEME_KEY = "color-theme";

  const routes = {
    dashboard: {
      file: "dashboard.html",
      script: "dashboard.js",
      title: "ภาพรวมระบบ",
      subtitle: "สรุปภาพรวมข้อมูลและสถานะล่าสุด",
    },
    leave: {
      file: "leave.html",
      script: "leave.js",
      title: "ระบบจัดการวันลา",
      subtitle: "ยื่นใบลา ตรวจสอบสถานะ และอนุมัติการลา",
    },
    projects: {
      file: "projects.html",
      script: "projects.js",
      title: "โครงการและงบประมาณ",
      subtitle: "สร้างโครงการ รอหัวหน้าอนุมัติ และดูงบคงเหลือทั้งฝ่าย",
    },
  };

  const content = document.getElementById("pageContent");
  let currentScript = null;

  function getActiveTheme() {
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  }

  function updateThemeIcon() {
    const themeButton = document.getElementById("themeToggleBtn");
    if (!themeButton) return;

    const isDark = getActiveTheme() === "dark";
    const sunIcon = themeButton.querySelector(".sun-icon");
    const moonIcon = themeButton.querySelector(".moon-icon");

    if (sunIcon) {
      sunIcon.hidden = !isDark;
      sunIcon.style.display = isDark ? "inline-block" : "none";
    }

    if (moonIcon) {
      moonIcon.hidden = isDark;
      moonIcon.style.display = isDark ? "none" : "inline-block";
    }

    themeButton.setAttribute(
      "aria-label",
      isDark ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด",
    );
  }

  function applySavedTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;

    const isDark =
      savedTheme === "dark" || (savedTheme !== "light" && systemPrefersDark);

    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    updateThemeIcon();
  }

  function toggleTheme(event) {
    event.preventDefault();
    event.stopPropagation();

    const nextIsDark = !document.documentElement.classList.contains("dark");

    document.documentElement.classList.toggle("dark", nextIsDark);
    document.documentElement.style.colorScheme = nextIsDark ? "dark" : "light";

    localStorage.setItem(THEME_KEY, nextIsDark ? "dark" : "light");
    updateThemeIcon();
  }

  function setupShell() {
    const themeToggleButton = document.getElementById("themeToggleBtn");

    if (themeToggleButton && themeToggleButton.dataset.boundTheme !== "true") {
      themeToggleButton.dataset.boundTheme = "true";
      themeToggleButton.addEventListener("click", toggleTheme);
    }

    applySavedTheme();

    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("mobileOverlay");

    const openSidebar = () => {
      sidebar?.classList.remove("-translate-x-full");
      overlay?.classList.remove("hidden");

      requestAnimationFrame(() => {
        overlay?.classList.remove("opacity-0");
      });
    };

    const closeSidebar = () => {
      sidebar?.classList.add("-translate-x-full");
      overlay?.classList.add("opacity-0");

      setTimeout(() => {
        overlay?.classList.add("hidden");
      }, 180);
    };

    document
      .getElementById("mobileMenuBtn")
      ?.addEventListener("click", openSidebar);

    document
      .getElementById("closeSidebarBtn")
      ?.addEventListener("click", closeSidebar);

    overlay?.addEventListener("click", closeSidebar);
  }

  function setActive(name) {
    document.querySelectorAll(".shell-nav").forEach((link) => {
      const active = link.dataset.route === name;

      link.classList.toggle("text-white", active);
      link.classList.toggle("bg-brand-600", active);
      link.classList.toggle("dark:bg-sky-600", active);
      link.classList.toggle("font-medium", active);
      link.classList.toggle("shadow-sm", active);

      if (active) {
        link.classList.remove("text-slate-400");
      } else {
        link.classList.add("text-slate-400");
      }
    });
  }

  function clearOld() {
    window.dispatchEvent(new CustomEvent("app:navigate-away"));

    document
      .querySelectorAll('[data-dynamic-modal="1"]')
      .forEach((element) => element.remove());

    if (currentScript) {
      currentScript.remove();
      currentScript = null;
    }
  }

  function extractContent(documentObject) {
    return (
      documentObject.querySelector("main > div.flex-1.overflow-y-auto") ||
      documentObject.querySelector('main div[class*="overflow-y-auto"]') ||
      documentObject.body
    );
  }

  function importModals(documentObject) {
    [
      "projectModal",
      "actionModal",
      "globalBudgetModal",
      "leaveModal",
      "dashboardProjectDetailsModal",
    ].forEach((id) => {
      const element = documentObject.getElementById(id);

      if (element) {
        element.dataset.dynamicModal = "1";
        document.body.appendChild(element);
      }
    });
  }

  async function navigate(name, push = true) {
    const route = routes[name] || routes.projects;
    const actualRouteName = routes[name] ? name : "projects";

    setActive(actualRouteName);

    document.getElementById("pageTitle").textContent = route.title;
    document.getElementById("pageSubtitle").textContent = route.subtitle;

    content.classList.add("opacity-0");
    clearOld();

    try {
      const response = await fetch(
        `${route.file}?v=app-shell-fetch-v3&t=${Date.now()}`,
        { cache: "no-store" },
      );

      const html = await response.text();
      const documentObject = new DOMParser().parseFromString(html, "text/html");
      const mainContent = extractContent(documentObject);

      content.innerHTML = mainContent.innerHTML;
      importModals(documentObject);

      currentScript = document.createElement("script");
      currentScript.type = "module";
      currentScript.src = `assets/js/${route.script}?v=app-shell-fetch-v3&t=${Date.now()}`;
      document.body.appendChild(currentScript);

      // เปลี่ยน Route แล้วต้องคง Theme และไอคอนเดิมไว้
      applySavedTheme();

      requestAnimationFrame(() => {
        content.classList.remove("opacity-0");
      });

      if (push) {
        location.hash = actualRouteName;
      }
    } catch (error) {
      console.error("navigate error", error);
      content.innerHTML =
        '<div class="clean-card p-6 text-red-500">โหลดหน้าไม่สำเร็จ</div>';
      content.classList.remove("opacity-0");
    }
  }

  document.querySelectorAll(".shell-nav[data-route]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(link.dataset.route, true);
    });
  });

  window.addEventListener("hashchange", () => {
    navigate(location.hash.replace("#", "") || "projects", false);
  });

  setupShell();
  navigate(location.hash.replace("#", "") || "projects", false);
})();
