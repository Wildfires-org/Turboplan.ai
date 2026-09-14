export type UserLike = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

export const generateInitials = (user: UserLike, fallback = "?"): string => {
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();

  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }
  if (first) {
    return first.slice(0, 2).toUpperCase();
  }
  if (last) {
    return last.slice(0, 2).toUpperCase();
  }
  if (user.email) {
    const local = user.email.split("@")[0];
    return local.slice(0, 2).toUpperCase();
  }
  return fallback;
};

export const generateDisplayName = (
  user: UserLike,
  fallback?: string,
): string => {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  if (user.email) {
    return user.email;
  }
  return fallback ?? "";
};

export const generateInitialsFromName = (name: string): string => {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
};
