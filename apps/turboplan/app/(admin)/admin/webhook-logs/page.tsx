import { WebhookLogsView } from "@wildfires-org/turboplan-admin/client";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";

export default async function WebhookLogsPage() {
  const breadcrumbs = [
    { label: "Admin", href: "/admin" },
    { label: "Webhook Logs", isActive: true },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader breadcrumbs={breadcrumbs} />
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Webhook Logs</h1>
          <p className="text-muted-foreground mt-1">
            Inspect incoming research agent webhook requests.
          </p>
        </div>
        <WebhookLogsView />
      </div>
    </div>
  );
}
