// Shared PII redaction for PostHog client events. Pure module — unit-tested;
// the provider wires it into posthog.init.

// Autocaptured URLs can carry PII/secrets in query params (check-email?email=,
// magic-link ?token=, login ?callbackUrl=/invite/…, and the magic link's
// ?redirectTo=, which carries an encoded workspace path). Redact them from
// every URL-shaped property before send.
const SENSITIVE_URL_PARAM_PATTERN =
  /(^|[?&#])([^&#=]*(?:token|code|key|secret|signature|email|callback|redirect)[^&#=]*)=[^&#\s]*/gi;

// An invite link is a bearer credential in the PATH (/invite/<token>, raw or
// URL-encoded inside another URL), so the query redaction never sees it.
const INVITE_TOKEN_PATH_PATTERN = /(\/|%2F)invite(\/|%2F)[^/?&#\s]+/gi;

export const redactUrl = (value: string): string =>
  value
    .replace(SENSITIVE_URL_PARAM_PATTERN, "$1$2=[redacted]")
    .replace(INVITE_TOKEN_PATH_PATTERN, "$1invite$2[redacted]");

export const sanitizeProperties = (
  properties: Record<string, unknown>,
): Record<string, unknown> => {
  for (const [prop, value] of Object.entries(properties)) {
    const propName = prop.toLowerCase();
    if (
      typeof value === "string" &&
      (propName.includes("url") ||
        propName.includes("pathname") ||
        propName.includes("referrer"))
    ) {
      properties[prop] = redactUrl(value);
    }
  }
  return properties;
};
