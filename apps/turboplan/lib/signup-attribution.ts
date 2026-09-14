import { z } from "zod";

/**
 * Signup attribution carried on the landing-page -> /self-service handoff URL.
 *
 * The landing page appends the visitor's anonymous PostHog distinct id
 * (`ph_did`) plus the campaign params it saw. Threading them into the signup
 * server action lets us (a) alias the anonymous person onto the freshly created
 * user id, so pre-signup events join the funnel, and (b) stamp campaign person
 * properties at the moment the account is born.
 *
 * These values are attacker-controllable query params, so every field is
 * validated and length-capped, and a field that fails validation is silently
 * dropped rather than failing the signup.
 */

/** Contract with the landing page. Do not rename without updating both sides. */
export const ATTRIBUTION_PARAMS = [
  "ph_did",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
] as const;

export type AttributionParam = (typeof ATTRIBUTION_PARAMS)[number];

/** Campaign params only — `ph_did` is an identity, not a person property. */
const CAMPAIGN_PARAMS = ATTRIBUTION_PARAMS.filter(
  (param) => param !== "ph_did",
);

/**
 * PostHog caps distinct ids at 200 chars; campaign values are capped at the
 * same order of magnitude so a hostile URL can't bloat every person record.
 */
const MAX_VALUE_LENGTH = 200;

/** C0 controls + DEL — header/log injection vectors in a value we echo out. */
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

/**
 * Per-field `.catch(undefined)`: one malformed param must never reject the
 * whole signup payload, it just drops that param.
 */
const attributionValue = z
  .string()
  .trim()
  .min(1)
  .max(MAX_VALUE_LENGTH)
  .refine((value) => !CONTROL_CHARACTERS.test(value), {
    message: "must not contain control characters",
  })
  .optional()
  .catch(undefined);

export const signupAttributionSchema = z.object({
  ph_did: attributionValue,
  utm_source: attributionValue,
  utm_medium: attributionValue,
  utm_campaign: attributionValue,
  utm_term: attributionValue,
  utm_content: attributionValue,
  gclid: attributionValue,
});

export type SignupAttribution = z.infer<typeof signupAttributionSchema>;

/** Minimal shape shared by URLSearchParams and Next's ReadonlyURLSearchParams. */
type ParamReader = { get: (key: string) => string | null };

/**
 * Reads + validates the attribution params from any search-param-like source.
 * Returns `undefined` when nothing usable is present, so callers can omit the
 * field entirely instead of shipping an empty object around.
 */
export const parseSignupAttribution = (
  params: ParamReader,
): SignupAttribution | undefined => {
  const raw: Record<string, string> = {};
  for (const param of ATTRIBUTION_PARAMS) {
    const value = params.get(param);
    if (value) {
      raw[param] = value;
    }
  }

  const parsed = signupAttributionSchema.parse(raw);
  const hasValue = Object.values(parsed).some((value) => value !== undefined);
  return hasValue ? parsed : undefined;
};

/**
 * Copies the attribution params onto an outgoing URL so they survive a
 * redirect (e.g. self-service -> login -> back to self-service).
 */
export const appendAttributionParams = (
  target: URLSearchParams,
  attribution: SignupAttribution | undefined,
) => {
  if (!attribution) {
    return target;
  }
  for (const param of ATTRIBUTION_PARAMS) {
    const value = attribution[param];
    if (value) {
      target.set(param, value);
    }
  }
  return target;
};

/**
 * Builds the PostHog properties for the signup capture:
 * - flat `utm_*`/`gclid` for event-level breakdowns,
 * - `$set` so the person's campaign props reflect this signup,
 * - `$set_once` under PostHog's native `$initial_*` names, so first-touch
 *   attribution survives every later touch and merges with what the
 *   client-side SDK records.
 */
export const buildAttributionEventProperties = (
  attribution: SignupAttribution | undefined,
): Record<string, unknown> => {
  if (!attribution) {
    return {};
  }

  const set: Record<string, string> = {};
  const setOnce: Record<string, string> = {};
  for (const param of CAMPAIGN_PARAMS) {
    const value = attribution[param];
    if (!value) {
      continue;
    }
    set[param] = value;
    setOnce[`$initial_${param}`] = value;
  }

  if (Object.keys(set).length === 0) {
    return {};
  }

  return { ...set, $set: set, $set_once: setOnce };
};
