// The two tabs of a project's Context (the page and the chat panel): what the
// assistant knows about the project, and its organization's shared context.

export type ContextTab = "project" | "organization";

type ContextTabAccess = {
  /** Organization context feature on and organization READ */
  canReadOrganizationContext: boolean;
};

/** The tabs this user sees: always the project, then the organization. */
export const getContextTabs = ({
  canReadOrganizationContext,
}: ContextTabAccess): ContextTab[] =>
  canReadOrganizationContext ? ["project", "organization"] : ["project"];

/**
 * The remembered tab while it is still shown, else the first tab.
 * `preferred` comes from localStorage, so any value is possible.
 */
export const pickContextTab = (
  tabs: readonly ContextTab[],
  preferred: unknown,
): ContextTab => tabs.find((tab) => tab === preferred) ?? tabs[0] ?? "project";

/** localStorage key of the last tab, per user (shared by page and panel). */
export const getContextTabStorageKey = (userId: string) =>
  `project-context-tab:${userId}`;

/**
 * Keyboard movement in a tab list (ARIA tabs pattern): arrows wrap around,
 * Home and End jump to the ends. Null for any other key.
 */
export const getTabIndexForKey = (
  key: string,
  currentIndex: number,
  tabCount: number,
): number | null => {
  if (tabCount === 0) {
    return null;
  }
  switch (key) {
    case "ArrowRight":
      return (currentIndex + 1) % tabCount;
    case "ArrowLeft":
      return (currentIndex - 1 + tabCount) % tabCount;
    case "Home":
      return 0;
    case "End":
      return tabCount - 1;
    default:
      return null;
  }
};
