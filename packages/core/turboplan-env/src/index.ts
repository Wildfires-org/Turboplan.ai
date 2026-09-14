/**
 * This file is meant to define all the critically required env variables for the project to be fully functional.
 * It also should be the core env variables values provider, so we never have to use `process.env.` in our codebase.
 */

export const isEnvValueTruthy = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }

  return value.toLowerCase() === "true";
};

const isServerSide = () => typeof window === "undefined";

export type ReleaseInfo = {
  RELEASE_VERSION: string;
  RELEASE_DATE: string;
  APP_ENV: string;
  RELEASE_BRANCH: string;
};

export type DbEnvType = {
  POSTGRES_URL: string;
  TEST_POSTGRES_URL?: string;
};

type CommonEnvType = {
  // NextAuth session JWE + the analytics email HMAC seed. Nothing else — the
  // internal API call, secret encryption and API tokens each have their own
  // secret (INTERNAL_API_SECRET, ENCRYPTION_KEY, JWT_SIGNING_SECRET).
  AUTH_SECRET: string;
  POSTGRES_URL: string;
  TURBOPLAN_URL: string;
  // Landing page base URL (public catalog links, Stripe checkout cancel
  // redirect). Optional — empty string when unset.
  LANDING_URL: string;

  // feature flags
  IS_TASKS_PACKAGE_ENABLED: boolean;
  IS_MAPS_PACKAGE_ENABLED: boolean;
  IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED: boolean;
  IS_PROJECT_CONTEXT_PACKAGE_ENABLED: boolean;

  // optional
  PORT: string;
  NODE_ENV: string;

  // testing (optional) - dedicated database URL for e2e tests
  TEST_POSTGRES_URL?: string;
};

type ApiEnvType = CommonEnvType & {
  ALLOWED_ORIGINS: string;

  // Universal API key for service-to-service communication
  SERVER_API_KEY: string;

  // Shared secret guarding the internal magic-link email endpoint
  // (X-Internal-Secret header). Must be byte-identical to the web app's.
  INTERNAL_API_SECRET: string;

  // AES-256-GCM key for secrets stored at rest (per-org third-party keys).
  // API server only — both encryption and decryption run here.
  ENCRYPTION_KEY: string;

  // HS256 key for API token signing and verification. Must be byte-identical
  // to the web app's, which mints the tokens this server verifies.
  JWT_SIGNING_SECRET: string;

  MAP_SERVICE_API_KEY: string;
  MAP_SERVICE_URL: string;

  // Research Agent Service (required when feature is enabled)
  RESEARCH_AGENT_SERVICE_URL: string;
  RESEARCH_AGENT_SERVICE_API_KEY: string;

  // AI features
  DISABLE_AUTO_PROJECT_IMAGE_GENERATION: boolean;

  // External prompts (optional - dev/test only)
  USE_EXTERNAL_PROMPTS: boolean;
  ADMIN_EMAILS: string;

  // Email (Resend)
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL: string;
  /** Reply-to address applied to all outgoing mail when not set per-email */
  MAIL_REPLY_TO_EMAIL: string;

  // Email (Ethereal - dev/e2e testing)
  ETHEREAL_USER?: string;
  ETHEREAL_PASS?: string;

  // Analytics (PostHog)
  POSTHOG_API_KEY?: string;

  // Error monitoring (Sentry) - optional, monitoring disabled when unset
  SENTRY_DSN?: string;

  // Documenso signing (required when signing feature is enabled)
  DOCUMENSO_API_URL: string;
  DOCUMENSO_API_KEY: string;
  DOCUMENSO_WEBHOOK_SECRET: string;

  // Stripe billing (required when billing feature is enabled). Plan/seat/
  // overage prices are NOT env vars — they resolve at runtime from catalog
  // lookup keys (see turboplan-billing resolvePriceIdByLookupKey).
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;

  // Optional shared secret guarding the manual seat-reconciliation endpoint
  // (POST /api/billing/reconcile). When unset the endpoint is disabled (404);
  // when set it must match the `x-reconcile-secret` request header. Lets an
  // external scheduler drive reconciliation without a platform-specific cron.
  RECONCILE_SECRET?: string;
};

