/**
 * Utility functions for email-related operations in self-service forms
 */

/**
 * Checks if there's a mismatch between URL email parameter and logged-in user's email.
 * Used to prevent auto-submission and show appropriate warnings.
 *
 * @param isAuthenticated - Whether user is currently authenticated
 * @param urlEmail - Email from URL parameters
 * @param userEmail - Email of the currently logged-in user
 * @returns true if emails don't match, false otherwise
 */
export function checkEmailMismatch(
  isAuthenticated: boolean,
  urlEmail: string | null,
  userEmail?: string | null,
): boolean {
  return Boolean(
    isAuthenticated &&
      urlEmail &&
      urlEmail.trim().toLowerCase() !== userEmail?.trim().toLowerCase(),
  );
}

/**
 * Generates a unique request key for auto-processing tracking.
 * Used to prevent duplicate submissions in sessionStorage.
 *
 * @param userId - User ID or undefined for anonymous users
 * @param email - Email from URL
 * @param projectTitle - Project title from URL
 * @returns Unique key string for sessionStorage
 */
export function generateAutoProcessKey(
  userId: string | undefined,
  email: string | null,
  projectTitle: string | null,
): string {
  return `autoprocess_${userId || "anonymous"}_${email}_${projectTitle}`;
}
