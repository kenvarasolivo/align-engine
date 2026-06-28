import { useState } from "react";
import { applyTheme, getStoredTheme, type Theme } from "../lib/theme";

/**
 * Dark/light theme switcher. Self-contained — reads the persisted theme on
 * mount and flips the `light` class on <html> via the theme helpers. Dark is
 * the app default; this just lets users opt into the original light palette.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={!isDark}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-panel text-charcoal/70 shadow-xs transition-all duration-150 hover:text-cobalt hover:border-cobalt/40 ${className}`}
    >
      {isDark ? (
        // Moon — currently dark, click for light
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      ) : (
        // Sun — currently light, click for dark
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M17.36 6.64l1.42-1.42" />
        </svg>
      )}
    </button>
  );
}