type WebEnvType = CommonEnvType & {
  SERVER_URL: string;
  LANDING_URL: string;
  DISABLE_AUTO_PROJECT_IMAGE_GENERATION: boolean;

  // Server-side only. Shared secret sent as X-Internal-Secret on the internal
  // magic-link email call. Must be byte-identical to the API server's.
  INTERNAL_API_SECRET: string;

  // Server-side only. HS256 key used to mint API tokens. Must be
  // byte-identical to the API server's, which verifies them.
  JWT_SIGNING_SECRET: string;

  // External prompts (optional - dev/test only)
  USE_EXTERNAL_PROMPTS: boolean;
  ADMIN_EMAILS: string;

  // Cross-domain authentication (optional)
  // When set, session cookies will be scoped to this domain (e.g., ".example.com")
  // This enables session sharing between turboplan and landing-page
  AUTH_COOKIE_DOMAIN?: string;

  // Research Agent polling interval in ms (optional, default 5000)
  RESEARCH_AGENT_POLLING_INTERVAL: number;

  // Exa.ai web search (optional — degrades gracefully without it)
  EXA_API_KEY?: string;
  // Analytics (PostHog, server-side) - optional, analytics disabled when unset
  POSTHOG_API_KEY?: string;
};

type LandingPageEnvType = {
  LINKEDIN_URL: string;
  TURBOPLAN_URL: string;
  SERVER_URL: string;
  LANDING_URL: string;

  // Server-side only: Required for verifying session cookies from turboplan
  // Must match the AUTH_SECRET used by turboplan app
  AUTH_SECRET: string;
};

export type ResearchAgentEnvType = {
  AGENT_API_KEY: string;
  TARGET_API_ROOT_PATH: string;
  ALLOWED_ORIGINS: string[];
  PORT: number;
  AGENT_LOCAL: boolean;
  RUN_TIMEOUT_MS: number;
  LOG_STACK_TRACES: boolean;
  CLAUDE_FAST_MODEL: string | null;
  CLAUDE_MODEL: string;
  DEBUG_CLAUDE_AGENT_SDK: boolean;
  ANTHROPIC_API_KEY: string;
  // OpenRouter key - when set, agent traffic routes through OpenRouter's
  // Anthropic-compatible endpoint instead of the direct Anthropic API
  OPENROUTER_API_KEY: string;
  MODAL_TOKEN_ID: string;
  MODAL_TOKEN_SECRET: string;
  FIRECRAWL_API_KEY: string;
  // Error monitoring (Sentry) - optional, monitoring disabled when unset
  SENTRY_DSN?: string;
  // Analytics (PostHog) - optional, analytics disabled when unset
  POSTHOG_API_KEY?: string;
};

type R2EnvType = {
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  R2_ACCOUNT_ID: string;
  R2_PUBLIC_URL: string;
};

// Cache variables
let _dbEnv: DbEnvType | null = null;
let _commonEnv: CommonEnvType | null = null;
let _apiEnv: ApiEnvType | null = null;
let _webEnv: WebEnvType | null = null;
let _landingPageEnv: LandingPageEnvType | null = null;
let _releaseInfo: ReleaseInfo | null = null;
let _researchAgentEnv: ResearchAgentEnvType | null = null;
let _r2Env: R2EnvType | null = null;

const loadDbEnv = (): DbEnvType => {
  if (
    isServerSide() &&
    !process.env.TEST_POSTGRES_URL &&
    !process.env.POSTGRES_URL
  ) {
    throw new Error(
      "Missing database URL: set `POSTGRES_URL` or `TEST_POSTGRES_URL` env variable",
    );
  }

  return {
    POSTGRES_URL: isServerSide()
      ? process.env.TEST_POSTGRES_URL || process.env.POSTGRES_URL!
      : "",
    TEST_POSTGRES_URL: process.env.TEST_POSTGRES_URL,
  };
};

