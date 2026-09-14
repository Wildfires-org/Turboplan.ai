import { getSupportEmail } from "@wildfires-org/turboplan-env";

import { ContactHero } from "@/components/contact-page/contact-hero";

export default function Contact() {
  const email = getSupportEmail();
  // The mailto link is this page's only conversion path. Shipping the
  // env package's placeholder fallback would silently send visitors' mail
  // to a reserved domain — fail the build/render instead so a missing
  // NEXT_PUBLIC_SUPPORT_EMAIL is caught at deploy time, not by a customer.
  if (email === "support@example.com") {
    throw new Error(
      "NEXT_PUBLIC_SUPPORT_EMAIL (or SUPPORT_EMAIL) must be set — the /contact page renders it as the only way to reach support.",
    );
  }
  return <ContactHero email={email} />;
}
