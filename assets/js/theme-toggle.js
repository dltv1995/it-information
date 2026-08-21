// assets/js/theme-toggle.js - shared theme toggle v3
(() => {
  const STORAGE_KEY = "color-theme";

  function currentTheme() {
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    document.dispatchEvent(
      new CustomEvent("app:theme-change", {
        detail: { theme: dark ? "dark" : "light" },
      }),
    );
  }

  function onThemeClick(event) {
    const button = event.target.closest("#themeToggleBtn");
    if (!button) return;

    // Capture phase blocks old Leave/Projects listeners from toggling a second time.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    applyTheme(currentTheme() === "dark" ? "light" : "dark");
  }

  function initializeThemeController() {
    if (document.documentElement.dataset.sharedThemeController === "v3") return;
    document.documentElement.dataset.sharedThemeController = "v3";
    document.addEventListener("click", onThemeClick, true);

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") applyTheme(saved);
  }

  initializeThemeController();
})();
