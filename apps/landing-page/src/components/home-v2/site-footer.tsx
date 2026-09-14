"use client";

import { usePathname } from "next/navigation";

import { Footer } from "./footer";

/**
 * Global footer for all routes except home — the home page renders the
 * footer itself inside CtaBottom (animated, per the home-page design).
 */
export function SiteFooter() {
  const pathname = usePathname();

  if (pathname === "/") {
    return null;
  }

  return <Footer />;
}
