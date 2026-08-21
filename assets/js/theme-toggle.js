// assets/js/theme-toggle.js - shared theme toggle v1
(() => {
  function applyTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("color-theme", dark ? "dark" : "light");
    document.dispatchEvent(
      new CustomEvent("app:theme-change", {
        detail: { theme: dark ? "dark" : "light" },
      }),
    );
  }

  function bindThemeToggle() {
    const button = document.getElementById("themeToggleBtn");
    if (!button || button.dataset.themeBound === "true") return;

    button.dataset.themeBound = "true";
    button.addEventListener("click", () => {
      applyTheme(
        document.documentElement.classList.contains("dark") ? "light" : "dark",
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindThemeToggle, {
      once: true,
    });
  } else {
    bindThemeToggle();
  }

  document.addEventListener("shared:header-ready", bindThemeToggle);
  document.addEventListener("shared:layout-ready", bindThemeToggle);
})();
