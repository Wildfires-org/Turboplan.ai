// ============================================================================
// USER SEARCH TYPES
// ============================================================================

/**
 * A user returned from search results
 */
export type UserSearchResult = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  similarity: number;
};
