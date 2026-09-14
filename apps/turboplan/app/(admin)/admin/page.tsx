import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  BrainCircuit,
  MessageSquareText,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import Link from "next/link";

import { isSuperAdmin } from "@wildfires-org/turboplan-rbac";

import { auth } from "@/app/(auth)/auth";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

interface AdminCard {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
}

const adminCards: AdminCard[] = [
  {
    title: "Prompt Management",
    description:
      "View and edit AI prompts. Changes are versioned automatically.",
    href: "/admin/prompts",
    icon: MessageSquareText,
  },
  {
    title: "Webhook Logs",
    description:
      "Inspect incoming research agent webhook requests and responses.",
    href: "/admin/webhook-logs",
    icon: Webhook,
  },
  {
    title: "Cataloger",
    description: "View cataloger runs and the template entries they created.",
    href: "/admin/cataloger",
    icon: BookOpen,
  },
  {
    title: "AI Models",
    description:
      "Configure which AI models are used for chat, image generation, and other features.",
    href: "/admin/ai-models",
    icon: BrainCircuit,
  },
  {
    title: "Manage Admins",
    description:
      "Add or remove admin users. Only super admins can manage this.",
    href: "/admin/users",
    icon: ShieldCheck,
    superAdminOnly: true,
  },
];

export default async function AdminDashboardPage() {
  const session = await auth();
  const userIsSuperAdmin = isSuperAdmin(session?.user?.email);

  const breadcrumbs = [{ label: "Admin", isActive: true }];

  const visibleCards = adminCards.filter(
    (card) => !card.superAdminOnly || userIsSuperAdmin,
  );

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader breadcrumbs={breadcrumbs} />
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your TurboPlan instance.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleCards.map((card) => (
            <Link key={card.href} href={card.href}>
              <div className="flex flex-col gap-2 rounded-lg border p-5 transition-colors hover:border-primary hover:shadow-md">
                <card.icon className="size-6 text-muted-foreground" />
                <h2 className="text-lg font-semibold">{card.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {card.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
