/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ALIGN design system — core neutrals
        obsidian: "#0A0A0A", // headings
        charcoal: "#262626", // body copy
        surface: {
          DEFAULT: "#FAFAFA", // app canvas
          sunken: "#F4F4F5", // wells, inset regions, skeleton base
        },
        hairline: {
          DEFAULT: "#E5E7EB", // faint hairline borders
          strong: "#D4D4D8", // hover borders, dashed empties
        },
        // Accent — exclusively CTAs, active states, loading
        cobalt: {
          DEFAULT: "#0052FF",
          hover: "#0046DB",
          active: "#003CBD",
          50: "#EEF4FF",
          100: "#DBE6FF",
          200: "#B8CDFF",
        },
        // Semantic status tokens
        success: {
          DEFAULT: "#059669",
          strong: "#047857",
          soft: "#ECFDF5",
          border: "#A7F3D0",
        },
        warning: {
          DEFAULT: "#D97706",
          strong: "#B45309",
          soft: "#FFFBEB",
          border: "#FDE68A",
        },
        danger: {
          DEFAULT: "#DC2626",
          strong: "#B91C1C",
          soft: "#FEF2F2",
          border: "#FECACA",
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
