console.log("header.js loaded: shared-sidebar-v14");

const HEADER_VERSION = "shared-sidebar-v14";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeHeader, {
    once: true,
  });
} else {
  initializeHeader();
}

async function initializeHeader() {
  try {
    const response = await fetch(`components/header.html?v=${HEADER_VERSION}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`โหลด Header ไม่สำเร็จ ${response.status}`);
    }

    const layoutRoot = document.getElementById("layoutRoot");
    if (layoutRoot) {
      layoutRoot.innerHTML = await response.text();
    }

    setPageInformation();
    bindHeaderEvents();
    paintThemeIcon();
    loadStoredUser();
  } catch (error) {
    console.error("Header initialization failed:", error);
  } finally {
    document.getElementById("appBody")?.classList.remove("hidden");
    document.dispatchEvent(new CustomEvent("shared:layout-ready"));
  }
}

function setPageInformation() {
  const body = document.body;
  const activePage = body.dataset.activeMenu || "";

  document.getElementById("pageTitle").textContent = body.dataset.title || "";
  document.getElementById("pageSubtitle").textContent =
    body.dataset.subtitle || "";

  document.querySelectorAll(".shared-nav-item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.page === activePage);
  });
}

function bindHeaderEvents() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("mobileOverlay");

  const openSidebar = () => {
    sidebar.classList.remove("-translate-x-full");
    overlay.classList.remove("hidden");
  };

  const closeSidebar = () => {
    sidebar.classList.add("-translate-x-full");
    overlay.classList.add("hidden");
  };

  document
    .getElementById("mobileMenuBtn")
    ?.addEventListener("click", openSidebar);
  document
    .getElementById("closeSidebarBtn")
    ?.addEventListener("click", closeSidebar);
  overlay?.addEventListener("click", closeSidebar);

  document.getElementById("themeToggleBtn")?.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem(
      "color-theme",
      document.documentElement.classList.contains("dark") ? "dark" : "light",
    );
    paintThemeIcon();
    document.dispatchEvent(new CustomEvent("shared:theme-change"));
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    try {
      const config = await import("./firebase-config.js");
      const authSdk =
        await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
      await authSdk.signOut(config.auth);
    } catch (error) {
      console.warn("Sign out fallback:", error.message);
    }
    window.location.href = "login.html";
  });
}

function paintThemeIcon() {
  const icon = document.getElementById("themeIcon");
  if (!icon) return;

  const dark = document.documentElement.classList.contains("dark");
  icon.className = dark ? "fa-solid fa-sun" : "fa-solid fa-moon";
}

function loadStoredUser() {
  const name = localStorage.getItem("user_name");
  const role = localStorage.getItem("user_role");

  if (name) document.getElementById("userName").textContent = name;
  if (role) document.getElementById("userRole").textContent = role;
}
