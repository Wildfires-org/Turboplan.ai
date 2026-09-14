import { and, eq, isNull } from "drizzle-orm";

import { billingCreditUsage, organization } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { getApiEnv } from "@wildfires-org/turboplan-env";
import { getMailService } from "@wildfires-org/turboplan-mail/server";

import { CATALOG, type PlanKey, planHasHardStop } from "../types";
import { getOrganizationOwnerEmails } from "./queries";

/**
 * Usage alerts at the catalog thresholds (70/90/100%). Dedupe is the
 * `alertNN_sent_at` stamp on the period's usage row — a conditional UPDATE
 * with `WHERE ... IS NULL RETURNING` elects exactly one winner per threshold
 * per period, so concurrent consumers cannot double-send.
 *
 * Best-effort by design: called fire-and-forget after consumption; a mail or
 * DB hiccup loses at most one alert, never billing data.
 */

/**
 * Pure: thresholds crossed by moving from `usedBefore` to `usedAfter` against
 * `allowance`. A threshold is crossed when the BEFORE value was under it and
 * the AFTER value reaches it.
 */
export const crossedThresholds = ({
  usedBefore,
  usedAfter,
  allowance,
  thresholds,
}: {
  usedBefore: number;
  usedAfter: number;
  allowance: number;
  thresholds: readonly number[];
}): number[] => {
  if (allowance <= 0) {
    return [];
  }
  return thresholds.filter((threshold) => {
    const cutoff = (allowance * threshold) / 100;
    return usedBefore < cutoff && usedAfter >= cutoff;
  });
};

const ALERTS = {
  70: { column: billingCreditUsage.alert70SentAt, name: "alert70SentAt" },
  90: { column: billingCreditUsage.alert90SentAt, name: "alert90SentAt" },
  100: { column: billingCreditUsage.alert100SentAt, name: "alert100SentAt" },
} as const;

type AlertThreshold = keyof typeof ALERTS;

const isStampableThreshold = (value: number): value is AlertThreshold =>
  value === 70 || value === 90 || value === 100;

/**
 * Stamps every crossed threshold and emails org owners about the HIGHEST one
 * (a burst that jumps 0→100% sends one email, not three; the lower stamps are
 * still set so no later, stale alert fires).
 */
export const maybeSendUsageAlerts = async (params: {
  organizationId: string;
  periodStart: Date;
  usedBefore: number;
  usedAfter: number;
  allowance: number;
  plan: PlanKey;
}): Promise<void> => {
  const crossed = crossedThresholds({
    usedBefore: params.usedBefore,
    usedAfter: params.usedAfter,
    allowance: params.allowance,
    thresholds: CATALOG.billing.usage_alert_thresholds,
  }).filter(isStampableThreshold);

  if (crossed.length === 0) {
    return;
  }

  // `crossed` preserves catalog order, and the catalog schema enforces
  // strictly-ascending thresholds — so the last winner IS the highest.
  let highestWon: AlertThreshold | null = null;
  for (const threshold of crossed) {
    const { column, name } = ALERTS[threshold];
    const [winner] = await db
      .update(billingCreditUsage)
      .set({ [name]: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(billingCreditUsage.organizationId, params.organizationId),
          eq(billingCreditUsage.periodStart, params.periodStart),
          isNull(column),
        ),
      )
      .returning({ id: billingCreditUsage.id });
    if (winner) {
      highestWon = threshold;
    }
  }

  if (highestWon === null) {
    return;
  }

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, params.organizationId),
    columns: { slug: true, name: true },
  });
  if (!org) {
    return;
  }

  const ownerEmails = await getOrganizationOwnerEmails(params.organizationId);
  if (ownerEmails.length === 0) {
    return;
  }

  const billingUrl = `${getApiEnv().TURBOPLAN_URL}/organizations/${org.slug}/billing`;
  const mailService = getMailService();

  await Promise.all(
    ownerEmails.map((email) =>
      mailService
        .sendUsageAlertEmail({
          to: email,
          orgName: org.name,
          percentage: highestWon,
          creditsUsed: params.usedAfter,
          allowance: params.allowance,
          hardStop: planHasHardStop(params.plan),
          billingUrl,
          recipientEmail: email,
        })
        .catch((error) => {
          console.error(
            `[billing] usage alert email to ${email} failed:`,
            error,
          );
        }),
    ),
  );
};
