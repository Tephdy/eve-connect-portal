import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate"; // ← changed: ESM import

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef4ff",
          100: "#dbe6ff",
          200: "#bcd1ff",
          300: "#8fb0ff",
          400: "#5e88ff",
          500: "#3b6fff",
          600: "#2b59e8",
          700: "#1e44c0",
          800: "#1a3998",
          900: "#182f70",
        },
        accent: {
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
        },
        // Vivid pastel accents — for stats, cards, badges
        vivid: {
          yellow:   "#ffd166",
          coral:    "#ff8c69",
          lavender: "#c7a8ff",
          mint:     "#7fe0b1",
          sky:      "#7cc7ff",
          rose:     "#ff9ec1",
          lime:     "#b8e986",
        },
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          muted:   "rgb(var(--surface-muted) / <alpha-value>)",
          sunken:  "rgb(var(--surface-sunken) / <alpha-value>)",
          raised:  "rgb(var(--surface-raised) / <alpha-value>)",
          glass:   "rgb(var(--surface-glass) / <alpha-value>)",
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
        success: { 50: "#ecfdf5", 100: "#d1fae5", 500: "#10b981", 700: "#047857" },
        warning: { 50: "#fffbeb", 100: "#fef3c7", 500: "#f59e0b", 700: "#b45309" },
        danger:  { 50: "#fef2f2", 100: "#fee2e2", 500: "#ef4444", 700: "#b91c1c" },
        info:    { 50: "#eff6ff", 100: "#dbeafe", 500: "#3b82f6", 700: "#1d4ed8" },
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "10px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(15, 23, 42, 0.05)",
        sm: "0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)",
        DEFAULT: "0 4px 12px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)",
        md: "0 8px 24px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.06)",
        lg: "0 16px 40px rgba(15, 23, 42, 0.14), 0 4px 12px rgba(15, 23, 42, 0.06)",
        glass: "0 8px 32px rgba(15, 23, 42, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.35)",
        "glass-dark": "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        glow: "0 0 0 1px rgba(59, 111, 255, 0.20), 0 8px 24px rgba(59, 111, 255, 0.22)",
        "glow-sm": "0 0 12px rgba(59, 111, 255, 0.35)",
        "card-lift": "0 12px 32px rgba(15, 23, 42, 0.14)",
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
        "4xl":["36px", { lineHeight: "44px" }],
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #3b6fff 0%, #22d3ee 100%)",
        "brand-gradient-soft": "linear-gradient(135deg, rgba(59,111,255,0.14) 0%, rgba(34,211,238,0.14) 100%)",
        "page-light":
          "radial-gradient(1200px 800px at 15% 0%, #dbeafe 0%, transparent 50%), " +
          "radial-gradient(1000px 700px at 85% 20%, #f3e8ff 0%, transparent 50%), " +
          "radial-gradient(900px 600px at 50% 100%, #d1fae5 0%, transparent 60%), " +
          "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
        "page-dark":
          "radial-gradient(1200px 800px at 15% -10%, rgba(59,111,255,0.18) 0%, transparent 50%), " +
          "radial-gradient(1000px 700px at 85% 20%, rgba(168,85,247,0.14) 0%, transparent 50%), " +
          "radial-gradient(900px 600px at 50% 100%, rgba(34,211,238,0.10) 0%, transparent 60%), " +
          "linear-gradient(180deg, #0a0e1a 0%, #070a14 100%)",
      },
      backdropBlur: {
        xs: "4px",
        glass: "20px",
      },
      transitionDuration: { DEFAULT: "180ms" },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-in-top": {
          from: { transform: "translateY(-8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        "slide-in-top": "slide-in-top 200ms ease-out",
        "pulse-slow": "pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate], // ← changed: use imported symbol, not require()
};

export default config;