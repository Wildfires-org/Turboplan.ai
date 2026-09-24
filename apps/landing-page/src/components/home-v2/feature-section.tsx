"use client";

import { useEffect, useRef } from "react";

import type { LucideIcon } from "lucide-react";
import Image from "next/image";

import { PAGE_CONTAINER } from "@/components/home-v2/ui/layout";
import { ScrollReveal } from "@/components/home-v2/ui/scroll-reveal";
import {
  Eyebrow,
  HEADER_STACK_CLASS,
  SECTION_LEAD_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/home-v2/ui/section-header";
import { cn } from "@/lib/utils";

interface FeatureSectionProps {
  badge: string;
  badgeIcon: LucideIcon;
  heading: string;
  // Trailing words rendered in the brand accent, as in the other section H2s.
  headingAccent: string;
  description: string;
  visualSrc: string;
  visualAlt: string;
  videoSrc?: string;
  beaverSrc: string;
  beaverAlt: string;
  beaverFlip?: boolean;
  direction?: "left" | "right";
}

export function FeatureSection({
  badge,
  badgeIcon: Icon,
  heading,
  headingAccent,
  description,
  visualSrc,
  visualAlt,
  videoSrc,
  beaverSrc,
  beaverAlt,
  beaverFlip = false,
  direction = "left",
}: FeatureSectionProps) {
  const isTextLeft = direction === "left";
  const videoRef = useRef<HTMLVideoElement>(null);

  // Play the video only while its section is on screen; pause when it leaves.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.currentTime = 0;
          void video.play();
        } else {
          video.pause();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full">
      <div
        className={cn(
          PAGE_CONTAINER,
          "flex flex-col-reverse items-start gap-8 sm:gap-10 lg:gap-16 xl:gap-[88px]",
          isTextLeft ? "lg:flex-row" : "lg:flex-row-reverse",
        )}
      >
        {/* Text column — top-aligned, pt-18, gap-18 */}
        <ScrollReveal
          direction={isTextLeft ? "left" : "right"}
          delay={0.1}
          className="w-full shrink-0 lg:w-[420px]"
        >
          <div
            className={cn(HEADER_STACK_CLASS, "w-full items-start pt-[18px]")}
          >
            <Eyebrow icon={Icon} label={badge} />
            <h2 className={SECTION_TITLE_CLASS}>
              {heading}{" "}
              <span className="whitespace-nowrap text-brand-700">
                {headingAccent}
              </span>
            </h2>
            <p className={SECTION_LEAD_CLASS}>{description}</p>
          </div>
        </ScrollReveal>

        {/* Visual column — fills remaining space */}
        <ScrollReveal
          direction="up"
          // 60ms after the text column (30–80ms stagger band).
          delay={0.16}
          className="relative w-full min-w-0 lg:flex-1"
        >
          {/* Feature UI card — glass frame around a rounded screenshot */}
          <div className="glass-card w-full rounded-[28px] p-2 sm:p-2.5">
            <div className="flex w-full flex-col items-start overflow-hidden rounded-2xl bg-white">
              {videoSrc ? (
                <video
                  ref={videoRef}
                  src={videoSrc}
                  width={1148}
                  height={720}
                  className="h-auto w-full"
                  muted
                  playsInline
                  preload="metadata"
                  aria-label={visualAlt}
                />
              ) : (
                <Image
                  src={visualSrc}
                  alt={visualAlt}
                  width={1554}
                  height={1170}
                  className="h-auto w-full"
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              )}
            </div>
          </div>

          {/* Beaver mascot */}
          <div className="absolute -bottom-3 -right-1 sm:-bottom-4 sm:-right-2 lg:-bottom-6 lg:-right-4">
            <Image
              src={beaverSrc}
              alt={beaverAlt}
              width={153}
              height={156}
              className={cn(
                "h-[100px] w-[98px] sm:h-[120px] sm:w-[118px] lg:h-[156px] lg:w-[153px]",
                beaverFlip && "-scale-x-100",
              )}
            />
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
