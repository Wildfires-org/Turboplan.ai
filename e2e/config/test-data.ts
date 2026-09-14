/**
 * Centralized test data constants.
 * Single source of truth for test workspace names and other test data.
 */

/**
 * Available user roles for the setup wizard.
 * Note: "government_agency" requires a .gov email address.
 */
export type UserRole =
  | "government_agency"
  | "environmental_planning"
  | "citizen";

// ── Citizen user (default) ──────────────────────────────────────────

export const CITIZEN_USER = {
  FIRST_NAME: "Test",
  LAST_NAME: "User",
  JOB_TITLE: "QA Engineer",
  DEPARTMENT: "Testing",
  /** Default user role for tests - citizen is simplest (no org/office selection required) */
  USER_ROLE: "citizen" as UserRole,
} as const;

/** @deprecated Use CITIZEN_USER instead */
export const TEST_USER = CITIZEN_USER;

export const TEST_WORKSPACE = {
  OFFICE_NAME: "Test Office",
  OFFICE_DESCRIPTION: "Office for E2E testing",
  PROJECT_NAME: "Test Project",
  PROJECT_DESCRIPTION: "Highway 101 repair in Redwood NP",
  PROJECT_PROMPT:
    "We're coordinating highway repair efforts along a 12-mile segment of Route 101 in Redwood National Park, California. The roadway currently has significant pothole damage, crumbling shoulders, and failing culverts from recent storm events. Our goal is to restore the road surface, replace damaged drainage infrastructure, and improve wildlife crossing safety.",
} as const;

// ── Government agency user ──────────────────────────────────────────

export const GOV_USER = {
  FIRST_NAME: "Gov",
  LAST_NAME: "Officer",
  JOB_TITLE: "City Planner",
  DEPARTMENT: "Urban Planning",
  USER_ROLE: "government_agency" as UserRole,
} as const;

export const GOV_WORKSPACE = {
  OFFICE_NAME: "Planning Department",
  OFFICE_DESCRIPTION: "Government planning office",
  PROJECT_NAME: "Public Infrastructure",
  PROJECT_DESCRIPTION: "Public infrastructure project",
  PROJECT_PROMPT:
    "We're planning public infrastructure improvements for downtown Springfield, Oregon. The current storm drain system is undersized and causes street flooding during heavy rain events. We want to upgrade the drainage capacity, repave affected roadways, and add bioswales along Main Street to reduce runoff into the Willamette River.",
} as const;

// ── Citizen project in gov office (for access isolation tests) ────

export const CITIZEN_GOV_PROJECT = {
  PROJECT_NAME: "Citizen Submitted Project",
  PROJECT_DESCRIPTION:
    "Citizen project submitted to gov office for testing access isolation",
} as const;
