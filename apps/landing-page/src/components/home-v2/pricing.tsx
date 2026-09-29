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

import {
  HEADER_CONTENT_GAP,
  PAGE_CONTAINER,
  PAGE_GUTTER,
  SECTION_Y,
} from "@/components/home-v2/ui/layout";
import { ScrollReveal } from "@/components/home-v2/ui/scroll-reveal";
import { SectionHeader } from "@/components/home-v2/ui/section-header";
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
      className={cn(
        PAGE_GUTTER,
        SECTION_Y,
        HEADER_CONTENT_GAP,
        "flex w-full scroll-mt-24 flex-col items-center self-stretch font-inter",
      )}
    >
      <ScrollReveal direction="up">
        <SectionHeader
          icon={Tag}
          eyebrow="Pricing"
          title={
            <>
              Pick your <span className="text-brand-700">plan</span>
            </>
          }
          lead="One workspace price per plan, powered by shared credits. Draft environmental planning documents in minutes, not weeks."
        />
      </ScrollReveal>

      <div
        className={cn(
          PAGE_CONTAINER,
          "grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3 lg:gap-8",
        )}
      >
        {PLAN_ORDER.map((planKey, index) => (
          <ScrollReveal
            key={planKey}
            direction="up"
            delay={0.1 + index * 0.06}
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
        className={PAGE_CONTAINER}
      >
        <div className="glass-card flex flex-col items-start justify-between gap-6 rounded-[28px] p-6 sm:p-8 lg:flex-row lg:items-center lg:gap-10 lg:p-10">
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
                    <span className="px-3 text-brand-800">·</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleEnterpriseClick}
            className="btn-primary press inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-7 text-body-md font-medium sm:w-auto"
          >
            {enterprise.cta}
            <ArrowUpRight className="size-4" />
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
  // All three pass 4.5:1 on the glass card; they stay distinct shades.
  const nameColor = highlighted
    ? "text-brand-800"
    : index === 0
      ? "text-brandAlt-600"
      : "text-brand-900";

  return (
    <div
      className={cn(
        // Hover is color only — no lift on cards this large.
        "glass-card relative flex w-full flex-col rounded-2xl p-5 transition-[background-color,box-shadow] duration-200 ease-[ease] sm:p-6",
        highlighted
          ? "!border-brand-600/60 !shadow-[0_0_0_6px_rgba(39,193,135,0.08),0_24px_40px_-18px_rgba(39,193,135,0.4),inset_0_1px_0_rgba(255,255,255,0.9)]"
          : "hover:bg-white/70",
      )}
    >
      {highlighted && (
        <div className="absolute right-5 top-5 sm:right-6 sm:top-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-800 px-3 py-1 font-heading text-[11px] font-medium uppercase leading-[14px] tracking-[0.88px] text-white shadow-[0_4px_12px_rgba(39,193,135,0.4)]">
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
        <span className="text-[13px] font-medium leading-[18px] text-egray-700">
          /month
        </span>
      </div>

      <p className={cn("mt-3 text-body-sm font-semibold", nameColor)}>
        {plan.headline}
      </p>

      <div className="mt-4 h-px w-full bg-egray-100" />

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.88px] text-egray-700">
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
            className="btn-primary press inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-body-sm font-medium"
          >
            {plan.cta}
            <ArrowUpRight className="size-3.5" />
          </Link>
        ) : (
          <Link
            href={ctaHref}
            onClick={() => onCtaClick(plan.id)}
            className={cn(
              "glass press inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl",
              "text-body-sm font-medium text-brand-800",
              "hover:bg-white/80",
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
            ? "bg-brand-700 text-white"
            : "bg-brandAlt-100 text-brand-800",
        )}
      >
        <Check className="size-2.5" strokeWidth={3} />
      </span>
      <span className="text-body-sm font-medium text-egray-700">{label}</span>
    </li>
  );
}