const loadCommonEnv = (): CommonEnvType => {
  if (isServerSide() && !process.env.AUTH_SECRET) {
    throw new Error("Missing `AUTH_SECRET` env variable");
  }

  // Database URL validation
  // TEST_POSTGRES_URL takes priority when set (for e2e tests), otherwise POSTGRES_URL is required
  if (
    isServerSide() &&
    !process.env.TEST_POSTGRES_URL &&
    !process.env.POSTGRES_URL
  ) {
    throw new Error(
      "Missing database URL: set `POSTGRES_URL` or `TEST_POSTGRES_URL` env variable",
    );
  }

  if (!process.env.TURBOPLAN_URL && !process.env.NEXT_PUBLIC_TURBOPLAN_URL) {
    throw new Error(
      "Missing `TURBOPLAN_URL` or `NEXT_PUBLIC_TURBOPLAN_URL` env variable",
    );
  }

  if (
    !process.env.IS_TASKS_PACKAGE_ENABLED &&
    !process.env.NEXT_PUBLIC_IS_TASKS_PACKAGE_ENABLED
  ) {
    throw new Error(
      "Missing `IS_TASKS_PACKAGE_ENABLED` or `NEXT_PUBLIC_IS_TASKS_PACKAGE_ENABLED` env variable",
    );
  }

  if (
    !process.env.IS_MAPS_PACKAGE_ENABLED &&
    !process.env.NEXT_PUBLIC_IS_MAPS_PACKAGE_ENABLED
  ) {
    throw new Error(
      "Missing `IS_MAPS_PACKAGE_ENABLED` or `NEXT_PUBLIC_IS_MAPS_PACKAGE_ENABLED` env variable",
    );
  }

  if (
    !process.env.IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED &&
    !process.env.NEXT_PUBLIC_IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED
  ) {
    throw new Error(
      "Missing `IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED` or `NEXT_PUBLIC_IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED` env variable",
    );
  }

  if (
    !process.env.IS_PROJECT_CONTEXT_PACKAGE_ENABLED &&
    !process.env.NEXT_PUBLIC_IS_PROJECT_CONTEXT_PACKAGE_ENABLED
  ) {
    throw new Error(
      "Missing `IS_PROJECT_CONTEXT_PACKAGE_ENABLED` or `NEXT_PUBLIC_IS_PROJECT_CONTEXT_PACKAGE_ENABLED` env variable",
    );
  }

  // Resolve effective POSTGRES_URL: TEST_POSTGRES_URL takes priority when set
  const effectivePostgresUrl = isServerSide()
    ? process.env.TEST_POSTGRES_URL || process.env.POSTGRES_URL!
    : "";

  // Log a noticeable warning when TEST_POSTGRES_URL is being used
  if (isServerSide() && process.env.TEST_POSTGRES_URL) {
    console.log(
      "\n" +
        "=".repeat(60) +
        "\n" +
        "⚠️  TEST_POSTGRES_URL is set - using TEST database!\n" +
        "=".repeat(60) +
        "\n",
    );
  }

  return {
    AUTH_SECRET: isServerSide() ? process.env.AUTH_SECRET! : "",
    POSTGRES_URL: effectivePostgresUrl,
    TEST_POSTGRES_URL: process.env.TEST_POSTGRES_URL,
    TURBOPLAN_URL:
      process.env.TURBOPLAN_URL || process.env.NEXT_PUBLIC_TURBOPLAN_URL!,
    LANDING_URL:
      process.env.LANDING_URL || process.env.NEXT_PUBLIC_LANDING_URL || "",

    IS_TASKS_PACKAGE_ENABLED:
      isEnvValueTruthy(process.env.IS_TASKS_PACKAGE_ENABLED) ||
      isEnvValueTruthy(process.env.NEXT_PUBLIC_IS_TASKS_PACKAGE_ENABLED),

    IS_MAPS_PACKAGE_ENABLED:
      isEnvValueTruthy(process.env.IS_MAPS_PACKAGE_ENABLED) ||
      isEnvValueTruthy(process.env.NEXT_PUBLIC_IS_MAPS_PACKAGE_ENABLED),

    IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED:
      isEnvValueTruthy(
        process.env.IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED,
      ) ||
      isEnvValueTruthy(
        process.env.NEXT_PUBLIC_IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED,
      ),

    IS_PROJECT_CONTEXT_PACKAGE_ENABLED:
      isEnvValueTruthy(process.env.IS_PROJECT_CONTEXT_PACKAGE_ENABLED) ||
      isEnvValueTruthy(
        process.env.NEXT_PUBLIC_IS_PROJECT_CONTEXT_PACKAGE_ENABLED,
      ),

    PORT: process.env.PORT || "",
    NODE_ENV: process.env.NODE_ENV || "",
  };
};

