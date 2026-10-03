import { Suspense } from "react";

import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata, Viewport } from "next";
import { Geist, Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { getLandingPageEnv } from "@wildfires-org/turboplan-env";

import LayoutWrapper from "@/app/layoutWrapper";
import { Navbar } from "@/components/home-v2/navbar";
import { SiteFooter } from "@/components/home-v2/site-footer";
import { ClientSessionProvider } from "@/components/providers/client-session-provider";
import { GoogleAnalytics } from "@/components/providers/google-analytics";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { UiScaleSync } from "@/components/providers/ui-scale-sync";
import { ReleaseInfoLogger } from "@/components/release-info-logger";
import { Toaster } from "@/components/ui/toaster";
import AnalyticsContextProvider, {
  InitializeAnalyticsContext,
} from "@/context/analytics";
import GlobalProvider from "@/context/global";
import { brand } from "@/lib/brand";
import { resolveMetadataBase } from "@/lib/metadata-base";
import { cn } from "@/lib/utils";
import "../globals.css";

// One variable file per family (latin only). The nine static Geist weights
// this replaced were all preloaded, 375 KB that held up first paint on phones.
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// NEXT_PUBLIC_ vars must be referenced statically so Next.js inlines them at
// build time. No measurement ID → the GA4 script is never rendered, so local
// dev and any environment that leaves this unset stay untracked. Use a
// separate measurement ID per environment (production vs develop).
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const APP_TITLE = brand.name;
const APP_TAGLINE = "AI Environmental Planning Platform";
const APP_DESCRIPTION =
  "An open source AI environmental planning platform — plan projects in minutes instead of months.";

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(getLandingPageEnv().LANDING_URL),
  title: `${APP_TITLE} | ${APP_TAGLINE}`,
  description: APP_DESCRIPTION,
  // public/favicon.ico holds 16, 32 and 48px images.
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "16x16 32x32 48x48" }],
  },
  openGraph: {
    title: APP_TAGLINE,
    description: APP_DESCRIPTION,
    siteName: APP_TITLE,
    type: "website",
    images: [{ url: brand.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_TITLE} | ${APP_TAGLINE}`,
    description: APP_DESCRIPTION,
    images: [brand.ogImage],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // No cookies or session here: reading either makes every marketing page
  // dynamic and uncacheable. The session loads client-side
  // (ClientSessionProvider) and UiScaleSync applies the app's UI-scale cookie
  // after hydration.
  // Signup hands off to the app origin via a full navigation; warm up DNS/TLS
  // so that cross-origin jump starts faster.
  const appOrigin = new URL(getLandingPageEnv().TURBOPLAN_URL).origin;

  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <meta name="theme-color" content="#f4f9f7" />
      <link rel="preconnect" href={appOrigin} />
      <body
        className={cn(
          geist.variable,
          inter.variable,
          "bg-brandAlt-100 font-geist min-h-screen flex flex-col justify-between overflow-x-hidden",
        )}
      >
        <ReleaseInfoLogger />
        <UiScaleSync />
        <PostHogProvider />
        {/* RootProvider supplies Fumadocs' search context for the /docs route.
            Purely additive — it wraps the existing session/analytics stack
            without altering its order.
            theme.enabled=false disables next-themes entirely: this app has no
            dark-mode design system (global Navbar/SiteFooter/home are light-only),
            so we never render the ThemeProvider and the `dark` class is never
            applied — not even from OS-level prefers-color-scheme.
            No Suspense around the page: a boundary here flushes a 200 before
            the page runs, so its notFound() can no longer send a 404. A
            component that reads search params wraps itself instead (the
            build fails on a statically prerendered page that doesn't). */}
        <RootProvider theme={{ enabled: false }}>
          <NuqsAdapter>
            <ClientSessionProvider>
              <AnalyticsContextProvider>
                <GlobalProvider>
                  <div className="min-h-screen flex flex-col justify-between">
                    <a
                      href="#main-content"
                      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-inter focus:text-[14px] focus:text-egray-900 focus:shadow-lg"
                    >
                      Skip to content
                    </a>
                    <Navbar />
                    <main
                      id="main-content"
                      className="relative flex w-full flex-1 justify-center"
                    >
                      <LayoutWrapper>{children}</LayoutWrapper>
                    </main>
                    <SiteFooter />
                  </div>
                </GlobalProvider>
                <Suspense>
                  <InitializeAnalyticsContext />
                </Suspense>
              </AnalyticsContextProvider>
            </ClientSessionProvider>
          </NuqsAdapter>
        </RootProvider>
        <Toaster />
        {/* Suspense boundary required: GoogleAnalytics reads useSearchParams
            to re-emit page_view on SPA navigation. */}
        {GA_MEASUREMENT_ID && (
          <Suspense>
            <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />
          </Suspense>
        )}
      </body>
    </html>
  );
}
