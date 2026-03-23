import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // OLI Architecture brand colors
        // Primary: warm gold/amber drawn from the OLI logo
        primary: {
          DEFAULT: "#C8922A",
          50: "#FDF6E7",
          100: "#F9E9C4",
          200: "#F2D08A",
          300: "#EAB750",
          400: "#D9A030",
          500: "#C8922A",
          600: "#A57422",
          700: "#7D571A",
          800: "#543A12",
          900: "#2B1D09",
        },
        // Neutral: warm off-white and charcoal
        neutral: {
          50: "#FAFAF8",
          100: "#F5F4F0",
          200: "#E8E6E0",
          300: "#D1CECC",
          400: "#A8A49F",
          500: "#7E7A74",
          600: "#5A564F",
          700: "#3D3A34",
          800: "#28251F",
          900: "#141210",
        },
        // Status colors
        success: "#2E7D32",
        warning: "#ED6C02",
        danger: "#D32F2F",
        info: "#0288D1",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
