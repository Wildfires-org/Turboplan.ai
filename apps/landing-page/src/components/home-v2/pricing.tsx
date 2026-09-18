"use client";

import { ArrowUpRight, Check, Sparkles, Tag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  CATALOG,
  type CatalogPlan,
  PLAN_ORDER,
  PLANS,
  type PlanKey,
} from "@wildfires-org/turboplan-billing/types";

import { ScrollReveal } from "@/components/home-v2/ui/scroll-reveal";
import { useAnalytics } from "@/hooks/useAnalytics";
import { cn } from "@/lib/utils";
import { events } from "@/types/analytics";
import { routing } from "@/utils/routing";

const MIDDLE_INDEX = Math.floor(PLAN_ORDER.length / 2);

const formatCredits = (credits: number): string =>
  credits.toLocaleString("en-US");

/**
 * Catalog-derived plan facts rendered as feature rows: included seats, credit
 * pool, extra-seat expansion, project limits, unlimited resources and support
 * tier. Everything comes from the pricing catalog — a YAML edit is all that is
 * needed to change the cards, and no plan fact is hardcoded.
 */
const planFacts = (plan: CatalogPlan): string[] => {
  const facts: string[] = [
    `${plan.included_seats} seats included`,
    `${formatCredits(plan.limits.credits)} credits/mo`,
  ];

  if (plan.additional_seat_price_usd !== null) {
    facts.push(
      `+$${plan.additional_seat_price_usd}/mo per extra seat (adds ${formatCredits(plan.additional_seat_credits)} credits)`,
    );
  }

  if ("active_projects" in plan.limits) {
    // Widened to `number`: the catalog literal would otherwise narrow the
    // plural check to a constant comparison TS rejects.
    const activeProjects: number = plan.limits.active_projects;
    facts.push(
      `${activeProjects} active ${activeProjects === 1 ? "project" : "projects"}`,
    );
  }

  if ("unlimited" in plan && plan.unlimited.length > 0) {
    facts.push(`Unlimited ${plan.unlimited.join(", ")}`);
  }

  if ("priority_support" in plan && plan.priority_support) {
    facts.push("Priority support");
  }

  return facts;
};

