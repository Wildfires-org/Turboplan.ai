/**
 * Hosted image URLs for email templates.
 * Images are served from the Next.js public directory.
 */

const getBaseUrl = () =>
  process.env.TURBOPLAN_URL || process.env.NEXT_PUBLIC_TURBOPLAN_URL || "";

/** 32x32 beaver logo for the email header */
export const getLogoUrl = () => `${getBaseUrl()}/images/email/logo-beaver.png`;

/** Beaver mascot for the card's hero band */
export const getBeaverUrl = () =>
  `${getBaseUrl()}/images/email/beaver-mascot.png`;
