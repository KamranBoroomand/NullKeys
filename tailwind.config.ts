import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        canvas: "hsl(var(--canvas))",
        panel: "hsl(var(--panel))",
        panelMuted: "hsl(var(--panel-muted))",
        panelSolid: "hsl(var(--panel-solid))",
        accent: "hsl(var(--accent))",
        accentSoft: "hsl(var(--accent-soft))",
        text: "hsl(var(--text))",
        textMuted: "hsl(var(--text-muted))",
        borderTone: "hsl(var(--border-tone))",
        danger: "hsl(var(--danger))",
        success: "hsl(var(--success))",
        warn: "hsl(var(--warn))",
        modalSurface: "hsl(var(--modal-surface))",
        modalText: "hsl(var(--modal-text))",
        modalBorder: "hsl(var(--modal-border))",
        popoverSurface: "hsl(var(--popover-surface))",
        popoverText: "hsl(var(--popover-text))",
        popoverBorder: "hsl(var(--popover-border))",
        surfaceRaised: "hsl(var(--surface-raised))",
        surfaceInset: "hsl(var(--surface-inset))",
        surfaceStrong: "hsl(var(--surface-strong))",
        surfaceStrongText: "hsl(var(--surface-strong-text))",
      },
      boxShadow: {
        airy: "0 20px 50px -24px rgba(4, 16, 24, 0.28)",
      },
      borderRadius: {
        soft: "1.5rem",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        rise: "rise 420ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
