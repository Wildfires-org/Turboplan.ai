import { PromptsSplitView } from "@wildfires-org/turboplan-admin/client";

import { auth } from "@/app/(auth)/auth";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

export default async function AdminPromptsPage() {
  const breadcrumbs = [
    { label: "Admin", href: "/admin" },
    { label: "Prompts", isActive: true },
  ];

  return (
    <div className="flex flex-col shrink-0 min-h-screen">
      <DashboardHeader breadcrumbs={breadcrumbs} />
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Prompt Management</h1>
          <p className="text-muted-foreground mt-1">
            View and edit AI prompts. Changes are versioned automatically.
          </p>
        </div>
        <PromptsSplitView />
      </div>
    </div>
  );
}
