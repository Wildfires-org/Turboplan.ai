/**
 * Hosted image URLs for email templates.
 * Images are served from the Next.js public directory.
 */

const getBaseUrl = () =>
  process.env.TURBOPLAN_URL || process.env.NEXT_PUBLIC_TURBOPLAN_URL || "";

/** 32x32 beaver logo for the email header */
export const getLogoUrl = () => `${getBaseUrl()}/images/email/logo-beaver.png`;

/** 120x120 beaver mascot for email body */
export const getBeaverUrl = () =>
  `${getBaseUrl()}/images/email/beaver-mascot.png`;

/** 96x96 hand icon (rendered at 12x12) for the greeting pill */
export const getHandIconUrl = () =>
  `${getBaseUrl()}/images/email/hand-icon.png`;
