import {
  generateSlug,
  generateUniqueSlug,
  isReservedSlug,
  type SlugLevel,
} from "@wildfires-org/turboplan-utils/server";

/**
 * Slug for a new entity: the plain name slug when it is free, otherwise the
 * suffixed `name-xxxxxx` form. A reserved slug (one a static app route at that
 * level would shadow) counts as taken.
 */
export const generateAvailableSlug = async (
  level: SlugLevel,
  name: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> => {
  const baseSlug = generateSlug(name);

  if (
    !baseSlug ||
    isReservedSlug(level, baseSlug) ||
    (await isTaken(baseSlug))
  ) {
    return generateUniqueSlug(name);
  }

  return baseSlug;
};

/** Rejects a caller-chosen slug that a static app route would shadow. */
export const assertSlugNotReserved = (level: SlugLevel, slug: string): void => {
  if (isReservedSlug(level, slug)) {
    throw new Error(`Slug "${slug}" is reserved`);
  }
};
