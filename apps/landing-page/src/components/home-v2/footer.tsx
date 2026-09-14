import Image from "next/image";

import { AnalyticsLink } from "@/components/shared/analytics-link";
import { brand } from "@/lib/brand";
import { events } from "@/types/analytics";
import { routing } from "@/utils/routing";

type FooterLink = {
  label: string;
  href: string;
  eventName: string;
};

const FOOTER_LINKS: FooterLink[] = [
  {
    label: "Projects",
    href: routing.catalog(),
    eventName: events.PROJECTS_CLICKED,
  },
  {
    label: "Docs",
    href: routing.docs(),
    eventName: events.DOCS_CLICKED,
  },
  {
    label: "Contact",
    href: routing.contact(),
    eventName: events.CONTACT_CLICKED,
  },
  {
    label: "Sign In",
    href: routing.signIn(),
    eventName: events.SIGN_IN_CLICKED,
  },
];

export function Footer() {
  return (
    <footer
      id="footer-bar"
      className="bg-transparent [padding-bottom:env(safe-area-inset-bottom)] sm:border-t sm:border-egray-100"
    >
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-5 px-6 py-6 sm:flex-row sm:justify-between sm:gap-0 sm:py-5 lg:px-28">
        {/* Copyright — last on mobile, left on desktop */}
        <p className="order-3 font-inter text-[13px] font-normal leading-[20px] text-[#6B7280] sm:order-none sm:w-[296px] sm:text-left">
          &copy; {new Date().getFullYear()} {brand.name}
        </p>

        {/* Logo — first on mobile, center on desktop */}
        <div className="order-1 flex w-full items-center justify-center sm:order-none sm:w-auto sm:flex-1">
          <Image
            src={brand.logo}
            alt={brand.name}
            width={275}
            height={45}
            className="h-9 w-auto sm:h-8 lg:h-10"
          />
        </div>

        {/* Nav links — middle on mobile, right on desktop */}
        <nav
          className="order-2 flex items-center gap-5 sm:order-none sm:w-[296px] sm:justify-end sm:gap-[24px]"
          aria-label="Footer navigation"
        >
          {FOOTER_LINKS.map((link) => (
            <AnalyticsLink
              key={link.label}
              href={link.href}
              eventName={link.eventName}
              className="py-1 font-inter text-[13px] font-normal leading-[20px] text-[#161616] transition-colors duration-200 hover:text-egray-900 sm:text-[14px]"
            >
              {link.label}
            </AnalyticsLink>
          ))}
        </nav>
      </div>
    </footer>
  );
}
