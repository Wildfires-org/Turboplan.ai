const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Days remaining until `isoDate`, rounded up. Never negative. */
export const daysUntil = (isoDate: string | null): number => {
  if (!isoDate) {
    return 0;
  }

  const end = new Date(isoDate).getTime();
  if (Number.isNaN(end)) {
    return 0;
  }

  return Math.max(0, Math.ceil((end - Date.now()) / MS_PER_DAY));
};

/** Formats an ISO date as a long, locale-aware date, or an em dash if unset. */
export const formatDate = (isoDate: string | null): string => {
  if (!isoDate) {
    return "—";
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};
