import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eff4fb",
          100: "#dbe6f5",
          200: "#b8cdea",
          300: "#8aacdb",
          400: "#5c8ac9",
          500: "#3b6fb5",
          600: "#2b5797",
          700: "#234a80",
          800: "#1d3d69",
          900: "#182f52",
        },
        // Semantic tokens — resolved via CSS variables, flip with theme
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          muted:   "rgb(var(--surface-muted) / <alpha-value>)",
          sunken:  "rgb(var(--surface-sunken) / <alpha-value>)",
        },
        ink: {
          50:  "rgb(var(--ink-50) / <alpha-value>)",
          100: "rgb(var(--ink-100) / <alpha-value>)",
          200: "rgb(var(--ink-200) / <alpha-value>)",
          300: "rgb(var(--ink-300) / <alpha-value>)",
          400: "rgb(var(--ink-400) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
        },
        success: { 50: "#f0fdf4", 100: "#dcfce7", 500: "#22c55e", 700: "#15803d" },
        warning: { 50: "#fffbeb", 100: "#fef3c7", 500: "#f59e0b", 700: "#b45309" },
        danger:  { 50: "#fef2f2", 100: "#fee2e2", 500: "#ef4444", 700: "#b91c1c" },
        info:    { 50: "#eff6ff", 100: "#dbeafe", 500: "#3b82f6", 700: "#1d4ed8" },
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(15, 23, 42, 0.04)",
        sm: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
        DEFAULT: "0 2px 4px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
        md: "0 4px 8px rgba(15, 23, 42, 0.06), 0 2px 4px rgba(15, 23, 42, 0.04)",
        lg: "0 10px 20px rgba(15, 23, 42, 0.08), 0 4px 8px rgba(15, 23, 42, 0.04)",
      },
      fontSize: {
        xs:   ["12px", { lineHeight: "16px" }],
        sm:   ["13px", { lineHeight: "20px" }],
        base: ["14px", { lineHeight: "22px" }],
        md:   ["15px", { lineHeight: "24px" }],
        lg:   ["17px", { lineHeight: "26px" }],
        xl:   ["20px", { lineHeight: "30px" }],
        "2xl":["24px", { lineHeight: "32px" }],
        "3xl":["30px", { lineHeight: "38px" }],
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      transitionDuration: { DEFAULT: "150ms" },
    },
  },
  plugins: [],
};

export default config;