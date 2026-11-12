// Theme tokens are now provided via @wildfires-org/theme-tokens and should be imported in the app's root CSS/TSX.

import { existsSync } from "node:fs";
import path from "node:path";
import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

import { BRAND_GRADIENT_CSS } from "@wildfires-org/turboplan-utils";

// Wildfires.org colors: `brand` is the logo's orange (accents, focus, links)
// and `brandAlt` the forest greens and cream (surfaces, primary actions). See
// lib/brand.ts.
const brandColors = {
  brand: {
    "50": "#FFF5EB",
    "100": "#FFE6CC",
    "200": "#FFCC99",
    "300": "#FFB366",
    "400": "#FF9933",
    "500": "#FF8000",
    "600": "#E67300",
    "700": "#C25E00",
    "800": "#9A4A00",
    "900": "#6E3500",
    "950": "#3D1D00",
  },
  brandAlt: {
    "100": "#FBFAF8",
    "200": "#E4E8E2",
    "300": "#ACB8AF",
    "400": "#3F6B48",
    "500": "#1A3B21",
    "600": "#152F1A",
    "700": "#0F2314",
  },
};

// The sans font is Söhne (declared in app/brand-wildfires.css) over Geist.
// Söhne is licensed to wildfires.org only, so its files are never committed: a
// build that has them copies them into public/brand/wildfires/fonts/ first.
// Without them the stack is Geist alone, so browsers don't request font files
// that aren't there.
const hasSoehne = existsSync(
  path.join(__dirname, "public/brand/wildfires/fonts/soehne-buch.woff2"),
);

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./artifacts/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "../../packages/*/*/src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/streamdown/dist/**/*.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: hasSoehne
          ? ["Soehne", "var(--font-geist)"]
          : ["var(--font-geist)"],
        mono: ["var(--font-geist-mono)"],
      },
      screens: {
        "toast-mobile": "600px",
        /** Project Fields and other ultrawide-specific layouts (Figma: >1920px) */
        ultrawide: "1920px",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      transitionTimingFunction: {
        "in-quad": "var(--ease-in-quad)",
        "in-cubic": "var(--ease-in-cubic)",
        "in-quart": "var(--ease-in-quart)",
        "in-quint": "var(--ease-in-quint)",
        "in-expo": "var(--ease-in-expo)",
        "in-circ": "var(--ease-in-circ)",
        "out-quad": "var(--ease-out-quad)",
        "out-cubic": "var(--ease-out-cubic)",
        "out-quart": "var(--ease-out-quart)",
        "out-quint": "var(--ease-out-quint)",
        "out-expo": "var(--ease-out-expo)",
        "out-circ": "var(--ease-out-circ)",
        "in-out-quad": "var(--ease-in-out-quad)",
        "in-out-cubic": "var(--ease-in-out-cubic)",
        "in-out-quart": "var(--ease-in-out-quart)",
        "in-out-quint": "var(--ease-in-out-quint)",
        "in-out-expo": "var(--ease-in-out-expo)",
        "in-out-circ": "var(--ease-in-out-circ)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "scale-pulse": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.2)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "scale-pulse": "scale-pulse 1s ease-in-out infinite",
      },
      backgroundImage: {
        "brand-special": BRAND_GRADIENT_CSS,
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        "chat-user": {
          DEFAULT: "hsl(var(--chat-user-bg))",
          foreground: "hsl(var(--chat-user-fg))",
        },
        gray: {
          "10": "#F4F4F4",
          "15": "#E8E8E8",
          "30": "#C6C6C6",
          "40": "#A8A8A8",
          "45": "#8F8F8F",
          "70": "#525252",
          "150": "#F8F9F9",
          "160": "#F1F2F3",
          "165": "#EAE3E1",
          "175": "#EDE3F7",
          "250": "#DADBE0",
          "265": "#CECECE",
          "325": "#C2C5CB",
          "350": "#72767D",
          "550": "#505358",
          "750": "#3C3C3C",
          "800": "#2E3033",
          "850": "#2E3033",
          "950": "#0C0D0E",
        },
        neutral: {
          "50": "#F9FAFB",
          "100": "#F3F4F6",
          "200": "#E5E7EB",
          "300": "#D1D5DB",
          "400": "#9CA3AF",
          "500": "#6B7280",
          "600": "#4B5563",
          "700": "#374151",
          "800": "#1F2937",
          "900": "#111827",
        },
        brand: brandColors.brand,
        brandAlt: brandColors.brandAlt,
        error: {
          "50": "#FEF2F2",
          "100": "#FEE2E2",
          "200": "#FECACA",
          "300": "#FCA5A5",
          "400": "#F87171",
          "500": "#EF4444",
          "600": "#DC2626",
          "700": "#B91C1C",
          "800": "#991B1B",
          "900": "#7F1D1D",
        },
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    // `band-wide:` — a container query: applies once the nearest size
    // container (the letterhead band, `components/letterhead-band.tsx`) is
    // at least 30rem wide, so the band lays out by its own width rather than
    // the viewport's.
    plugin(({ addVariant }) => {
      addVariant("band-wide", "@container (min-width: 30rem)");
    }),
  ],
};
export default config;
