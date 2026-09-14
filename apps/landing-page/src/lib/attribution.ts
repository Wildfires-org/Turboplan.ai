// Marketing attribution params. These names are a contract with the web app —
// the signup hand-off URL forwards them verbatim to /self-service, so the app
// can attribute a signup to the campaign that produced the landing visit.
// Do not rename.
export const ATTRIBUTION_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
] as const;

export type AttributionParam = (typeof ATTRIBUTION_PARAMS)[number];

type ReadableParams = Pick<URLSearchParams, "get">;

/**
 * sessionStorage can throw on ACCESS (not just setItem) when the browser
 * blocks site data — Chrome's "block all cookies", some embedded webviews.
 * Attribution is best-effort and must never break the signup path, so every
 * touch goes through this guard.
 */
const safeSessionStorage = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/**
 * Persist attribution params to sessionStorage on first landing so they survive
 * in-site navigation (the visitor rarely signs up on the URL they arrived on).
 * Values already stored are never overwritten — the first touch of the session
 * wins, matching how the campaign user id is persisted.
 */
export const persistAttributionParams = (searchParams: ReadableParams) => {
  if (typeof window === "undefined") {
    return;
  }

  const storage = safeSessionStorage();
  if (!storage) {
    return;
  }

  for (const key of ATTRIBUTION_PARAMS) {
    const value = searchParams.get(key);
    if (!value) {
      continue;
    }
    try {
      if (storage.getItem(key)) {
        continue;
      }
      storage.setItem(key, value);
    } catch {
      // Quota exhausted or storage revoked mid-loop — drop the param.
    }
  }
};

/**
 * Read attribution params, preferring the current URL and falling back to the
 * values persisted on first landing. Only params with a value are returned.
 */
export const getAttributionParams = (
  searchParams?: ReadableParams,
): Partial<Record<AttributionParam, string>> => {
  const result: Partial<Record<AttributionParam, string>> = {};
  const storage = typeof window === "undefined" ? null : safeSessionStorage();

  for (const key of ATTRIBUTION_PARAMS) {
    let value = searchParams?.get(key) || null;
    if (!value && storage) {
      try {
        value = storage.getItem(key);
      } catch {
        value = null;
      }
    }

    if (value) {
      result[key] = value;
    }
  }

  return result;
};
