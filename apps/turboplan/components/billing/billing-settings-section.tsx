"use client";

import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import { Skeleton } from "@wildfires-org/turboplan-utils";

import { BillingView } from "@/components/billing/billing-view";
import { OrgTabNav } from "@/components/dashboard/org-tab-nav";
import { STICKY_TOOLBAR_CLASS } from "@/lib/glass";

interface BillingSettingsSectionProps {
  userId: string;
  organizationId: string;
  orgSlug: string;
  /** Whether the Stripe `?checkout=success` redirect param is present. */
  checkoutSucceeded?: boolean;
}

export function BillingSettingsSection({
  userId,
  organizationId,
  orgSlug,
  checkoutSucceeded = false,
}: BillingSettingsSectionProps) {
  // Billing is owner-only (mirrors how the billing endpoints gate mutations on
  // MANAGE_MEMBERS). Non-owners see a read-only "no access" message.
  const { hasPermission: canManageBilling, isChecking } = useEntityPermission({
    userId,
    entityType: EntityType.ORGANIZATION,
    entityId: organizationId,
    action: Action.MANAGE_MEMBERS,
  });

  return (
    <div className="space-y-2">
      <div className={STICKY_TOOLBAR_CLASS}>
        <OrgTabNav orgSlug={orgSlug} />
      </div>

      {isChecking ? (
        <div className="space-y-6 py-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      ) : canManageBilling ? (
        <BillingView
          organizationId={organizationId}
          currentUserId={userId}
          orgSlug={orgSlug}
          checkoutSucceeded={checkoutSucceeded}
        />
      ) : (
        <p className="py-6 text-sm text-muted-foreground">
          Only organization owners can view and manage billing.
        </p>
      )}
    </div>
  );
}
