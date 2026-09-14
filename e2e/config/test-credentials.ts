/**
 * Centralized test credentials configuration.
 * Single source of truth for test user credentials used across all E2E tests.
 *
 * Provides dynamic email generation for shared test databases
 * and file-based storage for sharing credentials across test files.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * User credentials type (email only - magic link auth)
 */
export type UserCredentials = {
  email: string;
};

/**
 * Base storage directory for auth state and credentials.
 */
const STORAGE_DIR = join(process.cwd(), "storage", "auth");

/**
 * Path to store credentials for the current test run.
 * Uses the same storage directory as auth state.
 */
const CREDENTIALS_STORAGE_PATH = join(STORAGE_DIR, "credentials.json");

/** Citizen-specific credentials path */
const CITIZEN_CREDENTIALS_PATH = join(STORAGE_DIR, "citizen-credentials.json");

/** Government-specific credentials path */
const GOV_CREDENTIALS_PATH = join(STORAGE_DIR, "gov-credentials.json");

/**
 * Test credentials configuration.
 * - generateEmail(): Creates a unique email for each call
 */
export const TEST_CREDENTIALS = {
  /**
   * Generate a unique email for a new test user.
   * Uses timestamp + random suffix to ensure uniqueness.
   * If TEST_USER_EMAIL is set, uses it as base and adds random suffix before @.
   */
  generateEmail: (): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6);
    const suffix = `-${timestamp}-${random}`;

    if (process.env.TEST_USER_EMAIL) {
      // Insert random suffix before @ in the provided email
      const [localPart, domain] = process.env.TEST_USER_EMAIL.split("@");
      return `${localPart}${suffix}@${domain}`;
    }

    return `test${suffix}@example.com`;
  },
} as const;

// ── Internal helpers ────────────────────────────────────────────────

const ensureStorageDir = () => {
  if (!existsSync(STORAGE_DIR)) {
    mkdirSync(STORAGE_DIR, { recursive: true });
  }
};

const writeCredentials = (path: string, credentials: UserCredentials): void => {
  ensureStorageDir();
  writeFileSync(path, JSON.stringify(credentials, null, 2));
};

const readCredentials = (path: string): UserCredentials | null => {
  if (!existsSync(path)) {
    return null;
  }
  try {
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content) as UserCredentials;
  } catch {
    return null;
  }
};

// ── Legacy / backward-compatible API ────────────────────────────────

/**
 * Create and persist new user credentials for this test run.
 * Credentials are saved to file so they can be read by other test files.
 *
 * @deprecated Use createCitizenCredentials() or createGovCredentials() instead.
 */
export const createTestUserCredentials = (): UserCredentials => {
  const credentials: UserCredentials = {
    email: TEST_CREDENTIALS.generateEmail(),
  };

  ensureStorageDir();
  writeFileSync(CREDENTIALS_STORAGE_PATH, JSON.stringify(credentials, null, 2));

  return credentials;
};

/**
 * Read the test user credentials created during auth setup.
 * Returns null if credentials file doesn't exist.
 *
 * @deprecated Use getCitizenCredentials() or getGovCredentials() instead.
 */
export const getTestUserCredentials = (): UserCredentials | null => {
  return readCredentials(CREDENTIALS_STORAGE_PATH);
};

// ── Citizen credentials ─────────────────────────────────────────────

/**
 * Create and persist citizen user credentials.
 * Also writes to the legacy credentials.json for backward compatibility.
 */
export const createCitizenCredentials = (): UserCredentials => {
  const credentials: UserCredentials = {
    email: TEST_CREDENTIALS.generateEmail(),
  };

  writeCredentials(CITIZEN_CREDENTIALS_PATH, credentials);

  // Also write to legacy path for backward compat
  writeCredentials(CREDENTIALS_STORAGE_PATH, credentials);

  return credentials;
};

/**
 * Read citizen user credentials created during auth-citizen.setup.ts.
 */
export const getCitizenCredentials = (): UserCredentials | null => {
  return readCredentials(CITIZEN_CREDENTIALS_PATH);
};

// ── Government credentials ──────────────────────────────────────────

/**
 * Create and persist government user credentials.
 */
export const createGovCredentials = (): UserCredentials => {
  // Use a .gov email so the "I work at a govt agency" role option is available
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  const credentials: UserCredentials = {
    email: `gov-test-${timestamp}-${random}@example.gov`,
  };

  writeCredentials(GOV_CREDENTIALS_PATH, credentials);

  return credentials;
};

/**
 * Read government user credentials created during auth-gov.setup.ts.
 */
export const getGovCredentials = (): UserCredentials | null => {
  return readCredentials(GOV_CREDENTIALS_PATH);
};
