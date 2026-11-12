/**
 * Branding override surface for the main app.
 *
 * This module and `public/brand/` hold the app's name, logo, and OG image.
 * (Mascot/illustration assets under `public/images/` are content, not brand —
 * forks that want them changed edit those separately.) A downstream fork
 * rebrands by replacing the *contents* of these files at the same paths,
 * keeping the export shape intact — so upstream merges never conflict. The
 * repo-root `.gitattributes` already marks these paths `merge=ours`; the
 * attribute is inert until the fork enables the driver (once per clone, and
 * --local only — a global driver would silently keep "ours" in every repo):
 *
 *   git config --local merge.ours.driver true
 *
 * Consequence for upstream: changing the export SHAPE of this object (adding
 * or renaming a key) is a breaking change for forks — their copy is kept
 * verbatim on merge, so the new key is missing until they add it by hand.
 *
 * Deliberately not listed here: the favicon stays at `app/favicon.ico`, the
 * Next.js App Router convention. Forks replace that file's contents in place
 * rather than routing it through this module.
 */
import { getAppName } from "@wildfires-org/turboplan-env";

/**
 * Optional built-in theme, chosen at build time by `NEXT_PUBLIC_BRAND_THEME`.
 * `wildfires` gives the Wildfires.org look (logo, colors, type) used by
 * demo.wildfires.org; unset keeps the default TurboPlan look. The colors and
 * type live in `tailwind.config.ts` and `app/brand-wildfires.css`.
 */
export const brandTheme =
  process.env.NEXT_PUBLIC_BRAND_THEME === "wildfires" ? "wildfires" : undefined;

const assets =
  brandTheme === "wildfires"
    ? {
        logo: "/brand/wildfires/logo.png",
        ogImage: "/brand/wildfires/og-image.jpg",
      }
    : { logo: "/brand/logo.png", ogImage: "/brand/og-image.png" };

export const brand = {
  /** Display name — alt text, page titles, sidebar wordmark. */
  name: getAppName(),
  /** Square mark shown in the sidebar, auth pages and error pages. */
  logo: assets.logo,
  /** Social sharing card, 1200x630. */
  ogImage: assets.ogImage,
} as const;
