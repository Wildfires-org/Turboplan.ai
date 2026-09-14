/**
 * Extract the lowercased domain portion of an email address.
 *
 * Uses the substring after the LAST "@" so quoted/edge-case local parts that
 * themselves contain an "@" don't yield the wrong domain. Returns undefined when
 * the email is missing, has no "@", or has an empty domain.
 */
export function getEmailDomain(
  email: string | null | undefined,
): string | undefined {
  if (!email) return undefined;
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) return undefined;
  const domain = email
    .slice(atIndex + 1)
    .toLowerCase()
    .trim();
  return domain || undefined;
}

/**
 * Check if an email address is a government email (.gov domain)
 */
export function isGovEmail(email: string | null | undefined): boolean {
  const domain = getEmailDomain(email);
  return domain?.endsWith(".gov") ?? false;
}

/**
 * Check whether an email's domain matches any of the provided organization
 * email domains. Matching is case-insensitive and covers subdomains: a
 * configured domain matches the email's exact domain OR any subdomain of it
 * (e.g. "jane@fs.usda.gov" matches ["usda.gov"], and "jane@usda.gov" also
 * matches ["usda.gov"]).
 */
export function emailMatchesDomains(
  email: string | null | undefined,
  domains: string[] | undefined | null,
): boolean {
  const domain = getEmailDomain(email);
  if (!domain || !domains?.length) return false;
  return domains.some((d) => {
    const dd = d.toLowerCase().trim();
    if (!dd) return false;
    return dd === domain || domain.endsWith(`.${dd}`);
  });
}

/**
 * Free/public email providers that must never be configured as an
 * organization's affiliation domain — otherwise anyone with a free mailbox
 * would be auto-affiliated with the org (elevated role + viewer access on
 * every matching signup). This is a write-time tripwire for the catastrophic
 * mass-scale case, NOT an exhaustive list of free providers — these ~16
 * domains cover the vast majority of consumer mailboxes, and blast radius
 * scales with provider popularity, so blocking the long tail buys little.
 * Compared case-insensitively against the normalized (lowercased + trimmed)
 * domains.
 */
export const PUBLIC_EMAIL_PROVIDERS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
  "zoho.com",
]);

/**
 * Matches a single bare email domain: a hostname like "usda.gov" or
 * "sub.jacobs.com". Case-insensitive; callers normalize to lowercase before
 * persisting.
 */
export const EMAIL_DOMAIN_REGEX = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i;

/**
 * Normalize (lowercase + trim) a list of email domains and reject any that are
 * public email providers. Returns either the cleaned list or an error string
 * naming the first rejected domain.
 */
export const normalizeEmailDomains = (
  domains: string[],
): { ok: true; domains: string[] } | { ok: false; error: string } => {
  const normalized = domains.map((d) => d.toLowerCase().trim());
  for (const domain of normalized) {
    if (PUBLIC_EMAIL_PROVIDERS.has(domain)) {
      return {
        ok: false,
        error: `"${domain}" is a public email provider and cannot be used as an organization email domain.`,
      };
    }
  }
  return { ok: true, domains: normalized };
};