const loadApiEnv = (): ApiEnvType => {
  if (!process.env.ALLOWED_ORIGINS) {
    throw new Error("Missing `ALLOWED_ORIGINS` env variable");
  }

  if (!process.env.SERVER_API_KEY) {
    throw new Error("Missing `SERVER_API_KEY` env variable");
  }

  if (!process.env.INTERNAL_API_SECRET) {
    throw new Error("Missing `INTERNAL_API_SECRET` env variable");
  }

  if (!process.env.ENCRYPTION_KEY) {
    throw new Error("Missing `ENCRYPTION_KEY` env variable");
  }

  if (!process.env.JWT_SIGNING_SECRET) {
    throw new Error("Missing `JWT_SIGNING_SECRET` env variable");
  }

  const commonEnv = loadCommonEnv();

  const isMapsPackageEnabled = commonEnv.IS_MAPS_PACKAGE_ENABLED;
  const isResearchAgentPackageEnabled =
    commonEnv.IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED;
  const isSigningPackageEnabled =
    isEnvValueTruthy(process.env.IS_SIGNING_PACKAGE_ENABLED) ||
    isEnvValueTruthy(process.env.NEXT_PUBLIC_IS_SIGNING_PACKAGE_ENABLED);
  const isBillingPackageEnabled =
    isEnvValueTruthy(process.env.IS_BILLING_PACKAGE_ENABLED) ||
    isEnvValueTruthy(process.env.NEXT_PUBLIC_IS_BILLING_PACKAGE_ENABLED);

  if (isMapsPackageEnabled) {
    if (!process.env.MAP_SERVICE_API_KEY) {
      throw new Error("Missing `MAP_SERVICE_API_KEY` env variable");
    }

    if (!process.env.MAP_SERVICE_URL) {
      throw new Error("Missing `MAP_SERVICE_URL` env variable");
    }
  }

  if (isResearchAgentPackageEnabled) {
    if (!process.env.RESEARCH_AGENT_SERVICE_URL) {
      throw new Error("Missing `RESEARCH_AGENT_SERVICE_URL` env variable");
    }

    if (!process.env.RESEARCH_AGENT_SERVICE_API_KEY) {
      throw new Error("Missing `RESEARCH_AGENT_SERVICE_API_KEY` env variable");
    }
  }

  if (isSigningPackageEnabled) {
    if (!process.env.DOCUMENSO_API_URL) {
      throw new Error("Missing `DOCUMENSO_API_URL` env variable");
    }

    if (!process.env.DOCUMENSO_API_KEY) {
      throw new Error("Missing `DOCUMENSO_API_KEY` env variable");
    }

    if (!process.env.DOCUMENSO_WEBHOOK_SECRET) {
      throw new Error("Missing `DOCUMENSO_WEBHOOK_SECRET` env variable");
    }
  }

  if (isBillingPackageEnabled) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Missing `STRIPE_SECRET_KEY` env variable");
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("Missing `STRIPE_WEBHOOK_SECRET` env variable");
    }
  }

  return {
    ...loadCommonEnv(),
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    SERVER_API_KEY: process.env.SERVER_API_KEY!,
    INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET!,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
    JWT_SIGNING_SECRET: process.env.JWT_SIGNING_SECRET!,
    MAP_SERVICE_API_KEY: isMapsPackageEnabled
      ? process.env.MAP_SERVICE_API_KEY!
      : "__ENV_CONFIG_ERROR__",
    MAP_SERVICE_URL: isMapsPackageEnabled
      ? process.env.MAP_SERVICE_URL!
      : "__ENV_CONFIG_ERROR__",

    // AI features
    DISABLE_AUTO_PROJECT_IMAGE_GENERATION: isEnvValueTruthy(
      process.env.DISABLE_AUTO_PROJECT_IMAGE_GENERATION,
    ),

    // External prompts (optional - dev/test only)
    USE_EXTERNAL_PROMPTS: isEnvValueTruthy(process.env.USE_EXTERNAL_PROMPTS),
    ADMIN_EMAILS: process.env.ADMIN_EMAILS || "",

    // Email (Resend)
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || "",
    // No default: a hard-coded address would make every fork's outbound mail
    // invite replies to someone else's inbox. Unset means no Reply-To header.
    MAIL_REPLY_TO_EMAIL: process.env.MAIL_REPLY_TO_EMAIL || "",

    // Email (Ethereal - dev/e2e testing)
    ETHEREAL_USER: process.env.ETHEREAL_USER,
    ETHEREAL_PASS: process.env.ETHEREAL_PASS,

    // Analytics (PostHog)
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,

    // Error monitoring (Sentry)
    SENTRY_DSN: process.env.SENTRY_DSN,

    // Research Agent Service (required when feature is enabled)
    RESEARCH_AGENT_SERVICE_URL: isResearchAgentPackageEnabled
      ? process.env.RESEARCH_AGENT_SERVICE_URL!
      : "__ENV_CONFIG_ERROR__",
    RESEARCH_AGENT_SERVICE_API_KEY: isResearchAgentPackageEnabled
      ? process.env.RESEARCH_AGENT_SERVICE_API_KEY!
      : "__ENV_CONFIG_ERROR__",

    // Documenso signing (required when feature is enabled)
    DOCUMENSO_API_URL: isSigningPackageEnabled
      ? process.env.DOCUMENSO_API_URL!
      : "__ENV_CONFIG_ERROR__",
    DOCUMENSO_API_KEY: isSigningPackageEnabled
      ? process.env.DOCUMENSO_API_KEY!
      : "__ENV_CONFIG_ERROR__",
    DOCUMENSO_WEBHOOK_SECRET: isSigningPackageEnabled
      ? process.env.DOCUMENSO_WEBHOOK_SECRET!
      : "__ENV_CONFIG_ERROR__",

    // Stripe billing (required when feature is enabled)
    STRIPE_SECRET_KEY: isBillingPackageEnabled
      ? process.env.STRIPE_SECRET_KEY!
      : "__ENV_CONFIG_ERROR__",
    STRIPE_WEBHOOK_SECRET: isBillingPackageEnabled
      ? process.env.STRIPE_WEBHOOK_SECRET!
      : "__ENV_CONFIG_ERROR__",

    // Optional — endpoint is disabled when unset (no validation requirement).
    RECONCILE_SECRET: process.env.RECONCILE_SECRET,

    // optional
    PORT: process.env.PORT || "",
    NODE_ENV: process.env.NODE_ENV || "",
  };
};

