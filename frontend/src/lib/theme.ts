/**
 * Theme handling — dark navy is the default; light is opt-in.
 *
 * The active theme is reflected as a `light` class on <html> (dark = no class),
 * which flips the CSS-variable palette in index.css. The choice is persisted to
 * localStorage and applied pre-paint by an inline script in index.html so there
 * is no flash on reload.
 */
export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "align-theme";

/** Read the persisted theme, defaulting to dark. */
export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Apply a theme to the document and persist it. */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("light", theme === "light");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage unavailable (private mode) — theme still applies for this session */
  }
}