export function Pricing() {
  const router = useRouter();
  const { captureEvent } = useAnalytics();
  const enterprise = CATALOG.billing.enterprise;

  const planCtaHref = (plan: PlanKey): string =>
    plan === "starter"
      ? routing.home({ tryIt: "true" })
      : routing.checkout({ plan });

  const handlePlanClick = (plan: PlanKey) => {
    captureEvent(events.PRICING_PLAN_CLICKED, { plan });
  };

  const handleEnterpriseClick = () => {
    captureEvent(events.ENTERPRISE_CONTACT_CLICKED);
    router.push(enterprise.contact_path);
  };

  return (
    <section
      id="pricing"
      className="flex w-full flex-col items-center gap-12 self-stretch bg-gradient-to-b from-transparent to-brandAlt-100 px-6 py-16 font-inter scroll-mt-24 sm:gap-16 sm:py-20 lg:gap-[88px] lg:px-8 lg:py-[132px]"
    >
      <ScrollReveal direction="up" distance={30}>
        <div className="flex max-w-[760px] flex-col items-center gap-[18px] text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-heading text-overline font-medium uppercase text-brand-600">
            <Tag className="size-3.5" />
            PRICING
          </span>

          <h2 className="font-heading text-[36px] font-normal leading-[1.15] tracking-[-2px] text-egray-900 md:text-[48px] md:tracking-[-2.8px] lg:text-[60px] lg:tracking-[-3.6px]">
            Pick your <span className="text-brand-600">plan</span>
          </h2>

          <p className="max-w-[640px] text-body-md font-medium text-egray-600 md:text-body-lg">
            One workspace price per plan, powered by shared credits. Draft
            environmental planning documents in minutes, not weeks.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid w-full max-w-[1200px] grid-cols-1 items-stretch gap-6 lg:grid-cols-3 lg:gap-8">
        {PLAN_ORDER.map((planKey, index) => (
          <ScrollReveal
            key={planKey}
            direction="up"
            distance={30}
            delay={0.1 + index * 0.1}
            className={cn(
              "flex",
              index === MIDDLE_INDEX && "lg:-translate-y-4",
            )}
          >
            <TierCard
              plan={PLANS[planKey]}
              index={index}
              highlighted={index === MIDDLE_INDEX}
              ctaHref={planCtaHref(planKey)}
              onCtaClick={handlePlanClick}
            />
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal
        direction="up"
        distance={20}
        delay={0.2}
        className="w-full max-w-[1200px]"
      >
        <div className="flex flex-col items-start justify-between gap-6 rounded-[1.3rem] border border-brandAlt-200 bg-white p-6 shadow-ecard sm:p-8 lg:flex-row lg:items-center lg:gap-10 lg:p-10">
          <div className="flex flex-col items-start gap-3">
            <div className="flex items-center gap-2">
              <span className="font-heading text-heading-md font-normal text-egray-900">
                Enterprise
              </span>
              <span className="inline-flex items-center rounded-full bg-brandAlt-100 px-2.5 py-1 font-heading text-[10px] font-medium uppercase leading-[14px] tracking-[0.8px] text-brand-800">
                Custom
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-y-2 text-body-sm font-medium text-egray-700">
              {enterprise.bullets.map((bullet, i) => (
                <span key={bullet} className="inline-flex items-center">
                  <span>{bullet}</span>
                  {i < enterprise.bullets.length - 1 && (
                    <span className="px-3 text-brand-600">·</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleEnterpriseClick}
            className={cn(
              "group/cta relative inline-flex w-full shrink-0 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-brandAlt-600 px-7 py-3.5 sm:w-auto",
              "text-body-md font-medium text-white",
              "transition-all duration-300 ease-out-expo",
              "hover:-translate-y-px hover:shadow-ebutton active:translate-y-0",
            )}
          >
            <span className="pointer-events-none absolute left-[15%] top-1/2 aspect-square w-[250%] -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-brand-deco opacity-0 transition-all duration-500 ease-out-expo group-hover/cta:scale-100 group-hover/cta:opacity-100" />
            <span className="relative z-10 flex items-center gap-2">
              {enterprise.cta}
              <ArrowUpRight className="size-4" />
            </span>
          </button>
        </div>
      </ScrollReveal>
    </section>
  );
}

interface TierCardProps {
  plan: CatalogPlan;
  index: number;
  highlighted: boolean;
  ctaHref: string;
  onCtaClick: (plan: PlanKey) => void;
}

function TierCard({
  plan,
  index,
  highlighted,
  ctaHref,
  onCtaClick,
}: TierCardProps) {
  const nameColor = highlighted
    ? "text-brand-600"
    : index === 0
      ? "text-brandAlt-400"
      : "text-brand-800";

  return (
    <div
      className={cn(
        "relative flex w-full flex-col rounded-[1.3rem] bg-white p-5 transition-all duration-300 sm:p-6",
        highlighted
          ? "border-2 border-brand-600 shadow-[0_0_0_8px_rgba(39,193,135,0.08),0_24px_48px_rgba(39,193,135,0.18)]"
          : "border border-egray-100 shadow-ecard hover:border-brandAlt-200 hover:shadow-ecard-hover",
      )}
    >
      {highlighted && (
        <div className="absolute right-5 top-5 sm:right-6 sm:top-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 font-heading text-[11px] font-medium uppercase leading-[14px] tracking-[0.88px] text-white shadow-[0_4px_12px_rgba(39,193,135,0.4)]">
            <Sparkles className="size-3" />
            Most popular
          </span>
        </div>
      )}

      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-heading text-[28px] font-normal leading-none tracking-[-0.8px]",
            nameColor,
          )}
        >
          {plan.name}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-heading text-[36px] font-normal leading-none tracking-[-1px] text-egray-900">
          ${plan.price_usd}
        </span>
        <span className="text-[13px] font-medium leading-[18px] text-egray-600">
          /month
        </span>
      </div>

      <p className={cn("mt-3 text-body-sm font-semibold", nameColor)}>
        {plan.headline}
      </p>

      <div className="mt-4 h-px w-full bg-egray-100" />

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.88px] text-egray-600">
        {plan.capability}
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {plan.jobs.map((job) => (
          <FeatureRow key={job} highlighted={highlighted} label={job} />
        ))}
      </ul>

      <ul className="mt-3 flex flex-1 flex-col gap-2 border-t border-egray-100 pt-4">
        {planFacts(plan).map((fact) => (
          <FeatureRow key={fact} highlighted={highlighted} label={fact} />
        ))}
      </ul>

      <div className="mt-5">
        {highlighted ? (
          <Link
            href={ctaHref}
            onClick={() => onCtaClick(plan.id)}
            className={cn(
              "group/cta relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-brandAlt-600 px-5 py-2.5",
              "text-body-sm font-medium text-white",
              "transition-all duration-300 ease-out-expo",
              "hover:-translate-y-px hover:shadow-ebutton active:translate-y-0",
            )}
          >
            <span className="pointer-events-none absolute left-[15%] top-1/2 aspect-square w-[250%] -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-brand-deco opacity-0 transition-all duration-500 ease-out-expo group-hover/cta:scale-100 group-hover/cta:opacity-100" />
            <span className="relative z-10 flex items-center gap-2">
              {plan.cta}
              <ArrowUpRight className="size-3.5" />
            </span>
          </Link>
        ) : (
          <Link
            href={ctaHref}
            onClick={() => onCtaClick(plan.id)}
            className={cn(
              "inline-flex h-[38px] w-full items-center justify-center gap-2 rounded-xl border border-brandAlt-200 bg-white",
              "text-body-sm font-medium text-brand-600",
              "transition-all duration-200 ease-out-expo",
              "hover:border-brandAlt-300 hover:bg-brandAlt-100",
            )}
          >
            {plan.cta}
            <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

interface FeatureRowProps {
  highlighted: boolean;
  label: string;
}

function FeatureRow({ highlighted, label }: FeatureRowProps) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={cn(
          "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full",
          highlighted
            ? "bg-brand-600 text-white"
            : "bg-brandAlt-100 text-brand-800",
        )}
      >
        <Check className="size-2.5" strokeWidth={3} />
      </span>
      <span className="text-[13px] font-medium leading-[18px] text-egray-700">
        {label}
      </span>
    </li>
  );
}
