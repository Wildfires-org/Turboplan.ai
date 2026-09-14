"use client";

import { useEffect, useState } from "react";

import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import CatalogRequestDialog from "@/components/dialogs/catalog-request-dialog/catalog-request-dialog";
import { useTypewriterHeading } from "@/components/home-v2/ui/typewriter-heading";
import { useAnalytics } from "@/hooks/useAnalytics";
import { cn } from "@/lib/utils";
import { events } from "@/types/analytics";
import { routing } from "@/utils/routing";
import { Footer } from "./footer";

const CTA_WORDS = [
  "environmental planning ?",
  "road repairs ?",
  "forestry ?",
  "forest treatments ?",
  "nuclear power plants ?",
];

const CURSOR_BLINK_RATE = 530;

export function CtaBottom() {
  const router = useRouter();
  const { captureEvent } = useAnalytics();
  const { displayText, currentIndex } = useTypewriterHeading(CTA_WORDS);

  // Blinking cursor
  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    const interval = setInterval(
      () => setShowCursor((prev) => !prev),
      CURSOR_BLINK_RATE,
    );
    return () => clearInterval(interval);
  }, []);

  // Track index changes for sparkle animation
  const [sparkleKey, setSparkleKey] = useState(0);
  useEffect(() => {
    setSparkleKey((key) => key + 1);
  }, [currentIndex]);

  const handleCreateProject = () => {
    captureEvent(events.TRY_IT_CLICKED);
    router.push(routing.home({ tryIt: "true" }));
  };

  const handleAddToCatalog = () => {
    captureEvent(events.CATALOG_REQUEST_CLICKED);
  };

  return (
    <section
      id="cta-footer"
      className="relative flex min-h-0 w-full flex-col overflow-hidden bg-gradient-to-b from-[#F9FDFC] to-[#F4F9F7] to-[44.235%] py-16 sm:py-20 md:min-h-[80vh] md:py-0 lg:min-h-screen"
    >
      {/* CTA content — vertically centered, takes remaining space */}
      <div className="relative flex flex-1 items-center justify-center pt-[35px]">
        <div className="flex flex-col items-center gap-8 px-6 text-center">
          {/* Heading — slide up */}
          <motion.h2
            initial={{ opacity: 0, y: 80 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{
              type: "spring",
              stiffness: 50,
              damping: 18,
              mass: 1,
            }}
            className="min-h-[100px] max-w-[726px] font-heading text-[36px] font-normal leading-[1.15] tracking-[-2px] text-[#1A1A1A] md:min-h-[120px] md:text-[48px] md:tracking-[-2.8px] lg:min-h-[140px] lg:text-[60px] lg:tracking-[-3.6px]"
          >
            {/* Stable accessible name — the typewriter below mutates every
                few ms and would spam screen readers. */}
            <span className="sr-only">
              Ready to accelerate your environmental planning?
            </span>
            <span aria-hidden="true" className="block">
              Ready to accelerate your
            </span>
            <span aria-hidden="true" className="inline">
              <motion.span
                key={sparkleKey}
                initial={{ scale: 1.3, rotate: 25 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 15,
                  duration: 0.5,
                }}
                className="mr-2 inline-flex align-middle text-[#27C187] lg:mr-3"
              >
                <Sparkles className="size-[28px] md:size-[35px] lg:size-[42px]" />
              </motion.span>
              <span className="text-[#27C187]">
                {displayText}
                <span
                  className={cn(
                    "ml-[1px] inline-block w-[3px] bg-[#27C187] transition-opacity duration-100",
                    showCursor ? "opacity-100" : "opacity-0",
                  )}
                  style={{ height: "0.75em" }}
                />
              </span>
            </span>
          </motion.h2>

          {/* Button row — slide up with delay */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{
              type: "spring",
              stiffness: 50,
              damping: 18,
              mass: 1,
              delay: 0.25,
            }}
            className="flex w-full max-w-[420px] flex-col items-center gap-4 sm:w-auto sm:max-w-none sm:flex-row"
          >
            {/* Secondary — Add to Catalog (opens catalog request dialog) */}
            <CatalogRequestDialog>
              <button
                type="button"
                onClick={handleAddToCatalog}
                className="inline-flex h-[48px] w-full items-center justify-center rounded-[15.558px] border border-[#D1E6DE] bg-white font-inter text-[16px] font-medium tracking-[0.16px] text-brand-600 shadow-[inset_0_0_34.727px_0_rgba(224,241,255,0.10)] transition-all duration-200 hover:border-[#A4CEBE] hover:shadow-[inset_0_0_34.727px_0_rgba(224,241,255,0.20)] sm:w-[202px]"
              >
                Add to Catalog
              </button>
            </CatalogRequestDialog>

            {/* Primary — Create Project (try-it flow) */}
            <button
              type="button"
              onClick={handleCreateProject}
              className={cn(
                "group/cta relative inline-flex h-[48px] w-full items-center justify-center gap-2 overflow-hidden rounded-[16px] bg-brandAlt-600 px-[32px] py-[12px] sm:w-[202px]",
                "font-inter text-[16px] font-medium tracking-[0.16px] text-white",
                "transition-all duration-300 ease-out-expo",
                "hover:-translate-y-px hover:shadow-ebutton",
                "active:translate-y-0",
              )}
            >
              {/* Floating deco ellipse — scales up on hover */}
              <Image
                src="/images/button-deco.svg"
                alt=""
                width={109}
                height={69}
                aria-hidden
                className="pointer-events-none absolute left-0 top-[14px] h-[69px] w-[109px] animate-btn-deco-float blur-[13.65px] transition-all duration-500 ease-out-expo group-hover/cta:scale-[3] group-hover/cta:opacity-0"
              />
              {/* Glow flood — radial expansion from deco position */}
              <span className="pointer-events-none absolute left-[15%] top-1/2 aspect-square w-[250%] -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-[#05B871] opacity-0 transition-all duration-500 ease-out-expo group-hover/cta:scale-100 group-hover/cta:opacity-100" />
              <span className="relative z-10 flex items-center gap-2">
                Create Project
                <ArrowUpRight className="size-4" />
              </span>
            </button>
          </motion.div>
        </div>
      </div>

      {/* Footer pinned at bottom */}
      <motion.div
        id="footer-nav"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{
          type: "spring",
          stiffness: 50,
          damping: 18,
          mass: 1,
          delay: 0.5,
        }}
      >
        <Footer />
      </motion.div>
    </section>
  );
}
