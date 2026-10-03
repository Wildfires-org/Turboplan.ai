"use client";

import { ContactSection } from "@/components/home-v2/contact-section";
import { CtaBottom } from "@/components/home-v2/cta-bottom";
import { Faq } from "@/components/home-v2/faq";
import { Features } from "@/components/home-v2/features";
import { Hero } from "@/components/home-v2/hero";
import { LogoMarquee } from "@/components/home-v2/logo-marquee";
import { Pricing } from "@/components/home-v2/pricing";

export default function Home() {
  return (
    <div className="w-full overflow-x-clip bg-brandAlt-100">
      <Hero />
      <LogoMarquee />
      <Features />
      <Pricing />
      <Faq />
      <ContactSection />
      <CtaBottom />
    </div>
  );
}
