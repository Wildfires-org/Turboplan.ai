import type { Config } from "tailwindcss";

import { BRAND_GRADIENT_CSS } from "@wildfires-org/turboplan-utils";

import { LAYOUT } from "./src/consts/layout";

// Tailwind v4 runs CSS-first: colors, spacing scales, fonts, shadows, radii,
// breakpoints, keyframes and animations all live in the `@theme` block inside
// `src/globals.css`. This config is loaded from there via `@config` and is
// intentionally reduced to only the values that cannot be expressed as static
// CSS custom properties:
//   - `content` globs (notably the cross-package glob that styles the shared
//     `@wildfires-org/turboplan-utils` components, which have no Tailwind setup
//     of their own).
//   - `backgroundImage.brand-special`, whose value is a gradient string
//     computed in JS by the utils package.
//   - the `LAYOUT`-derived spacing tokens, computed via `calc()` off the JS
//     constants in `src/consts/layout.ts` so they can't silently drift.
//   - the dotted `fontSize` keys (`1.5xl`, `3.5xl`, `3.75xl`) whose names are
//     not valid CSS custom-property identifiers, so they can't move to `@theme`.
const config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/*/*/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "brand-special": BRAND_GRADIENT_CSS,
      },
      fontSize: {
        "1.5xl": "1.375rem",
        "3.5xl": "2rem",
        "3.75xl": "2.125rem",
      },
      spacing: {
        "header-mobile": `${LAYOUT.HEADER_HEIGHT.mobile}px`,
        "header-desktop": `${LAYOUT.HEADER_HEIGHT.desktop}px`,
        "org-select-header-mobile": `${LAYOUT.ORG_SELECT_HEADER_HEIGHT.mobile}px`,
        "org-select-header-desktop": `${LAYOUT.ORG_SELECT_HEADER_HEIGHT.desktop}px`,
        "total-header-mobile": `calc(${LAYOUT.HEADER_HEIGHT.mobile}px + ${LAYOUT.ORG_SELECT_HEADER_HEIGHT.mobile}px)`,
        "total-header-desktop": `calc(${LAYOUT.HEADER_HEIGHT.desktop}px + ${LAYOUT.ORG_SELECT_HEADER_HEIGHT.desktop}px)`,
      },
    },
  },
} satisfies Config;

export default config;
