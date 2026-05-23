import type { Config } from "tailwindcss";

const config: Config = {
  content:  ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg:      "var(--bg)",
        surf:    "var(--surf)",
        "surf-2": "var(--surf-2)",
        wire:    "var(--wire)",
        "wire-2": "var(--wire-2)",
        amber:   "var(--amber)",
        "amber-dim": "var(--amber-dim)",
        green:   "var(--green)",
        red:     "var(--red)",
        blue:    "var(--blue)",
        violet:  "var(--violet)",
        text1:   "var(--text-1)",
        text2:   "var(--text-2)",
        text3:   "var(--text-3)",
        // legacy — kept for any missed references
        arc:    "#3B82F6",
        circle: "#2563EB",
        usyc:   "#D97706",
      },
      fontFamily: {
        sans: ["var(--font-inter)"],
        mono: ["var(--font-mono)"],
      },
      animation: {
        ticker:      "ticker 32s linear infinite",
        "fade-up":   "fadeSlideUp 0.6s cubic-bezier(0.22,1,0.36,1) both",
        "slide-left": "slideInLeft 0.4s cubic-bezier(0.22,1,0.36,1) both",
        blink:       "blink 1s step-end infinite",
        scanline:    "scanline 12s linear infinite",
        shimmer:     "shimmer 2.5s ease-in-out infinite",
        "pulse-dot":  "pulseDot 2s ease-in-out infinite",
      },
      keyframes: {
        ticker: {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeSlideUp: {
          "0%":   { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          "0%":   { opacity: "0", transform: "translateX(-12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0" },
        },
        scanline: {
          "0%":   { transform: "translateY(-100vh)" },
          "100%": { transform: "translateY(100vh)" },
        },
        shimmer: {
          "0%, 100%": { opacity: "0.04" },
          "50%":      { opacity: "0.10" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":      { opacity: "0.5", transform: "scale(0.85)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
