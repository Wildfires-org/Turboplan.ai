/**
 * Centralized exports for E2E configuration.
 */

export {
  OFFICE_URL_PATTERN,
  ORG_URL_PATTERN,
  PROJECT_URL_PATTERN,
  SLUG_PATTERN,
} from "./patterns";
export {
  createCitizenCredentials,
  createGovCredentials,
  createTestUserCredentials,
  getCitizenCredentials,
  getGovCredentials,
  getTestUserCredentials,
  TEST_CREDENTIALS,
  type UserCredentials,
} from "./test-credentials";
export {
  CITIZEN_GOV_PROJECT,
  CITIZEN_USER,
  GOV_USER,
  GOV_WORKSPACE,
  TEST_USER,
  TEST_WORKSPACE,
} from "./test-data";
