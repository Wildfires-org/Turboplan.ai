/**
 * Storage keys of documents a visitor attached to the landing-page prompt
 * ride the landing-page -> /self-service handoff URL as one
 * `LANDING_UPLOADS_PARAM` per key.
 *
 * The keys are untrusted input; the self-service actions re-validate them
 * server-side before turning them into project documents.
 */
import {
  LANDING_UPLOADS_PARAM,
  MAX_LANDING_UPLOADS,
  parseLandingUploadKey,
} from "@wildfires-org/turboplan-upload/types";

type ParamReader = Pick<URLSearchParams, "getAll">;

/**
 * The landing upload keys on a URL, or undefined when there are none. Capped
 * at what the self-service schema accepts, so a hand-edited URL with extra
 * keys drops them instead of failing the whole signup.
 */
export const parseLandingUploadKeys = (
  params: ParamReader,
): string[] | undefined => {
  const keys = [...new Set(params.getAll(LANDING_UPLOADS_PARAM))]
    .filter(Boolean)
    .slice(0, MAX_LANDING_UPLOADS);
  return keys.length > 0 ? keys : undefined;
};

/**
 * Copies the landing upload keys onto an outgoing URL so they survive a
 * redirect (e.g. self-service -> login -> back to self-service).
 */
export const appendLandingUploadParams = (
  target: URLSearchParams,
  keys: string[] | undefined,
) => {
  for (const key of keys ?? []) {
    target.append(LANDING_UPLOADS_PARAM, key);
  }
  return target;
};

/**
 * The visitor's filenames, read from the keys, for showing what a link would
 * attach before anything is claimed. Keys that are not landing upload keys
 * are left out; the server skips them too.
 */
export const getLandingUploadNames = (keys: string[] | undefined): string[] => {
  return (keys ?? []).flatMap((key) => {
    const landingKey = parseLandingUploadKey(key);
    return landingKey ? [landingKey.originalFilename] : [];
  });
};

/**
 * Whether /self-service must wait for the user to submit instead of
 * auto-submitting. Anyone can put staged upload keys on a link, so a signed-in
 * user confirms the listed files rather than having them added to a new
 * project silently. Signed-out visitors keep the automatic landing-page
 * handoff: it never writes into an existing account (a registered email is
 * sent to log in first, and then lands here signed in).
 */
export const requiresLandingUploadConfirmation = (
  isAuthenticated: boolean,
  keys: string[] | undefined,
): boolean => {
  return isAuthenticated && getLandingUploadNames(keys).length > 0;
};
