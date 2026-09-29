import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// R2 cover images may live across multiple public buckets (the turboplan app
// and the server image-gen service use different ones). R2_PUBLIC_URL accepts a
// comma-separated list of bucket URLs so each app can allowlist every R2 host
// it renders.
const r2Hostnames = (process.env.R2_PUBLIC_URL ?? "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean)
  .map((url) => new URL(url).hostname);

const allowedHostnames = [
  "avatar.vercel.sh",
  "*.blob.vercel-storage.com",
  ...r2Hostnames,
];

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
  // React Refresh.
  `script-src ${cspSources("'self'", "'unsafe-inline'", !isProduction && "'unsafe-eval'")}`,
  // Next.js, Leaflet and framer-motion all write inline styles.
  "style-src 'self' 'unsafe-inline'",
  `img-src ${cspSources(
    "'self'",
    "data:",
    "blob:",
    "https://avatar.vercel.sh",
    "https://*.blob.vercel-storage.com",
    ...r2Origins,
    // Public images can come from any of our r2.dev buckets (e.g. org logos
    // written by the MCP server), not only the ones listed in R2_PUBLIC_URL.
    "https://*.r2.dev",
    "https://*.tile.openstreetmap.org",
    "https://*.tile.opentopomap.org",
    "https://server.arcgisonline.com",
  )}`,
  "font-src 'self' data:",
  `connect-src ${cspSources(
    "'self'",
    toOrigin(process.env.NEXT_PUBLIC_SERVER_URL),
    toOrigin(process.env.NEXT_PUBLIC_POSTHOG_HOST),
    ...r2Origins,
    // Browser PUTs to presigned R2 upload URLs.
    "https://*.r2.cloudflarestorage.com",
    !isProduction && "ws:",
  )}`,
  // Documenso signing is embedded from a per-organization host configured at
  // runtime, so any https origin is allowed.
  "frame-src 'self' https:",
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
  // Standalone output required by OpenNext for Cloudflare Workers deployment.
  // Vercel ignores this setting; local dev is unaffected.
  output: "standalone",
  // Monorepo root — required for @vercel/nft to trace all dependencies
  // from the root node_modules when building the standalone output.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Packages with workerd-specific exports must be external so the
  // OpenNext/Cloudflare bundler can resolve them with the workerd condition.
  serverExternalPackages: ["postgres", "jose"],
  experimental: {
    // PPR (Partial Prerendering) disabled due to compatibility issues with E2E tests.
    // When enabled, it caused test failures during page navigation and hydration.
    // TODO: Re-evaluate when Next.js PPR becomes stable.
    ppr: false,
    // Tree-shake barrel exports from heavy libraries to reduce Cloudflare Worker bundle size.
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "date-fns",
      "react-data-grid",
      "@radix-ui/react-icons",
    ],
  },
  images: {
    remotePatterns,
    qualities: [25, 50, 75, 80, 100],
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
  webpack: (config, { isServer }) => {
    // `unpdf` (PDF text extraction, server-only, reached via
    // turboplan-documents) uses `import.meta` in a form webpack cannot analyse
    // statically, so every compile logs "Critical dependency: Accessing
    // import.meta directly is unsupported". The package works correctly — this
    // is a bundler analysis limitation, not a defect.
    //
    // Note: `serverExternalPackages` does NOT suppress it. That was verified
    // against a clean build (`rm -rf .next`); the warning survives because the
    // import arrives through a server action and a prebuilt workspace `dist`.
    //
    // Matched narrowly on module AND message so unrelated warnings still show.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /unpdf/, message: /import\.meta/ },
    ];

    if (isServer) {
      // `@streamdown/code` statically imports every shiki grammar (~23 MB of
      // JSON). markdown.tsx only loads it client-side after mount, but webpack
      // would still bundle it into the server build; alias it away there so the
      // Worker bundle stays under the memory/size limits. The dynamic import in
      // markdown.tsx never executes during SSR.
      config.resolve.alias = {
        ...config.resolve.alias,
        "@streamdown/code": false,
      };
    }

    return config;
  },
};

// Sourcemap upload only runs when SENTRY_AUTH_TOKEN (+ org/project) is set in
// the build env — without it the wrapper is inert, keeping Sentry optional.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Proxy browser events through our own domain so ad-blockers don't drop them
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true,
  sourcemaps: {
    // Skip sourcemap generation entirely when there is no token to upload
    // them — the Sentry webpack plugin's map emission is memory-heavy and
    // OOMs the CI build for nothing.
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
});
