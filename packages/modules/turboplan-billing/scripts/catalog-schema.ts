import { z } from "zod";

/**
 * Strict schema for `catalog/pricing.yaml` — the canonical pricing catalog.
 * Shared by the codegen script (generate-catalog.ts) and the Stripe sync
 * script (sync-stripe-catalog.ts) so a catalog that compiles is also a catalog
 * that can be synced. Unknown keys are rejected everywhere: a typo must fail
 * validation, not silently drop pricing data.
 */

const slug = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/, "must be a lowercase snake_case identifier");

const nonEmpty = z.string().min(1);

const planSchema = z.strictObject({
  id: slug,
  name: nonEmpty,
  headline: nonEmpty,
  capability: nonEmpty,
  jobs: z.array(nonEmpty).min(1).max(3),
  price_usd: z.number().min(0),
  period: z.enum(["month", "forever"]),
  lookup_key: slug.optional(),
  included_seats: z.number().int().positive(),
  additional_seat_price_usd: z.number().min(0).nullable(),
  additional_seat_credits: z.number().int().min(0),
  overage_usd_per_credit: z.number().positive().nullable(),
  limits: z.strictObject({
    credits: z.number().int().positive(),
    active_projects: z.number().int().positive().optional(),
  }),
  unlimited: z.array(nonEmpty).optional(),
  priority_support: z.boolean().optional(),
  hard_stop: z.boolean().optional(),
  cta: nonEmpty,
});

const discountProgramSchema = z.strictObject({
  id: slug,
  name: nonEmpty,
  headline: nonEmpty,
  description: nonEmpty,
  page_slug: slug.optional(),
  plans: z.array(slug).min(1),
  codes: z.array(z.string().regex(/^[A-Z0-9]+$/)).min(1),
  discount: z.strictObject({
    percent_off: z.number().gt(0).max(100),
    duration: z.enum(["once", "repeating", "forever"]),
    duration_in_months: z.number().int().positive().optional(),
  }),
  eligibility: z.strictObject({
    max_redemptions: z.number().int().positive().optional(),
    redeem_by: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a YYYY-MM-DD date")
      .optional(),
  }),
  cta: nonEmpty,
});

const billingSchema = z.strictObject({
  credits_per_usd: z.number().int().positive(),
  metered_billing: z.boolean(),
  price_unit: z.literal("base_plus_seats"),
  trial_days: z.number().int().min(0),
  usage_alert_thresholds: z.array(z.number().int().gt(0).max(100)).min(1),
  meter_event_name: slug,
  onboarding: z.strictObject({
    payment_step_skippable: z.boolean(),
  }),
  flat_credit_costs: z.record(slug, z.number().int().positive()),
  plans: z.array(planSchema).min(1),
  enterprise: z.strictObject({
    bullets: z.array(nonEmpty).min(1),
    cta: nonEmpty,
    contact_path: z.string().startsWith("/"),
  }),
  discount_programs: z.array(discountProgramSchema),
});

