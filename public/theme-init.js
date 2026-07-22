(() => {
  const themeCookie = document.cookie.split("; ").find((entry) => entry.startsWith("salta_theme="));
  const savedTheme = themeCookie ? decodeURIComponent(themeCookie.split("=").slice(1).join("=")) : "";
  const theme = savedTheme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0d1117" : "#f4f6f8");
})();
