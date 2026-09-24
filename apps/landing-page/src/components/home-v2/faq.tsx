"use client";

import { useId, useState } from "react";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CircleHelp, Plus } from "lucide-react";

import {
  HEADER_CONTENT_GAP,
  PAGE_GUTTER,
  SECTION_Y,
} from "@/components/home-v2/ui/layout";
import { EASE_OUT } from "@/components/home-v2/ui/motion";
import { ScrollReveal } from "@/components/home-v2/ui/scroll-reveal";
import { SectionHeader } from "@/components/home-v2/ui/section-header";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

type FaqItem = {
  question: string;
  answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: `Which NEPA documents can ${brand.name} draft?`,
    answer:
      "Scoping letters, Categorical Exclusion decision memos, Environmental Assessments and supporting reports. Every draft cites the regulation and the project location it was built from.",
  },
  {
    question: "How does it pick the right Categorical Exclusion?",
    answer:
      "It compares your project description against CE categories and past decisions from the same agency, then shows the match with its citation.",
  },
  {
    question: "How do credits work across my team?",
    answer:
      "Each plan includes a shared monthly credit pool. Everyone in the workspace draws from it, and extra seats add credits.",
  },
  {
    question: "Can the public comment on our projects?",
    answer:
      "Yes. Public projects get a comment page, and partners can submit project applications straight to your agency.",
  },
  {
    question: "Where is our project data stored?",
    // TODO: confirm copy with the team
    answer:
      "Project data is stored in encrypted cloud infrastructure. Contact us for details on hosting and compliance.",
  },
];

// Accordion recipe: height + opacity, 200ms strong ease-out.
const PANEL_TRANSITION = { duration: 0.2, ease: EASE_OUT } as const;

// Reduced motion: the panel appears/disappears at full height (no height
// animation) and only fades.
const PANEL_HIDDEN = { height: 0, opacity: 0 };
const PANEL_HIDDEN_REDUCED = { opacity: 0 };

export function Faq() {
  // Single, collapsible: at most one item open; first one open by default.
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const handleToggle = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <section
      id="faq"
      className={cn(
        PAGE_GUTTER,
        SECTION_Y,
        HEADER_CONTENT_GAP,
        "flex w-full scroll-mt-24 flex-col items-center self-stretch font-inter",
      )}
    >
      <ScrollReveal direction="up">
        <SectionHeader
          icon={CircleHelp}
          eyebrow="FAQ"
          title={
            <>
              Frequently asked <span className="text-brand-700">questions</span>
            </>
          }
        />
      </ScrollReveal>

      <ul className="flex w-full max-w-[760px] flex-col gap-3">
        {FAQ_ITEMS.map((item, index) => (
          <li key={item.question}>
            <ScrollReveal
              direction="up"
              distance={20}
              delay={0.1 + index * 0.05}
            >
              <FaqAccordionItem
                item={item}
                isOpen={openIndex === index}
                onToggle={() => handleToggle(index)}
              />
            </ScrollReveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface FaqAccordionItemProps {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}

function FaqAccordionItem({ item, isOpen, onToggle }: FaqAccordionItemProps) {
  const id = useId();
  const triggerId = `${id}-trigger`;
  const panelId = `${id}-panel`;
  const shouldReduceMotion = useReducedMotion();
  const hidden = shouldReduceMotion ? PANEL_HIDDEN_REDUCED : PANEL_HIDDEN;

  return (
    <div
      className={cn(
        "glass-card rounded-2xl px-5 transition-colors sm:px-6 duration-200 ease-[ease]",
        isOpen ? "bg-white/70" : "hover:bg-white/70",
      )}
    >
      <h3>
        <button
          id={triggerId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 py-4 text-left font-inter text-[15px] font-medium leading-[22px] text-egray-900 md:text-[16px] md:leading-[24px]"
        >
          {item.question}
          <span className="flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-white/80 text-brand-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.06)]">
            <Plus
              className={cn(
                "size-3.5 transition-[rotate] duration-200 ease-out-expo motion-reduce:transition-none",
                isOpen && "rotate-45",
              )}
              strokeWidth={2.25}
            />
          </span>
        </button>
      </h3>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={triggerId}
            initial={hidden}
            animate={{ height: "auto", opacity: 1 }}
            exit={hidden}
            transition={PANEL_TRANSITION}
            className="overflow-hidden"
          >
            <p className="max-w-[62ch] pb-5 text-[14px] leading-[22px] text-egray-700 md:text-[15px] md:leading-[24px]">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
