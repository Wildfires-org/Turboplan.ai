import { redirect } from "next/navigation";

import { isSuperAdmin } from "@wildfires-org/turboplan-rbac";

import { auth } from "@/app/(auth)/auth";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AdminUsersManager } from "./admin-users-manager";

export default async function AdminUsersPage() {
  const session = await auth();

  if (!isSuperAdmin(session?.user?.email)) {
    redirect("/admin");
  }

  const breadcrumbs = [
    { label: "Admin", href: "/admin" },
    { label: "Manage Admins", isActive: true },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader breadcrumbs={breadcrumbs} />
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Manage Admin Users</h1>
          <p className="mt-1 text-muted-foreground">
            Add or remove admin users. Only super admins can manage this.
          </p>
        </div>
        <AdminUsersManager />
      </div>
    </div>
  );
}
