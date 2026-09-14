import { CatalogerAdminView } from "@wildfires-org/turboplan-admin/client";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";

export default async function CatalogerPage() {
  const breadcrumbs = [
    { label: "Admin", href: "/admin" },
    { label: "Cataloger", isActive: true },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader breadcrumbs={breadcrumbs} />
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Cataloger</h1>
          <p className="text-muted-foreground mt-1">
            Inspect cataloger runs and created template entries.
          </p>
        </div>
        <CatalogerAdminView />
      </div>
    </div>
  );
}
