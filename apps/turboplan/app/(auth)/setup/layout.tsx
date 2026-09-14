import { redirect } from "next/navigation";

import { SessionProvider } from "@wildfires-org/turboplan-auth/client";
import { hasChosenPlan } from "@wildfires-org/turboplan-billing/server";

import { auth } from "@/app/(auth)/auth";
import { checkProfileCompletion } from "@/lib/setup-helpers";

export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login");
  }

  const { hasCompleteProfile } = await checkProfileCompletion(userId);

  // Setup is finished only once BOTH steps are done: profile complete AND a
  // plan chosen on the personal org (hasChosenPlan is always true when the
  // billing package is disabled). A complete profile alone keeps /setup/plan
  // reachable so returning users can finish the plan step.
  if (hasCompleteProfile && (await hasChosenPlan(userId))) {
    redirect("/");
  }

  const clientSession = {
    user: {
      id: userId,
      email: session.user?.email ?? undefined,
    },
    profile: null,
  };

  return <SessionProvider session={clientSession}>{children}</SessionProvider>;
}
