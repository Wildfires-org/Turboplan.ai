import { withSentryConfig } from "@sentry/nextjs";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

// R2 cover images may live across multiple public buckets (the turboplan app
// and the server image-gen service use different ones). R2_PUBLIC_URL accepts a
// comma-separated list of bucket URLs so each app can allowlist every R2 host
// it renders.
const r2Hostnames = (process.env.R2_PUBLIC_URL ?? "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean)
  .map((url) => new URL(url).hostname);

const allowedHostnames = [...r2Hostnames];

// Exact hostnames only — Next.js Image optimizes (WebP + responsive srcSet)
// allowlisted hosts but skips wildcards. R2-hosted cover images therefore
// require `R2_PUBLIC_URL` to point at the bucket's public URL.
const remotePatterns = allowedHostnames.map((hostname) => ({ hostname }));

const isProduction = process.env.NODE_ENV === "production";

// Origin of an absolute URL, or null for relative/invalid values (e.g. a
// PostHog host of "/ingest" is already covered by 'self').
const toOrigin = (url: string | undefined) => {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

const r2Origins = (process.env.R2_PUBLIC_URL ?? "")
  .split(",")
  .map((url) => toOrigin(url.trim()))
  .filter((origin): origin is string => Boolean(origin));

const cspSources = (...sources: Array<string | null | false>) =>
  sources.filter(Boolean).join(" ");

// Report-only for now: violations surface in the browser console without
// breaking anything. Tighten and promote to an enforced policy once clean.
// Host lists are env-driven where the host is deployment-specific; values are
// baked in at build time, like the image remotePatterns above.
const contentSecurityPolicyReportOnly = [
  "default-src 'self'",
  // Next.js needs inline scripts (no nonce pipeline yet); dev needs eval for
  // React Refresh. gtag.js loads from Google Tag Manager.
  `script-src ${cspSources(
    "'self'",
    "'unsafe-inline'",
    !isProduction && "'unsafe-eval'",
    "https://www.googletagmanager.com",
  )}`,
  // Next.js, Leaflet and framer-motion all write inline styles.
  "style-src 'self' 'unsafe-inline'",
  `img-src ${cspSources(
    "'self'",
    "data:",
    "blob:",
    ...r2Origins,
    // Public images can come from any of our r2.dev buckets (e.g. org logos
    // written by the MCP server), not only the ones listed in R2_PUBLIC_URL.
    "https://*.r2.dev",
    "https://*.tile.openstreetmap.org",
    "https://*.tile.opentopomap.org",
    "https://server.arcgisonline.com",
    "https://www.googletagmanager.com",
    "https://*.google-analytics.com",
  )}`,
  "font-src 'self' data:",
  `connect-src ${cspSources(
    "'self'",
    toOrigin(process.env.NEXT_PUBLIC_SERVER_URL),
    toOrigin(process.env.NEXT_PUBLIC_POSTHOG_HOST),
    ...r2Origins,
    "https://www.googletagmanager.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    !isProduction && "ws:",
  )}`,
  "frame-src 'self'",
  // react-pdf worker is bundled same-origin; some libraries spawn blob workers.
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  // HSTS only in production — never pin localhost to HTTPS during dev.
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  // Enforced now so clickjacking protection is real while the full policy
  // below is still report-only.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  {
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicyReportOnly,
  },
];

const nextConfig: NextConfig = {
  // Next.js built-in TS/ESLint checks OOM during build — run `pnpm typecheck` separately instead
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },

  images: {
    remotePatterns,
    qualities: [25, 50, 75, 80, 100],
    // Org logos may be SVG (stored on R2 after server-side active-content
    // rejection). CSP sandbox + attachment disposition keep a hostile SVG
    // inert if the optimizer endpoint is ever navigated directly.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "25MB",
    },
  },

  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  // PostHog same-origin proxy — browser events go to /ingest so ad-blockers
  // don't drop them. skipTrailingSlashRedirect keeps PostHog API paths intact.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },

  async redirects() {
    return [
      // Specific rule must precede the wildcard below so it wins.
      {
        source: "/catalog/org",
        destination: "/projects",
        permanent: true,
      },
      // Legacy /catalog URLs now live under /projects — preserve old bookmarks.
      {
        source: "/catalog/:path*",
        destination: "/projects/:path*",
        permanent: true,
      },
      // Contact moved to a homepage section. Temporary so a dedicated page can
      // come back without fighting cached permanent redirects.
      {
        source: "/contact",
        destination: "/#contact",
        permanent: false,
      },
      {
        source: "/user-guide",
        destination: "/docs",
        permanent: true,
      },
    ];
  },
};

// fumadocs-mdx build plugin: generates the `.source/` content collection and
// registers the `.mdx?collection=…` loader. Composes with (does not replace)
// the config above — webpack callback, image patterns, redirects all preserved.
const withMDX = createMDX();

// Sourcemap upload only runs when SENTRY_AUTH_TOKEN (+ org/project) is set in
// the build env — without it the wrapper is inert, keeping Sentry optional.
export default withSentryConfig(withMDX(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Proxy browser events through our own domain so ad-blockers don't drop them
  tunnelRoute: "/monitoring",
  sourcemaps: {
    // Skip sourcemap generation entirely when there is no token to upload
    // them — the Sentry webpack plugin's map emission is memory-heavy and
    // OOMs the CI build for nothing.
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
});
