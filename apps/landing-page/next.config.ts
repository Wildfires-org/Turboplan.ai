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
