export const PROJECT_TITLE_PARAM = "projectTitle";
export const PROJECT_DESCRIPTION_PARAM = "projectDescription";
export const ORGANIZATION_NAME_PARAM = "organizationName";
export const ORGANIZATION_ID_PARAM = "organizationId";
export const OFFICE_ID_PARAM = "officeId";
export const USER_ROLE_PARAM = "userRole";
export const CONTEXT_RESOURCES_PARAM = "contextResources[]";
export const EMAIL_PARAM = "email";
// PostHog distinct id forwarded to the app so the landing-page session and the
// post-signup app session stitch into one person. Contract with the app side —
// do not rename.
export const POSTHOG_DISTINCT_ID_PARAM = "ph_did";

export const clearUrlParams = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete(PROJECT_TITLE_PARAM);
  url.searchParams.delete(PROJECT_DESCRIPTION_PARAM);
  url.searchParams.delete(ORGANIZATION_NAME_PARAM);
  url.searchParams.delete(ORGANIZATION_ID_PARAM);
  url.searchParams.delete(OFFICE_ID_PARAM);
  url.searchParams.delete(USER_ROLE_PARAM);
  url.searchParams.delete(CONTEXT_RESOURCES_PARAM);
  url.searchParams.delete(EMAIL_PARAM);
  window.history.replaceState(null, "", url.toString());
};
