import type { ReactNode } from "react";

import { SessionProvider } from "@wildfires-org/turboplan-auth/client";

import { auth } from "@/app/(auth)/auth";

export default async function InviteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  // Create session object for SessionProvider (can be null if not authenticated)
  const clientSession = session?.user
    ? {
        user: {
          id: session.user.id as string,
          email: session.user.email ?? undefined,
        },
        profile: null,
      }
    : null;

  return <SessionProvider session={clientSession}>{children}</SessionProvider>;
}
