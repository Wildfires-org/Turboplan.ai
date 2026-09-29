import { cookies } from "next/headers";

import { SidebarContentProvider } from "@/components/providers/sidebar-content-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { NewChatProvider } from "@/contexts/new-chat-context";
import { getCachedSession, getCachedUserProfile } from "@/lib/cache/dashboard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([
    getCachedSession(),
    cookies(),
  ]);
  const profile = session?.user?.id
    ? await getCachedUserProfile(session.user.id)
    : null;
  const isPinned = cookieStore.get("sidebar_pinned")?.value === "true";

  return (
    <UserProvider user={session?.user ?? null} profile={profile}>
      <NewChatProvider>
        <SidebarContentProvider>
          <SidebarProvider defaultOpen={isPinned}>
            <AppSidebar defaultPinned={isPinned} />
            {/* Dashboard-wide page background — single source of truth for the
                #F4F9F7 (brandAlt-100) canvas behind project covers and section cards. */}
            <SidebarInset className="bg-[#F4F9F7] dark:bg-slate-950">
              {children}
            </SidebarInset>
          </SidebarProvider>
        </SidebarContentProvider>
      </NewChatProvider>
    </UserProvider>
  );
}