const loadWebEnv = (): WebEnvType => {
  if (!process.env.NEXT_PUBLIC_SERVER_URL) {
    throw new Error("Missing `NEXT_PUBLIC_SERVER_URL` env variable");
  }

  // Server-side only secrets — never exposed to the client bundle.
  if (isServerSide() && !process.env.INTERNAL_API_SECRET) {
    throw new Error(
      "Missing `INTERNAL_API_SECRET` env variable (required for internal API calls)",
    );
  }

  if (isServerSide() && !process.env.JWT_SIGNING_SECRET) {
    throw new Error(
      "Missing `JWT_SIGNING_SECRET` env variable (required for API token signing)",
    );
  }

  return {
    ...loadCommonEnv(),

    SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
    INTERNAL_API_SECRET: isServerSide() ? process.env.INTERNAL_API_SECRET! : "",
    JWT_SIGNING_SECRET: isServerSide() ? process.env.JWT_SIGNING_SECRET! : "",
    LANDING_URL: process.env.NEXT_PUBLIC_LANDING_URL || "",
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
    DISABLE_AUTO_PROJECT_IMAGE_GENERATION: isEnvValueTruthy(
      process.env.NEXT_PUBLIC_DISABLE_AUTO_PROJECT_IMAGE_GENERATION,
    ),

    // External prompts (optional - dev/test only)
    USE_EXTERNAL_PROMPTS: isEnvValueTruthy(process.env.USE_EXTERNAL_PROMPTS),
    ADMIN_EMAILS: process.env.ADMIN_EMAILS || "",

    // Cross-domain authentication (optional)
    AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN,

    // Research Agent polling interval (optional, default 5000ms)
    RESEARCH_AGENT_POLLING_INTERVAL:
      Number(process.env.NEXT_PUBLIC_RESEARCH_AGENT_POLLING_INTERVAL) || 5000,

    // Exa.ai web search (optional)
    EXA_API_KEY: process.env.EXA_API_KEY,
  };
};

const loadLandingPageEnv = (): LandingPageEnvType => {
  if (!process.env.NEXT_PUBLIC_LINKEDIN_URL) {
    throw new Error("Missing `NEXT_PUBLIC_LINKEDIN_URL` env variable");
  }

  if (!process.env.NEXT_PUBLIC_TURBOPLAN_URL) {
    throw new Error("Missing `NEXT_PUBLIC_TURBOPLAN_URL` env variable");
  }

  if (!process.env.NEXT_PUBLIC_SERVER_URL) {
    throw new Error("Missing `NEXT_PUBLIC_SERVER_URL` env variable");
  }

  // AUTH_SECRET is required server-side for verifying session cookies
  if (isServerSide() && !process.env.AUTH_SECRET) {
    throw new Error(
      "Missing `AUTH_SECRET` env variable (required for session verification)",
    );
  }

  return {
    LINKEDIN_URL: process.env.NEXT_PUBLIC_LINKEDIN_URL,
    TURBOPLAN_URL: process.env.NEXT_PUBLIC_TURBOPLAN_URL,
    SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
    LANDING_URL:
      process.env.LANDING_URL || process.env.NEXT_PUBLIC_LANDING_URL || "",
    AUTH_SECRET: isServerSide() ? process.env.AUTH_SECRET! : "",
  };
};

