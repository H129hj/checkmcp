import type { Config } from "tailwindcss";
import daisyui from "daisyui";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Archivo"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        // grade ramp — tons moyens lisibles sur thème clair ET sombre
        "g-a": "#22c55e",
        "g-b": "#65a30d",
        "g-c": "#d99e00",
        "g-d": "#ea580c",
        "g-f": "#ef4444",
        signal: "#ccff00",
      },
      keyframes: {
        pulseDot: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".35" } },
        rise: { from: { opacity: "0", transform: "translateY(14px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        pulseDot: "pulseDot 2.4s ease-in-out infinite",
        rise: "rise .6s cubic-bezier(.2,.8,.2,1) both",
      },
    },
  },
  plugins: [daisyui, typography],
  daisyui: {
    themes: [
      {
        "checkmcp-light": {
          primary: "#7fa800",
          "primary-content": "#0a0a0c",
          secondary: "#2563eb",
          "secondary-content": "#ffffff",
          accent: "#7fa800",
          "accent-content": "#ffffff",
          neutral: "#1c1c24",
          "neutral-content": "#f5f6f7",
          "base-100": "#ffffff",
          "base-200": "#f4f5f7",
          "base-300": "#e6e8ec",
          "base-content": "#14151a",
          info: "#2563eb",
          success: "#1f9d57",
          warning: "#b8860b",
          error: "#dc2626",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.6rem",
          "--rounded-badge": "0.5rem",
          "--border-btn": "1px",
          "--tab-radius": "0.5rem",
        },
      },
      {
        checkmcp: {
          primary: "#ccff00",
          "primary-content": "#0a0a0c",
          secondary: "#5e9bff",
          "secondary-content": "#04122b",
          accent: "#ccff00",
          "accent-content": "#0a0a0c",
          neutral: "#17171e",
          "neutral-content": "#e9e9ec",
          "base-100": "#0a0a0c",
          "base-200": "#121218",
          "base-300": "#1c1c24",
          "base-content": "#e9e9ec",
          info: "#5e9bff",
          success: "#46d97f",
          warning: "#e8c252",
          error: "#f85149",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.6rem",
          "--rounded-badge": "0.5rem",
          "--border-btn": "1px",
          "--tab-radius": "0.5rem",
        },
      },
    ],
    darkTheme: "checkmcp",
    logs: false,
  },
};

export default config;
