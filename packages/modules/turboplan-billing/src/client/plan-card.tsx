"use client";

import { Check } from "lucide-react";

import { cn } from "@wildfires-org/turboplan-utils";

import type { CatalogPlan, PlanKey } from "../types";

export interface PlanCardProps {
  plan: CatalogPlan;
  /**
   * "selectable" (default) — radio-style card for checkout flows, driven by
   * `isSelected`/`onSelect`. "cta" — static marketing card with the catalog
   * CTA as a button/link, driven by `ctaHref` or `onCtaClick`.
   */
  variant?: "selectable" | "cta";
  isSelected?: boolean;
  onSelect?: (key: PlanKey) => void;
  /** CTA target for the "cta" variant; rendered as a link when provided. */
  ctaHref?: string;
  /**
   * CTA click handler for the "cta" variant. With `ctaHref` it runs as the
   * link's onClick (e.g. analytics) and the browser handles navigation;
   * without `ctaHref` it is the button's only action.
   */
  onCtaClick?: (key: PlanKey) => void;
  className?: string;
}

const formatCredits = (credits: number): string =>
  credits.toLocaleString("en-US");

/**
 * Catalog-derived plan facts: seats, credit pool, seat expansion, project
 * limits, support tier. Everything comes from the pricing catalog so a YAML
 * edit is the only thing needed to change the cards.
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

export function PlanCard({
  plan,
  variant = "selectable",
  isSelected = false,
  onSelect,
  ctaHref,
  onCtaClick,
  className,
}: PlanCardProps) {
  const isSelectable = variant === "selectable";

  const body = (
    <>
      <h3
        className={cn(
          "text-lg font-medium",
          isSelectable && isSelected ? "text-brand-800" : "text-foreground",
        )}
      >
        {plan.name}
      </h3>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-semibold text-foreground">
          ${plan.price_usd}
        </span>
        <span className="text-sm text-muted-foreground">/mo</span>
      </div>

      <p className="mt-3 text-sm font-medium text-brand-800">{plan.headline}</p>

      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {plan.capability}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {plan.jobs.map((job) => (
          <li key={job} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-brand-800" />
            <span className="text-sm leading-snug text-muted-foreground">
              {job}
            </span>
          </li>
        ))}
      </ul>

      <ul className="mt-4 flex flex-1 flex-col gap-2 border-t border-border pt-4">
        {planFacts(plan).map((fact) => (
          <li key={fact} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
            <span className="text-sm leading-snug text-muted-foreground">
              {fact}
            </span>
          </li>
        ))}
      </ul>
    </>
  );

  if (isSelectable) {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(plan.id)}
        aria-pressed={isSelected}
        className={cn(
          "flex h-full flex-col rounded-2xl border bg-card p-5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 focus-visible:ring-offset-2",
          isSelected
            ? "border-brand-800 ring-1 ring-brand-800"
            : "border-border hover:border-brand-400",
          className,
        )}
      >
        {body}

        <div className="mt-6 flex items-center gap-2 border-t border-border pt-4">
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full border",
              isSelected ? "border-brand-800" : "border-muted-foreground/40",
            )}
          >
            {isSelected ? (
              <span className="size-2.5 rounded-full bg-brand-800" />
            ) : null}
          </span>
          <span
            className={cn(
              "text-sm",
              isSelected
                ? "font-medium text-brand-800"
                : "text-muted-foreground",
            )}
          >
            {isSelected ? "Selected" : "Select"}
          </span>
        </div>
      </button>
    );
  }

  const ctaClassName =
    "mt-6 inline-flex w-full items-center justify-center rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 focus-visible:ring-offset-2";

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl border border-border bg-card p-5 text-left",
        className,
      )}
    >
      {body}

      {ctaHref ? (
        <a
          href={ctaHref}
          onClick={() => onCtaClick?.(plan.id)}
          className={ctaClassName}
        >
          {plan.cta}
        </a>
      ) : (
        <button
          type="button"
          onClick={() => onCtaClick?.(plan.id)}
          className={ctaClassName}
        >
          {plan.cta}
        </button>
      )}
    </div>
  );
}
