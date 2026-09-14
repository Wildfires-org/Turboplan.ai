/**
 * Resolves the Next.js `metadataBase` from the LANDING_URL env value.
 * Accepts values without a scheme (e.g. "example.com") and never throws —
 * a malformed value falls back to undefined instead of crashing the app
 * at module initialization.
 */
export const resolveMetadataBase = (landingUrl: string): URL | undefined => {
  if (!landingUrl) {
    return undefined;
  }

  const withScheme = /^https?:\/\//.test(landingUrl)
    ? landingUrl
    : `https://${landingUrl}`;

  try {
    return new URL(withScheme);
  } catch {
    console.warn(
      `Invalid LANDING_URL value "${landingUrl}" — metadataBase left unset`,
    );
    return undefined;
  }
};
