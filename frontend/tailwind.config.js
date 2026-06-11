/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ALIGN design system
        obsidian: "#0A0A0A", // headings
        charcoal: "#262626", // body copy
        surface: "#FAFAFA", // light gray surfaces
        hairline: "#E5E7EB", // faint hairline borders
        cobalt: {
          DEFAULT: "#0052FF", // exclusive accent: CTAs, active states, loading
          hover: "#0046DB",
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
    },
  },
  plugins: [],
};