export const pricingCatalogSchema = z
  .strictObject({
    product: slug,
    billing: billingSchema,
  })
  .superRefine((catalog, ctx) => {
    const { billing } = catalog;
    const planIds = billing.plans.map((plan) => plan.id);
    const paidPlanIds = new Set(
      billing.plans.filter((plan) => plan.price_usd > 0).map((plan) => plan.id),
    );

    if (new Set(planIds).size !== planIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["billing", "plans"],
        message: "plan ids must be unique",
      });
    }

    // Runtime code derives PaidPlanKey tuples (e.g. checkout's z.enum) from
    // this guarantee — a free-only catalog would make those tuples empty.
    if (paidPlanIds.size === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["billing", "plans"],
        message: "at least one paid plan is required",
      });
    }

    const lookupKeys = billing.plans
      .map((plan) => plan.lookup_key)
      .filter((key): key is string => key !== undefined);
    if (new Set(lookupKeys).size !== lookupKeys.length) {
      ctx.addIssue({
        code: "custom",
        path: ["billing", "plans"],
        message: "lookup_key values must be unique",
      });
    }

    billing.plans.forEach((plan, index) => {
      const path = ["billing", "plans", index];
      if (plan.price_usd === 0) {
        // Free plan contract: forever period, no Stripe objects, seats not
        // purchasable (explicit null), usage hard-capped.
        if (plan.period !== "forever") {
          ctx.addIssue({
            code: "custom",
            path,
            message: `free plan "${plan.id}" must use period: forever`,
          });
        }
        if (plan.lookup_key !== undefined) {
          ctx.addIssue({
            code: "custom",
            path,
            message: `free plan "${plan.id}" must not declare a lookup_key`,
          });
        }
        if (plan.additional_seat_price_usd !== null) {
          ctx.addIssue({
            code: "custom",
            path,
            message: `free plan "${plan.id}" must declare additional_seat_price_usd: null`,
          });
        }
        if (plan.overage_usd_per_credit !== null) {
          ctx.addIssue({
            code: "custom",
            path,
            message: `free plan "${plan.id}" must declare overage_usd_per_credit: null`,
          });
        }
        if (plan.hard_stop !== true) {
          ctx.addIssue({
            code: "custom",
            path,
            message: `free plan "${plan.id}" must declare hard_stop: true`,
          });
        }
      } else {
        // Paid self-serve plan contract: monthly, Stripe-addressable, explicit
        // seat and overage economics (a $0 seat must be written as 0, not null).
        if (plan.period !== "month") {
          ctx.addIssue({
            code: "custom",
            path,
            message: `paid plan "${plan.id}" must use period: month`,
          });
        }
        if (plan.lookup_key === undefined) {
          ctx.addIssue({
            code: "custom",
            path,
            message: `paid plan "${plan.id}" must declare a lookup_key`,
          });
        }
        if (plan.additional_seat_price_usd === null) {
          ctx.addIssue({
            code: "custom",
            path,
            message: `paid plan "${plan.id}" must declare a numeric additional_seat_price_usd (0 is allowed, null is not)`,
          });
        }
        if (plan.overage_usd_per_credit === null) {
          ctx.addIssue({
            code: "custom",
            path,
            message: `paid plan "${plan.id}" must declare overage_usd_per_credit`,
          });
        }
      }
    });

    const thresholds = billing.usage_alert_thresholds;
    const isAscendingUnique = thresholds.every(
      (value, index) => index === 0 || value > (thresholds[index - 1] ?? 0),
    );
    if (!isAscendingUnique) {
      ctx.addIssue({
        code: "custom",
        path: ["billing", "usage_alert_thresholds"],
        message: "thresholds must be strictly ascending",
      });
    }

    const seenCodes = new Set<string>();
    billing.discount_programs.forEach((program, index) => {
      const path = ["billing", "discount_programs", index];
      for (const planId of program.plans) {
        if (!paidPlanIds.has(planId)) {
          ctx.addIssue({
            code: "custom",
            path,
            message: `discount program "${program.id}" references "${planId}", which is not a declared paid plan`,
          });
        }
      }
      for (const code of program.codes) {
        const normalized = code.toLowerCase();
        if (seenCodes.has(normalized)) {
          ctx.addIssue({
            code: "custom",
            path,
            message: `promotion code "${code}" is not case-insensitively unique`,
          });
        }
        seenCodes.add(normalized);
      }
      if (
        program.discount.duration === "repeating" &&
        program.discount.duration_in_months === undefined
      ) {
        ctx.addIssue({
          code: "custom",
          path,
          message: `discount program "${program.id}" with duration: repeating must declare duration_in_months`,
        });
      }
      if (
        program.discount.duration !== "repeating" &&
        program.discount.duration_in_months !== undefined
      ) {
        ctx.addIssue({
          code: "custom",
          path,
          message: `discount program "${program.id}" may only declare duration_in_months with duration: repeating`,
        });
      }
    });
  });

export type PricingCatalog = z.infer<typeof pricingCatalogSchema>;

/** Parse an unknown value into a validated catalog or throw with every issue listed. */
export const validateCatalog = (data: unknown): PricingCatalog => {
  const result = pricingCatalogSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `- ${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid pricing catalog:\n${issues}`);
  }
  return result.data;
};
