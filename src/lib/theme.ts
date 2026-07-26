/** Theme: dark/light, persisted, applied via data-theme on <html>. */
export type Theme = "dark" | "light";

export function getTheme(): Theme {
  return (localStorage.getItem("lg-theme") as Theme) || "dark";
}
export function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("lg-theme", t);
}
export function initTheme() {
  applyTheme(getTheme());
}
