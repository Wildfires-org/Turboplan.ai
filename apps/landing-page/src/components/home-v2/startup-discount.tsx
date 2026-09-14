"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { CATALOG } from "@wildfires-org/turboplan-billing/types";

import { useAnalytics } from "@/hooks/useAnalytics";
import { cn } from "@/lib/utils";
import { events } from "@/types/analytics";
import { routing } from "@/utils/routing";

/**
 * Startup-discount offer, restyled with the v2 design tokens. Every fact — headline,
 * description, promo code and the percent/duration line — comes from the
 * catalog's first discount program. The CTA routes to the signup entry; the
 * code itself is redeemed inside Stripe Checkout via its promotion-code field.
 */
export function StartupDiscount() {
  const router = useRouter();
  const { captureEvent } = useAnalytics();
  const program = CATALOG.billing.discount_programs[0];

  if (!program) {
    return null;
  }

  const code = program.codes[0];
  const months = program.discount.duration_in_months;
  const ctaLabel = program.cta ?? "Signup";

  const handleCta = () => {
    captureEvent(events.STARTUP_DISCOUNT_CLICKED);
    router.push(routing.home({ tryIt: "true" }));
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 font-inter lg:px-8">
      <div className="flex flex-col items-start justify-between gap-6 rounded-[1.3rem] border border-brandAlt-200 bg-brandAlt-100 p-6 shadow-ecard sm:p-8 lg:flex-row lg:items-center lg:gap-10 lg:p-10">
        <div className="flex flex-col items-start gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-heading text-[11px] font-medium uppercase leading-[14px] tracking-[0.88px] text-brand-800 shadow-ebutton">
            <Sparkles className="size-3" />
            {program.name}
          </span>

          <span className="font-heading text-heading-md font-normal text-egray-900">
            {program.headline}
          </span>

          <p className="max-w-[640px] text-body-sm font-medium text-egray-600">
            {program.description}
          </p>

          {code ? (
            <p className="text-body-sm font-medium text-egray-700">
              Use code{" "}
              <span className="rounded bg-white px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-800 shadow-ebutton">
                {code}
              </span>{" "}
              at checkout
              {months
                ? ` — ${program.discount.percent_off}% off for ${months} months`
                : ""}
              .
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleCta}
          className={cn(
            "group/cta relative inline-flex w-full shrink-0 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-brandAlt-600 px-7 py-3.5 sm:w-auto",
            "text-body-md font-medium text-white",
            "transition-all duration-300 ease-out-expo",
            "hover:-translate-y-px hover:shadow-ebutton active:translate-y-0",
          )}
        >
          <span className="pointer-events-none absolute left-[15%] top-1/2 aspect-square w-[250%] -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-brand-deco opacity-0 transition-all duration-500 ease-out-expo group-hover/cta:scale-100 group-hover/cta:opacity-100" />
          <span className="relative z-10 flex items-center gap-2">
            {ctaLabel}
            <ArrowUpRight className="size-4" />
          </span>
        </button>
      </div>
    </div>
  );
}
