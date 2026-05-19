import type { Config } from "tailwindcss";

const config: Config = {
  content:  ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        arc:    "#3B82F6",
        circle: "#2563EB",
        usyc:   "#D97706",
      },
      fontFamily: {
        sans: ["var(--font-inter)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};

export default config;
