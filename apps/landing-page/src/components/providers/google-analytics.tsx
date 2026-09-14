"use client";

import { useEffect } from "react";

import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";

import { buildPageViewParams } from "@/lib/ga-page-view";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

interface GoogleAnalyticsProps {
  gaId: string;
}

/**
 * Stands in for @next/third-parties' <GoogleAnalytics>, which hardcodes
 * `gtag('config', id)` and so fires GA4's automatic page_view with
 * page_location = window.location.href — leaking ?utm_email= / ?email= to
 * Google. Here the automatic hit is disabled and page_view is emitted manually
 * with the URL and referrer redacted, on first load and on every SPA route
 * change.
 */
export const GoogleAnalytics = ({ gaId }: GoogleAnalyticsProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Bootstrapped from an effect rather than an inline script so it is
  // guaranteed to run before the page_view effect below — anything queued
  // ahead of `config` is dropped by gtag.js.
  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    if (window.gtag) {
      return;
    }
    window.gtag = function gtag() {
      // gtag.js reads queued entries as Arguments objects; pushing a plain
      // array is not equivalent, so this cannot be an arrow function.
      window.dataLayer?.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", gaId, { send_page_view: false });
  }, [gaId]);

  useEffect(() => {
    const params = buildPageViewParams(window.location.href, document.referrer);
    // `set` makes the redacted values the default for every later hit too —
    // without it gtag re-reads location.href per event and the PII comes back.
    window.gtag?.("set", params);
    window.gtag?.("event", "page_view", params);
  }, [pathname, searchParams]);

  return (
    <Script
      id="_next-ga"
      src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
    />
  );
};
