/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ALIGN design system — driven by CSS variables (see index.css) so the
        // whole palette can be themed in one place. Dark navy is the default.
        // `<alpha-value>` keeps every `/opacity` utility (text-charcoal/45 …) working.
        obsidian: "rgb(var(--obsidian) / <alpha-value>)", // headings
        charcoal: "rgb(var(--charcoal) / <alpha-value>)", // body copy
        // Elevated surface (cards, header, panels) — replaces literal bg-white.
        panel: "rgb(var(--panel) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)", // app canvas
          sunken: "rgb(var(--surface-sunken) / <alpha-value>)", // wells, inset regions, skeleton base
        },
        hairline: {
          DEFAULT: "rgb(var(--hairline) / <alpha-value>)", // faint hairline borders
          strong: "rgb(var(--hairline-strong) / <alpha-value>)", // hover borders, dashed empties
        },
        // Accent — exclusively CTAs, active states, loading
        cobalt: {
          DEFAULT: "rgb(var(--cobalt) / <alpha-value>)",
          hover: "rgb(var(--cobalt-hover) / <alpha-value>)",
          active: "rgb(var(--cobalt-active) / <alpha-value>)",
          50: "rgb(var(--cobalt-50) / <alpha-value>)",
          100: "rgb(var(--cobalt-100) / <alpha-value>)",
          200: "rgb(var(--cobalt-200) / <alpha-value>)",
        },
        // Semantic status tokens
        success: {
          DEFAULT: "rgb(var(--success) / <alpha-value>)",
          strong: "rgb(var(--success-strong) / <alpha-value>)",
          soft: "rgb(var(--success-soft) / <alpha-value>)",
          border: "rgb(var(--success-border) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--warning) / <alpha-value>)",
          strong: "rgb(var(--warning-strong) / <alpha-value>)",
          soft: "rgb(var(--warning-soft) / <alpha-value>)",
          border: "rgb(var(--warning-border) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--danger) / <alpha-value>)",
          strong: "rgb(var(--danger-strong) / <alpha-value>)",
          soft: "rgb(var(--danger-soft) / <alpha-value>)",
          border: "rgb(var(--danger-border) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        // Ambient chrome tier: caps-labels, chips, metadata
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.01em" }],
      },
      boxShadow: {
        // Elevation scale: xs (resting chrome) → card (panels) → lift (hover/overlay)
        xs: "0 1px 2px 0 rgb(10 10 10 / 0.04)",
        card: "0 1px 2px 0 rgb(10 10 10 / 0.04), 0 4px 16px -4px rgb(10 10 10 / 0.06)",
        lift: "0 2px 4px -2px rgb(10 10 10 / 0.08), 0 12px 32px -8px rgb(10 10 10 / 0.12)",
        // Cobalt glow — reserved for the hero CTA
        cta: "0 1px 2px 0 rgb(0 82 255 / 0.32), 0 4px 14px -2px rgb(0 82 255 / 0.30)",
        "cta-lg": "0 2px 4px 0 rgb(0 82 255 / 0.28), 0 8px 24px -4px rgb(0 82 255 / 0.40)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        indeterminate: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
        },
        // Landing ambience: gentle product-visual float + slow glow drift
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-7px)" },
        },
        drift: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(4%, -4%) scale(1.08)" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out both",
        "fade-in-up": "fade-in-up 350ms cubic-bezier(0.16, 1, 0.3, 1) both",
        indeterminate: "indeterminate 1.4s cubic-bezier(0.65, 0, 0.35, 1) infinite",
        float: "float 7s ease-in-out infinite",
        drift: "drift 16s ease-in-out infinite",
      },
      transitionTimingFunction: {
        "out-quart": "cubic-bezier(0.165, 0.84, 0.44, 1)",
      },
    },
  },
  plugins: [],
};
