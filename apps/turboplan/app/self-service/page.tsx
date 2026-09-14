import { auth } from "@/app/(auth)/auth";
import { SelfServiceForm } from "@/components/self-service/form";
import type { AuthUser } from "@/lib/types/auth";

export default async function SelfServicePage() {
  const session = await auth();

  return (
    <SelfServiceForm
      user={(session?.user as AuthUser) || null}
      isAuthenticated={!!session?.user}
    />
  );
}
