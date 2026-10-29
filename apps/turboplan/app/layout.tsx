import { AlertTriangle, Check, Info } from "lucide-react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";

import { getAuthCookieDomain } from "@wildfires-org/turboplan-env";
import {
  UI_SCALE_COOKIE_NAME,
  uiScaleStyleFromCookie,
} from "@wildfires-org/turboplan-utils/server";

import { PostHogProvider } from "@/components/providers/posthog-provider";
import { UiScaleProvider } from "@/components/providers/ui-scale-provider";
import { ReleaseInfoLogger } from "@/components/release-info-logger";
import { ThemeProvider } from "@/components/theme-provider";
import { brand } from "@/lib/brand";
import { TOAST_ICON_CLASS, TOAST_SURFACE_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

import "./globals.css";

const APP_TITLE = brand.name;
const APP_TAGLINE = "AI Environmental Planning Platform";
const APP_DESCRIPTION =
  "An open source AI environmental planning platform — plan projects in minutes instead of months.";

export const metadata: Metadata = {
  metadataBase: new URL(
    // Required by turboplan-env; the localhost fallback only keeps a
    // misconfigured local build from crashing at module scope.
    process.env.NEXT_PUBLIC_TURBOPLAN_URL || "http://localhost:3000",
  ),
  title: {
    default: `${APP_TITLE} | ${APP_TAGLINE}`,
    template: `%s | ${APP_TITLE}`,
  },
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

export const viewport = {
  maximumScale: 1, // Disable auto-zoom on mobile Safari
};

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

const ENVIRONMENTAL_THEME_COLOR = "hsl(90 25% 98%)"; // Light sage green from our theme
const DARK_THEME_COLOR = "hsl(240deg 10% 3.92%)";
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var theme = html.getAttribute('data-theme');
    if (theme === 'environmental') {
      meta.setAttribute('content', '${ENVIRONMENTAL_THEME_COLOR}');
    } else if (theme === 'dark') {
      meta.setAttribute('content', '${DARK_THEME_COLOR}');
    } else {
      meta.setAttribute('content', '${ENVIRONMENTAL_THEME_COLOR}');
    }
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
  updateThemeColor();
})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `AUTH_COOKIE_DOMAIN` is server-only (no NEXT_PUBLIC_ twin), so this layout
  // reads it and hands it to the client provider that writes the cookie.
  // Unset in local dev — both apps already share the `localhost` host.
  const uiScaleCookieDomain = getAuthCookieDomain();

  // Rendered onto <html> so the first paint is already at the user's scale.
  const cookieStore = await cookies();
  const uiScaleStyle = uiScaleStyleFromCookie(
    cookieStore.get(UI_SCALE_COOKIE_NAME)?.value,
  );

  return (
    <html
      lang="en"
      // `next-themes` injects an extra classname to the body element to avoid
      // visual flicker before hydration. Hence the `suppressHydrationWarning`
      // prop is necessary to avoid the React hydration mismatch warning.
      // https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable}`}
      style={uiScaleStyle as React.CSSProperties}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
      </head>
      <body className="antialiased">
        <ReleaseInfoLogger />
        <PostHogProvider>
          <NuqsAdapter>
            <ThemeProvider
              defaultTheme="light"
              enableSystem={false}
              disableTransitionOnChange
            >
              <UiScaleProvider cookieDomain={uiScaleCookieDomain}>
                <Toaster
                  position="top-center"
                  // Direct sonner calls (toast.success etc.) get the same
                  // glass surface as our custom `toast()`.
                  icons={{
                    success: <Check aria-hidden strokeWidth={2.5} />,
                    error: <AlertTriangle aria-hidden />,
                    warning: <AlertTriangle aria-hidden />,
                    info: <Info aria-hidden />,
                  }}
                  toastOptions={{
                    unstyled: true,
                    classNames: {
                      toast: cn(TOAST_SURFACE_CLASS, "w-full"),
                      icon: cn(
                        TOAST_ICON_CLASS,
                        "bg-brand-50 text-brand-800 ring-brand-800/15",
                      ),
                      error:
                        "[&_[data-icon]]:bg-error-50 [&_[data-icon]]:text-error-700 [&_[data-icon]]:ring-error-700/15",
                      warning:
                        "[&_[data-icon]]:bg-amber-50 [&_[data-icon]]:text-amber-700 [&_[data-icon]]:ring-amber-700/15",
                      description: "text-xs text-gray-550",
                      actionButton:
                        "ml-auto rounded-lg px-2 py-1 text-xs font-medium text-brand-800 hover:bg-brandAlt-100",
                      cancelButton:
                        "rounded-lg px-2 py-1 text-xs font-medium text-gray-550 hover:bg-brandAlt-100",
                    },
                  }}
                />
                {children}
              </UiScaleProvider>
            </ThemeProvider>
          </NuqsAdapter>
        </PostHogProvider>
      </body>
    </html>
  );
}
