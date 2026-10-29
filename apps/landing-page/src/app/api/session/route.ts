import { getSession } from "@wildfires-org/turboplan-auth/session";

// The marketing pages are static, so they can't read the auth cookie while
// rendering. The browser asks here instead. This only decodes the signed
// session cookie (no database); the answer is per-visitor and never cached.
export const dynamic = "force-dynamic";

export const GET = async () => {
  const session = await getSession();

  return Response.json(session, {
    headers: { "Cache-Control": "private, no-store" },
  });
};
