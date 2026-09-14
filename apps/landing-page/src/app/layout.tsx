import { Suspense } from "react";

import * as dotenv from "dotenv";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { SessionProvider } from "@wildfires-org/turboplan-auth/client";
import { getSession } from "@wildfires-org/turboplan-auth/session";
import { getLandingPageEnv } from "@wildfires-org/turboplan-env";

import LayoutWrapper from "@/app/layoutWrapper";
import { Navbar } from "@/components/home-v2/navbar";
import { SiteFooter } from "@/components/home-v2/site-footer";
import { GoogleAnalytics } from "@/components/providers/google-analytics";
import { PostHogProvider } from "@/components/providers/posthog-provider";
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
dotenv.config();

const geist = localFont({
  src: [
    {
      path: "../../public/fonts/Geist-Thin.woff2",
      style: "normal",
      weight: "100",
    },
    {
      path: "../../public/fonts/Geist-ExtraLight.woff2",
      style: "normal",
      weight: "200",
    },
    {
      path: "../../public/fonts/Geist-Light.woff2",
      style: "normal",
      weight: "300",
    },
    {
      path: "../../public/fonts/Geist-Regular.woff2",
      style: "normal",
      weight: "400",
    },
    {
      path: "../../public/fonts/Geist-Medium.woff2",
      style: "normal",
      weight: "500",
    },
    {
      path: "../../public/fonts/Geist-SemiBold.woff2",
      style: "normal",
      weight: "600",
    },
    {
      path: "../../public/fonts/Geist-Bold.woff2",
      style: "normal",
      weight: "700",
    },
    {
      path: "../../public/fonts/Geist-ExtraBold.woff2",
      style: "normal",
      weight: "800",
    },
    {
      path: "../../public/fonts/Geist-Black.woff2",
      style: "normal",
      weight: "900",
    },
  ],
  variable: "--font-geist",
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

/**
 * Minimal loading fallback shown during static generation.
 * Does NOT render children since they may depend on NuqsAdapter context.
 * Content appears immediately after hydration.
 */
function LayoutFallback() {
  return (
    <div className="min-h-screen flex flex-col justify-between">
      <main className="relative flex w-full justify-center">
        <div className="flex w-screen 2xl:max-w-3xl px-5 lg:px-10 xl:px-[100px] 3xl:max-w-3xl justify-center flex-col">
          {/* Loading placeholder - content renders after hydration */}
        </div>
      </main>
    </div>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get session server-side to pass to client components
  const session = await getSession();
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
        <PostHogProvider />
        {/* RootProvider supplies Fumadocs' search context for the /docs route.
            Purely additive — it wraps the existing session/analytics stack
            without altering its order.
            theme.enabled=false disables next-themes entirely: this app has no
            dark-mode design system (global Navbar/SiteFooter/home are light-only),
            so we never render the ThemeProvider and the `dark` class is never
            applied — not even from OS-level prefers-color-scheme. */}
        <RootProvider theme={{ enabled: false }}>
          <Suspense fallback={<LayoutFallback />}>
            <NuqsAdapter>
              <SessionProvider session={session}>
                <AnalyticsContextProvider>
                  <GlobalProvider>
                    <div className="min-h-screen flex flex-col justify-between">
                      <Navbar />
                      <main className="relative flex w-full flex-1 justify-center">
                        <LayoutWrapper>{children}</LayoutWrapper>
                      </main>
                      <SiteFooter />
                    </div>
                  </GlobalProvider>
                  <Suspense>
                    <InitializeAnalyticsContext />
                  </Suspense>
                </AnalyticsContextProvider>
              </SessionProvider>
            </NuqsAdapter>
          </Suspense>
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
