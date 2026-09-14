import type { Context } from "hono";

import { CATALOG, creditsFromUsage, extractOpenRouterCost } from "../types";
import {
  assertCreditsAvailable,
  type CreditSource,
  CreditsExhaustedError,
  consumeCredits,
} from "./credits";

/** Billing target threaded from the request into tool implementations. */
export type BillingContext = {
  organizationId: string;
  userId?: string;
};

/**
 * Record one finished AI call against the billing org. Consume-only — the
 * request-level gate already ran. Never throws: metering must not break the
 * feature that triggered it.
 */
export const meterAiCall = async ({
  billing,
  source,
  usage,
  providerMetadata,
  costUsd,
  model,
  metadata,
}: {
  billing: BillingContext | null | undefined;
  source: CreditSource;
  usage: { totalTokens?: number } | undefined;
  providerMetadata?: unknown;
  /** Pre-computed cost (e.g. summed across steps); wins over providerMetadata. */
  costUsd?: number;
  model?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> => {
  if (!billing) {
    return;
  }
  try {
    const cost = costUsd ?? extractOpenRouterCost(providerMetadata);

    await consumeCredits({
      organizationId: billing.organizationId,
      userId: billing.userId,
      amount: creditsFromUsage({
        costUsd: cost,
        totalTokens: usage?.totalTokens,
      }),
      source,
      model,
      costUsd: cost,
      metadata,
    });
  } catch (error) {
    console.error(`[billing] ${source} credit consumption failed:`, error);
  }
};

/**
 * Flat-cost consumption for one successful image generation — the single
 * owner of the model-slot → catalog-cost mapping. Never throws.
 */
export const consumeImageGenerationCredits = async ({
  billing,
  modelSlot,
  model,
  metadata,
}: {
  billing: BillingContext | null | undefined;
  modelSlot: "image-primary" | "image-lite";
  model?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> => {
  if (!billing) {
    return;
  }
  const flatCosts = CATALOG.billing.flat_credit_costs;
  await consumeCredits({
    organizationId: billing.organizationId,
    userId: billing.userId,
    amount:
      modelSlot === "image-primary"
        ? flatCosts.image_generation_primary
        : flatCosts.image_generation_lite,
    source: "image",
    model,
    metadata,
  }).catch((error: unknown) => {
    console.error("[billing] image credit consumption failed:", error);
  });
};

/**
 * Hono-route credit gate: returns the canonical 402 response when the org is
 * hard-stopped, null when the request may proceed (including when there is no
 * billing org to gate). One owner for the 402 wire contract.
 *
 * `amount` reserves headroom for a known flat-cost call — see
 * {@link assertCreditsAvailable}. Omit for unbounded-cost sources.
 */
export const gateCreditsOr402 = async (
  c: Context,
  organizationId: string | null | undefined,
  amount = 0,
): Promise<Response | null> => {
  if (!organizationId) {
    return null;
  }
  try {
    await assertCreditsAvailable(organizationId, amount);
    return null;
  } catch (error) {
    if (error instanceof CreditsExhaustedError) {
      return c.json({ error: error.message, code: "CREDITS_EXHAUSTED" }, 402);
    }
    throw error;
  }
};
