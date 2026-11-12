/**
 * Wildfires.org palette for email templates.
 *
 * Emails can't load the app's CSS, so the brand colors live here as plain
 * hex values. Forest is the action color (button, links), orange is the
 * logo and the warning tone, cream and sage are the surfaces and borders.
 */
export const emailColors = {
  /** Page background behind the card (cream 100) */
  page: "#FBFAF8",
  /** Brand hero band at the top of the card (warm cream) */
  cream: "#F3F1EC",
  /** Card border, dividers, brand eyebrow background (sage, forest 200) */
  sage: "#E4E8E2",
  /** App name, brand eyebrow text, links, solid button fallback */
  forest: "#1A3B21",
  /** Warning hero band (orange 50) */
  orange50: "#FFF5EB",
  /** Warning eyebrow background (orange 100) */
  orange100: "#FFE6CC",
  /** Warning eyebrow text (orange 800, 5.2:1 on orange 100) */
  orange800: "#9A4A00",
  /** Danger eyebrow */
  dangerBg: "#FDECEC",
  dangerText: "#B42318",
} as const;

/**
 * Filled CTA gradient, the same stops and angle as the app's Wildfires
 * `btn-primary`. Clients without gradient support (Outlook) fall back to the
 * solid `emailColors.forest` background.
 */
export const ctaGradient =
  "linear-gradient(135deg, #2a5a33 0%, #1a3b21 30%, #152f1a 65%, #0f2314 100%)";
