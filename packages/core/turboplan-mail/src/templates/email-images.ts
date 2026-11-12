/**
 * Hosted image URLs for email templates.
 * Images are served from the Next.js public directory.
 */

const getBaseUrl = () =>
  process.env.TURBOPLAN_URL || process.env.NEXT_PUBLIC_TURBOPLAN_URL || "";

/** Wildfires.org mark for the email header: 56x56 PNG, shown at 28px */
export const getLogoUrl = () => `${getBaseUrl()}/images/email/logo.png`;

/** Wildfires.org mark for the card's hero band: 128x128 PNG, shown at 64px */
export const getHeroLogoUrl = () =>
  `${getBaseUrl()}/images/email/logo-hero.png`;
