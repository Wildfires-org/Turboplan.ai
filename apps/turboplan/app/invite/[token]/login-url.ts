/**
 * Login URL that returns to this invitation after the magic link, with the
 * invited email prefilled. The login flow only honours same-site paths.
 */
export const buildInviteLoginUrl = (token: string, email?: string) => {
  const params = new URLSearchParams();
  if (email) {
    params.set("email", email);
  }
  params.set("callbackUrl", `/invite/${encodeURIComponent(token)}`);
  return `/login?${params.toString()}`;
};
