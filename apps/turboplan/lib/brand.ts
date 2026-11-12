/**
 * Branding override surface for the main app.
 *
 * The app carries the Wildfires.org brand: this module and
 * `public/brand/wildfires/` hold the logo, the wordmark (the signed-out entry
 * page header) and the OG image; `app/favicon.ico` is the favicon,
 * `tailwind.config.ts` holds the color scales (`brand` orange, `brandAlt`
 * forest and cream) and `app/brand-wildfires.css` the type. The display name
 * comes from `NEXT_PUBLIC_APP_NAME`.
 *
 * A downstream fork rebrands by replacing the *contents* of these files at
 * the same paths, keeping the export shape intact — so upstream merges never
 * conflict. The repo-root `.gitattributes` already marks `public/brand/**` and
 * this file `merge=ours`; the attribute is inert until the fork enables the
 * driver (once per clone, and --local only — a global driver would silently
 * keep "ours" in every repo):
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

export const brand = {
  /** Display name — alt text, page titles, sidebar wordmark. */
  name: getAppName(),
  /** Square mark shown in the sidebar, the auth, signup and error screens
   * and the project setup banner. */
  logo: "/brand/wildfires/logo.png",
  /** Social sharing card, 1200x630. */
  ogImage: "/brand/wildfires/og-image.jpg",
} as const;
