import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isSuperAdmin } from "@wildfires-org/turboplan-rbac";
import { isAdmin } from "@wildfires-org/turboplan-rbac/server";

import { auth } from "@/app/(auth)/auth";
import { SidebarContentProvider } from "@/components/providers/sidebar-content-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCachedUserProfile } from "@/lib/cache/dashboard";
import { AdminProvider } from "./admin-context";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  const userId = session?.user?.id;
  const email = session?.user?.email;

  // Check if user is admin (super admin via env OR regular admin via DB)
  if (!userId || !(await isAdmin(userId, email))) {
    redirect("/");
  }

  const profile = session?.user?.id
    ? await getCachedUserProfile(session.user.id)
    : null;

  const superAdmin = isSuperAdmin(email);

  const cookieStore = await cookies();
  const isPinned = cookieStore.get("sidebar_pinned")?.value === "true";

  return (
    <UserProvider user={session?.user ?? null} profile={profile}>
      <SidebarContentProvider>
        <SidebarProvider defaultOpen={isPinned}>
          <AppSidebar defaultPinned={isPinned} />
          <SidebarInset>
            <AdminProvider isSuperAdmin={superAdmin}>{children}</AdminProvider>
          </SidebarInset>
        </SidebarProvider>
      </SidebarContentProvider>
    </UserProvider>
  );
}
