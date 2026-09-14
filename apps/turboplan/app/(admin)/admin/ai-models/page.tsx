import { AiModelsSettings } from "@wildfires-org/turboplan-admin/client";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";

export default function AdminAiModelsPage() {
  const breadcrumbs = [
    { label: "Admin", href: "/admin" },
    { label: "AI Models", isActive: true },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader breadcrumbs={breadcrumbs} />
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">AI Model Configuration</h1>
          <p className="mt-1 text-muted-foreground">
            Configure which AI models are used across TurboPlan. Changes take
            effect within 60 seconds.
          </p>
        </div>
        <AiModelsSettings />
      </div>
    </div>
  );
}
