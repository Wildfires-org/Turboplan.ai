import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";

import { PostHogProvider } from "@/components/providers/posthog-provider";
import { ReleaseInfoLogger } from "@/components/release-info-logger";
import { ThemeProvider } from "@/components/theme-provider";
import { brand } from "@/lib/brand";

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
  return (
    <html
      lang="en"
      // `next-themes` injects an extra classname to the body element to avoid
      // visual flicker before hydration. Hence the `suppressHydrationWarning`
      // prop is necessary to avoid the React hydration mismatch warning.
      // https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable}`}
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
              <Toaster position="top-center" />
              {children}
            </ThemeProvider>
          </NuqsAdapter>
        </PostHogProvider>
      </body>
    </html>
  );
}