const loadReleaseInfo = (): ReleaseInfo => {
  // Resolve before coercing: String(undefined) is the non-empty "undefined",
  // so slicing it yielded "undefin" and the `|| "-"` fallback could never fire.
  const version =
    process.env.RELEASE_VERSION || process.env.NEXT_PUBLIC_RELEASE_VERSION;

  return {
    // CI sets this to the deploy commit SHA; 7 chars is the short-SHA form.
    RELEASE_VERSION: version ? version.slice(0, 7) : "-",
    RELEASE_DATE:
      process.env.RELEASE_DATE || process.env.NEXT_PUBLIC_RELEASE_DATE || "-",
    APP_ENV: process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || "-",
    RELEASE_BRANCH:
      process.env.RELEASE_BRANCH ||
      process.env.NEXT_PUBLIC_RELEASE_BRANCH ||
      "-",
  };
};

const DEFAULT_RUN_TIMEOUT_MS = 10 * 60 * 1000;

const parseRunTimeoutMs = (rawValue: string | undefined): number => {
  if (!rawValue) {
    return DEFAULT_RUN_TIMEOUT_MS;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RUN_TIMEOUT_MS;
  }
  return Math.floor(parsed);
};

const loadResearchAgentEnv = (): ResearchAgentEnvType => {
  if (!process.env.AGENT_API_KEY?.trim()) {
    throw new Error("Missing `AGENT_API_KEY` env variable");
  }

  const isLocal = isEnvValueTruthy(process.env.AGENT_LOCAL);

  if (!isLocal) {
    const modalRequired = ["MODAL_TOKEN_ID", "MODAL_TOKEN_SECRET"] as const;
    const missing = modalRequired.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required Modal env variables: ${missing.join(", ")}. ` +
          `Set them in .env or set AGENT_LOCAL=true for local development.`,
      );
    }
    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENROUTER_API_KEY) {
      throw new Error(
        "Missing model provider key: set ANTHROPIC_API_KEY or OPENROUTER_API_KEY. " +
          "Set it in .env or set AGENT_LOCAL=true for local development.",
      );
    }
  }

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : ["*"];

  return {
    AGENT_API_KEY: process.env.AGENT_API_KEY!,
    TARGET_API_ROOT_PATH: process.env.TARGET_API_ROOT_PATH ?? "",
    ALLOWED_ORIGINS: allowedOrigins,
    PORT: Number(process.env.PORT) || 3003,
    AGENT_LOCAL: isLocal,
    RUN_TIMEOUT_MS: parseRunTimeoutMs(process.env.RUN_TIMEOUT_MS),
    LOG_STACK_TRACES: process.env.LOG_STACK_TRACES !== "false",
    CLAUDE_FAST_MODEL: process.env.CLAUDE_FAST_MODEL?.trim() || null,
    CLAUDE_MODEL: process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6",
    DEBUG_CLAUDE_AGENT_SDK: isEnvValueTruthy(
      process.env.DEBUG_CLAUDE_AGENT_SDK,
    ),
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY?.trim() ?? "",
    MODAL_TOKEN_ID: process.env.MODAL_TOKEN_ID ?? "",
    MODAL_TOKEN_SECRET: process.env.MODAL_TOKEN_SECRET ?? "",
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY ?? "",
    SENTRY_DSN: process.env.SENTRY_DSN,
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
  };
};

const loadR2Env = (): R2EnvType => {
  if (!process.env.R2_ACCESS_KEY_ID) {
    throw new Error("Missing `R2_ACCESS_KEY_ID` env variable");
  }

  if (!process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error("Missing `R2_SECRET_ACCESS_KEY` env variable");
  }

  if (!process.env.R2_BUCKET_NAME) {
    throw new Error("Missing `R2_BUCKET_NAME` env variable");
  }

  if (!process.env.R2_ACCOUNT_ID) {
    throw new Error("Missing `R2_ACCOUNT_ID` env variable");
  }

  if (!process.env.R2_PUBLIC_URL) {
    throw new Error("Missing `R2_PUBLIC_URL` env variable");
  }

  return {
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL.replace(/\/+$/, ""),
  };
};

// Public getters with caching
export const getDbEnv = (): DbEnvType => {
  if (!_dbEnv) {
    _dbEnv = loadDbEnv();
  }
  return _dbEnv;
};

export const getCommonEnv = (): CommonEnvType => {
  if (!_commonEnv) {
    _commonEnv = loadCommonEnv();
  }
  return _commonEnv;
};

export const getApiEnv = (): ApiEnvType => {
  if (!_apiEnv) {
    _apiEnv = loadApiEnv();
  }
  return _apiEnv;
};

export const getWebEnv = (): WebEnvType => {
  if (!_webEnv) {
    _webEnv = loadWebEnv();
  }
  return _webEnv;
};

export const getLandingPageEnv = (): LandingPageEnvType => {
  if (!_landingPageEnv) {
    _landingPageEnv = loadLandingPageEnv();
  }
  return _landingPageEnv;
};

export const getReleaseInfo = (): ReleaseInfo => {
  if (!_releaseInfo) {
    _releaseInfo = loadReleaseInfo();
  }
  return _releaseInfo;
};

export const getResearchAgentEnv = (): ResearchAgentEnvType => {
  if (!_researchAgentEnv) {
    _researchAgentEnv = loadResearchAgentEnv();
  }
  return _researchAgentEnv;
};

export const getR2Env = (): R2EnvType => {
  if (!_r2Env) {
    _r2Env = loadR2Env();
  }
  return _r2Env;
};

/**
 * Resets the environment cache.
 * Useful for testing scenarios where environment variables might change.
 */
export const resetEnvCache = (): void => {
  _commonEnv = null;
  _apiEnv = null;
  _webEnv = null;
  _landingPageEnv = null;
  _researchAgentEnv = null;
  _r2Env = null;
};

export type SentryEnvType = {
  // Server/edge DSN — falls back to the browser var so one value covers both
  SENTRY_DSN?: string;
  // Browser DSN — must stay a static `process.env.NEXT_PUBLIC_*` reference so
  // Next.js inlines it at build time
  NEXT_PUBLIC_SENTRY_DSN?: string;
  ENVIRONMENT?: string;
  RELEASE?: string;
};

/**
 * Returns Sentry configuration.
 * This is a lightweight getter that doesn't require the full env validation —
 * Sentry init runs at instrumentation time, before the app env is guaranteed,
 * and must no-op (not throw) when Sentry is unconfigured.
 *
 * Safe to call from client bundles too: the non-`NEXT_PUBLIC_` reads
 * (SENTRY_DSN, APP_ENV) are inlined to `undefined` by Next and the `||`
 * chains fall through to the public vars. Only NEXT_PUBLIC_SENTRY_DSN,
 * NEXT_PUBLIC_APP_ENV and NEXT_PUBLIC_RELEASE_VERSION carry values there.
 */
export const getSentryEnv = (): SentryEnvType => {
  return {
    SENTRY_DSN: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // APP_ENV distinguishes deploy targets (production/develop/preview);
    // NODE_ENV is "production" in every Next.js build, so it is only a
    // last-resort fallback.
    ENVIRONMENT:
      process.env.APP_ENV ||
      process.env.NEXT_PUBLIC_APP_ENV ||
      process.env.NODE_ENV,
    RELEASE: process.env.NEXT_PUBLIC_RELEASE_VERSION || undefined,
  };
};

/**
 * Returns the application display name.
 * This is a lightweight getter that doesn't require the full env validation.
 * Reads APP_NAME (server) or NEXT_PUBLIC_APP_NAME (client).
 */
export const getAppName = (): string => {
  return (
    process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || "[Your Brand]"
  );
};

/**
 * Returns the ADMIN_EMAILS environment variable.
 * This is a lightweight getter that doesn't require the full env validation.
 */
export const getAdminEmails = (): string => {
  return process.env.ADMIN_EMAILS || "";
};

/**
 * Reads SUPPORT_EMAIL (server) or NEXT_PUBLIC_SUPPORT_EMAIL (client).
 */
export const getSupportEmail = (): string => {
  return (
    process.env.SUPPORT_EMAIL ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
    "support@example.com"
  );
};

export const getServerUrl = (): string => {
  if (isServerSide()) {
    return process.env.SERVER_URL || "";
  }

  return process.env.NEXT_PUBLIC_SERVER_URL || "";
};

export const getLocalTunnelUrl = (): string => {
  if (isServerSide()) {
    return process.env.LOCAL_TUNNEL_URL || "";
  }

  return process.env.NEXT_PUBLIC_LOCAL_TUNNEL_URL || "";
};

/**
 * Returns the AUTH_COOKIE_DOMAIN environment variable.
 * This is a lightweight getter that doesn't require the full env validation.
 *
 * When set, session cookies will be scoped to this domain (e.g., ".example.com")
 * enabling cross-subdomain session sharing between turboplan and landing-page.
 */
export const getAuthCookieDomain = (): string | undefined => {
  return process.env.AUTH_COOKIE_DOMAIN;
};

export const getAppEnv = (): string => {
  return process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || "";
};

/**
 * APP_ENV values that identify a *deployed* environment. Anything set by
 * `scripts/deploy-*.sh` / the CI workflow (`vars.APP_ENV`) lands here; local
 * development leaves APP_ENV unset, so `getAppEnv()` returns "".
 */
const DEPLOYED_APP_ENVS = new Set(["production", "develop", "pr_preview"]);

/**
 * True only for a local development process — i.e. NOT a production build and
 * NOT any deployed environment.
 *
 * Fail-closed by construction: a deploy that forgets APP_ENV is still caught by
 * the NODE_ENV check, and a deploy that forgets NODE_ENV is still caught by
 * APP_ENV. Use this to gate debug-only surfaces; never use `=== "production"`
 * for that, since an unset variable would fail OPEN.
 */
export const isLocalDevelopment = (): boolean => {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return !DEPLOYED_APP_ENVS.has(getAppEnv());
};

/**
 * True when this process runs on Cloudflare Workers.
 *
 * `WORKER_RUNTIME:true` is injected as a Worker var by every deploy script
 * (`scripts/deploy-api.sh`, `deploy-web.sh`, `deploy-mcp.sh`) and is absent
 * locally, on Vercel and in tests. This is the canonical runtime probe for
 * anything that may only trust Cloudflare-set request headers.
 */
export const isWorkerRuntime = (): boolean => {
  return process.env.WORKER_RUNTIME === "true";
};

export const getAuthCookieName = (): string => {
  const appEnv = process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV;
  const releaseBranch =
    process.env.RELEASE_BRANCH || process.env.NEXT_PUBLIC_RELEASE_BRANCH || "";

  if (appEnv === "production") {
    return "turboplan.session-token";
  }

  return `${releaseBranch.replace("/", "-").toLowerCase()}.turboplan.session-token`;
};

export const getOpenRouterEnv = (): {
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL_PRIMARY: string;
  OPENROUTER_MODEL_LITE: string;
  OPENROUTER_MODEL_IMAGE_PRIMARY: string;
  OPENROUTER_MODEL_IMAGE_LITE: string;
} => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("Missing `OPENROUTER_API_KEY` env variable");
  }

  let defaults = {
    PRIMARY: "anthropic/claude-sonnet-4.6",
    LITE: "anthropic/claude-haiku-4.5",
    IMAGE_PRIMARY: "google/gemini-2.5-flash-image",
    IMAGE_LITE: "google/gemini-2.5-flash-image",
  };

  if (process.env.NODE_ENV === "test") {
    defaults = {
      PRIMARY: "anthropic/claude-haiku-4.5",
      LITE: "anthropic/claude-haiku-4.5",
      IMAGE_PRIMARY: "google/gemini-2.5-flash-image",
      IMAGE_LITE: "google/gemini-2.5-flash-image",
    };
  }

  return {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL_PRIMARY:
      process.env.OPENROUTER_MODEL_PRIMARY || defaults.PRIMARY,
    OPENROUTER_MODEL_LITE: process.env.OPENROUTER_MODEL_LITE || defaults.LITE,
    OPENROUTER_MODEL_IMAGE_PRIMARY:
      process.env.OPENROUTER_MODEL_IMAGE_PRIMARY || defaults.IMAGE_PRIMARY,
    OPENROUTER_MODEL_IMAGE_LITE:
      process.env.OPENROUTER_MODEL_IMAGE_LITE || defaults.IMAGE_LITE,
  };
};

/**
 * Returns whether external (database-managed) prompts are enabled.
 * This is a lightweight getter that doesn't require the full env validation.
 */
export const isExternalPromptsEnabled = (): boolean => {
  return isEnvValueTruthy(process.env.USE_EXTERNAL_PROMPTS);
};

/**
 * Logs release information to the console with styled output.
 * Useful for client-side logging on app initialization.
 */
export const logReleaseInfo = (): void => {
  const info = getReleaseInfo();
  console.table(info);
};
