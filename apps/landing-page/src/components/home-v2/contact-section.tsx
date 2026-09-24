"use client";

import { useEffect, useRef, useState } from "react";

import {
  ArrowUpRight,
  Building2,
  Check,
  Copy,
  Landmark,
  Mail,
} from "lucide-react";

import { CATALOG } from "@wildfires-org/turboplan-billing/types";
import { getSupportEmail } from "@wildfires-org/turboplan-env";

import { ContactEmailLink } from "@/components/contact-page/contact-email-link";
import CatalogRequestDialog from "@/components/dialogs/catalog-request-dialog/catalog-request-dialog";
import {
  PAGE_CONTAINER,
  PAGE_GUTTER,
  SECTION_Y,
} from "@/components/home-v2/ui/layout";
import { ScrollReveal } from "@/components/home-v2/ui/scroll-reveal";
import { SectionHeader } from "@/components/home-v2/ui/section-header";
import { useAnalytics } from "@/hooks/useAnalytics";
import { cn } from "@/lib/utils";
import { events } from "@/types/analytics";

const COPIED_RESET_MS = 2000;
// The env package's fallback — a reserved domain nobody reads.
const PLACEHOLDER_EMAIL = "support@example.com";

const ROW_CTA_BASE =
  "press inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-body-sm font-medium";

const primaryRowCtaClassName = cn(ROW_CTA_BASE, "btn-primary");

const secondaryRowCtaClassName = cn(
  ROW_CTA_BASE,
  "glass text-brand-800 hover:bg-white/80",
);

export function ContactSection() {
  const { captureEvent } = useAnalytics();
  const email = getSupportEmail();
  const hasEmail = email !== PLACEHOLDER_EMAIL;
  const enterprise = CATALOG.billing.enterprise;

  const [isCopied, setIsCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(resetTimerRef.current), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setIsCopied(true);
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(
        () => setIsCopied(false),
        COPIED_RESET_MS,
      );
    } catch {
      // Clipboard can be blocked (permissions, insecure context); the mailto
      // link next to the button still works.
    }
  };

  const handleEnterpriseClick = () => {
    captureEvent(events.ENTERPRISE_CONTACT_CLICKED);
  };

  const handleAddToCatalog = () => {
    captureEvent(events.CATALOG_REQUEST_CLICKED);
  };

  return (
    <section
      id="contact"
      className={cn(
        PAGE_GUTTER,
        SECTION_Y,
        "flex w-full scroll-mt-24 justify-center font-inter",
      )}
    >
      <ScrollReveal direction="up" className={PAGE_CONTAINER}>
        <div className="glass-card grid w-full grid-cols-1 gap-8 rounded-[28px] p-6 sm:p-8 lg:grid-cols-2 lg:gap-12 lg:p-10">
          {/* Left — pitch + support email */}
          <div className="flex flex-col items-start gap-[18px]">
            <SectionHeader
              align="start"
              icon={Mail}
              eyebrow="Contact"
              title={
                <>
                  Get in <span className="text-brand-700">touch</span>
                </>
              }
              lead="Questions, feedback, enterprise plans — email us and a human replies, usually within one business day."
              className="max-w-[480px]"
            />

            {hasEmail && (
              <div className="glass mt-1 inline-flex max-w-full items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5">
                <Mail className="size-4 shrink-0 text-brand-800" />
                <ContactEmailLink
                  email={email}
                  className="min-w-0 truncate text-body-sm font-medium text-egray-900 underline-offset-4 transition-colors duration-200 ease-out-expo hover:text-brand-800 hover:underline"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label={isCopied ? "Email copied" : "Copy email address"}
                  className="press inline-grid h-7 shrink-0 items-center rounded-full bg-white/80 px-2.5 text-[12px] font-medium text-brand-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.06)] hover:bg-white"
                >
                  {/* Both labels share one grid cell, so the button is always
                      as wide as "Copied" — no layout jump on swap. */}
                  <CopyLabel isVisible={!isCopied}>
                    <Copy className="size-3" />
                    Copy
                  </CopyLabel>
                  <CopyLabel isVisible={isCopied}>
                    <Check className="size-3" strokeWidth={2.5} />
                    Copied
                  </CopyLabel>
                  <span className="sr-only" aria-live="polite">
                    {isCopied ? "Copied" : ""}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Right — enterprise + agencies */}
          <div className="flex flex-col justify-center gap-3">
            <ContactRow
              icon={Building2}
              title="Enterprise"
              description="SSO, custom credit pools, onboarding"
            >
              {/* The catalog's enterprise contact_path points back at this
                  section, so go straight to email instead. */}
              <a
                href={`mailto:${email}?subject=${encodeURIComponent("Enterprise plan")}`}
                onClick={handleEnterpriseClick}
                className={primaryRowCtaClassName}
              >
                {enterprise.cta}
                <ArrowUpRight className="size-3.5" />
              </a>
            </ContactRow>

            <ContactRow
              icon={Landmark}
              title="Agencies"
              description="Add your office to the public catalog"
            >
              <CatalogRequestDialog>
                <button
                  type="button"
                  onClick={handleAddToCatalog}
                  className={secondaryRowCtaClassName}
                >
                  Add to Catalog
                  <ArrowUpRight className="size-3.5" />
                </button>
              </CatalogRequestDialog>
            </ContactRow>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

interface CopyLabelProps {
  isVisible: boolean;
  children: React.ReactNode;
}

// 150ms crossfade with a 2px rise; reduced motion keeps only the fade.
const CopyLabel = ({ isVisible, children }: CopyLabelProps) => {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "col-start-1 row-start-1 inline-flex items-center justify-center gap-1",
        "transition-[opacity,translate] duration-150 ease-out-expo motion-reduce:translate-y-0",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-0.5 opacity-0",
      )}
    >
      {children}
    </span>
  );
};

interface ContactRowProps {
  icon: typeof Mail;
  title: string;
  description: string;
  children: React.ReactNode;
}

function ContactRow({
  icon: Icon,
  title,
  description,
  children,
}: ContactRowProps) {
  return (
    <div className="glass flex flex-col items-start gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-brand-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.06)]">
          <Icon className="size-4" />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-[17px] font-normal leading-[24px] text-egray-900">
            {title}
          </span>
          <span className="text-body-sm font-medium text-egray-700">
            {description}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
