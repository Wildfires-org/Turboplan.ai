"use client";

import { useEffect, useRef } from "react";

import type { LucideIcon } from "lucide-react";
import Image from "next/image";

import { ScrollReveal } from "@/components/home-v2/ui/scroll-reveal";
import { cn } from "@/lib/utils";

interface FeatureSectionProps {
  badge: string;
  badgeIcon: LucideIcon;
  heading: string;
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
          "mx-auto flex max-w-[1200px] flex-col-reverse items-start gap-8 self-stretch px-6 sm:gap-10 lg:gap-[64px] lg:px-8 xl:gap-[88px] xl:px-0",
          isTextLeft ? "lg:flex-row" : "lg:flex-row-reverse",
        )}
      >
        {/* Text column — top-aligned, pt-18, gap-18 */}
        <ScrollReveal
          direction={isTextLeft ? "left" : "right"}
          distance={30}
          delay={0.1}
          className="w-full shrink-0 lg:w-[420px]"
        >
          <div className="flex w-full flex-col items-start gap-[18px] pt-[18px]">
            {/* Badge */}
            <div className="flex items-center gap-1.5">
              <Icon className="size-4 text-brand-600" />
              <span className="font-heading text-[12px] font-medium uppercase leading-[16px] tracking-[0.24px] text-brand-600">
                {badge}
              </span>
            </div>

            {/* Heading */}
            <h2 className="font-heading text-[28px] font-normal leading-[36px] tracking-[-0.5px] text-[#161616] sm:text-[32px] sm:leading-[40px] lg:text-[48px] lg:leading-[56px] lg:tracking-[-1px]">
              {heading}
            </h2>

            {/* Description */}
            <p className="font-inter text-[16px] font-medium leading-[24px] tracking-[0.16px] text-[#6B7280]">
              {description}
            </p>
          </div>
        </ScrollReveal>

        {/* Visual column — fills remaining space */}
        <ScrollReveal
          direction="up"
          distance={30}
          delay={0.2}
          className="relative w-full min-w-0 lg:flex-1"
        >
          {/* Feature UI card — full width, rounded-[12px], white, subtle shadow */}
          <div className="flex w-full flex-col items-start overflow-hidden rounded-[12px] bg-white shadow-[0_4px_12px_0_rgba(0,0,0,0.08)]">
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
