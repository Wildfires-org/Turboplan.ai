"use client";

import { Suspense } from "react";

import { CtaBottom } from "@/components/home-v2/cta-bottom";
import { Features } from "@/components/home-v2/features";
import { Hero } from "@/components/home-v2/hero";
import { Pricing } from "@/components/home-v2/pricing";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  return (
    <Suspense fallback={<Skeleton className="w-full h-[300px]" />}>
      <Hero />
      <Features />
      <Pricing />
      <CtaBottom />
    </Suspense>
  );
}
