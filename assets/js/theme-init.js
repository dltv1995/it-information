// assets/js/theme-init.js - shared theme state v3
(() => {
  const saved = localStorage.getItem("color-theme");
  const fallback = matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
  const theme = saved === "dark" || saved === "light" ? saved : fallback;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
})();
