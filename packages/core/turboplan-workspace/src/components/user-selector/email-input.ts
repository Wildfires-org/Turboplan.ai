import type { SearchableUser } from "../../hooks/use-user-search";

/**
 * What a typed email resolves to: its exact existing user, an email that is
 * already selected/excluded, or a new email that can be invited.
 */
export type EmailInputResolution =
  | { status: "match"; user: SearchableUser }
  | { status: "taken" }
  | { status: "new" };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value: string): boolean => {
  return EMAIL_REGEX.test(value.trim());
};

/**
 * Resolve a typed email against the search results. Returns null when the
 * input is not an email, which keeps the regular fuzzy search.
 *
 * Only an exact (trimmed, case-insensitive) email match counts: results are
 * fuzzy and can be stale from the previous query (`keepPreviousData`), so
 * showing them would let Enter pick a different person.
 *
 * @param takenEmails Lowercased emails that are excluded or already selected.
 */
export const resolveEmailInput = (
  input: string,
  users: SearchableUser[],
  takenEmails: Set<string>,
): EmailInputResolution | null => {
  if (!isValidEmail(input)) {
    return null;
  }

  const email = input.trim().toLowerCase();
  if (takenEmails.has(email)) {
    return { status: "taken" };
  }

  const user = users.find(
    (candidate) => candidate.email.toLowerCase() === email,
  );
  if (user) {
    return { status: "match", user };
  }

  return { status: "new" };
};
