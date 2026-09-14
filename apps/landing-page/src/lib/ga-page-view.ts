// GA4's automatic page_view reports page_location = the full URL, query string
// included. Campaign links land on the site with ?utm_email=<address>&utm_uid=…
// (see src/context/analytics.tsx) and the signup modal reads ?email=, so the
// automatic hit would ship an email address to Google Analytics. The
// GoogleAnalytics component turns that hit off and emits page_view itself with
// the params built here — redacted by the same helper PostHog's
// sanitize_properties is wired to.

import { redactUrl } from "./posthog-sanitize";

export type GaPageViewParams = {
  page_location: string;
  page_referrer?: string;
};

export const buildPageViewParams = (
  href: string,
  referrer: string,
): GaPageViewParams => ({
  page_location: redactUrl(href),
  // An empty referrer stays absent: sending page_referrer: "" would override
  // GA's own handling with a meaningless param.
  ...(referrer ? { page_referrer: redactUrl(referrer) } : {}),
});
