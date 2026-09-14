"use client";

import { Mail } from "lucide-react";

import { useAnalytics } from "@/hooks/useAnalytics";
import { events } from "@/types/analytics";

type ContactEmailLinkProps = {
  email: string;
};

// Client island inside the otherwise static ContactHero — the mailto anchor is
// the contact page's only conversion, and it leaves the site, so the click is
// the last thing we can measure. The address is our own support inbox, not
// visitor PII.
export const ContactEmailLink = ({ email }: ContactEmailLinkProps) => {
  const { captureEvent } = useAnalytics();

  const handleClick = () => {
    captureEvent(events.CONTACT_SUPPORT_CLICKED, {
      mailto: `mailto:${email}`,
    });
  };

  return (
    <a
      href={`mailto:${email}`}
      onClick={handleClick}
      className="mt-2 inline-flex h-[56px] items-center gap-3 rounded-[16px] bg-brandAlt-600 px-8 font-inter text-[18px] font-medium text-white transition-colors hover:bg-brand-600 md:text-[20px]"
    >
      <Mail className="size-5" strokeWidth={1.75} />
      {email}
    </a>
  );
};
