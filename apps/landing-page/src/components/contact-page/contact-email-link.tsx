"use client";

import { useAnalytics } from "@/hooks/useAnalytics";
import { cn } from "@/lib/utils";
import { events } from "@/types/analytics";

type ContactEmailLinkProps = {
  email: string;
  className?: string;
};

// The mailto anchor leaves the site, so the click is the last thing we can
// measure. The address is our own support inbox, not visitor PII.
export const ContactEmailLink = ({
  email,
  className,
}: ContactEmailLinkProps) => {
  const { captureEvent } = useAnalytics();

  const handleClick = () => {
    captureEvent(events.CONTACT_SUPPORT_CLICKED, {
      mailto: `mailto:${email}`,
    });
  };

  return (
    <a href={`mailto:${email}`} onClick={handleClick} className={cn(className)}>
      {email}
    </a>
  );
};
