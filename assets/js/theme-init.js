// assets/js/theme-init.js - shared theme state v1
// Load this synchronously in <head> before Tailwind and page styles.
(() => {
  const savedTheme = localStorage.getItem("color-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const useDark = savedTheme ? savedTheme === "dark" : prefersDark;

  document.documentElement.classList.toggle("dark", useDark);
  document.documentElement.dataset.themeReady = "true";
})();
