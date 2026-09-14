import { ContactEmailLink } from "@/components/contact-page/contact-email-link";

type ContactHeroProps = {
  email: string;
};

export const ContactHero = ({ email }: ContactHeroProps) => {
  return (
    <section className="flex flex-1 w-full items-center justify-center bg-[#F9FDFC] px-6 py-20">
      <div className="flex max-w-[640px] flex-col items-center gap-6 text-center">
        <h1 className="font-heading text-[40px] font-normal leading-[1.1] tracking-[-2px] text-[#1A1A1A] md:text-[56px] md:tracking-[-2.8px]">
          Get in touch
        </h1>
        <p className="font-inter text-[17px] leading-[1.55] text-egray-600 md:text-[20px]">
          Questions, feedback, enterprise plans — email us and a human replies,
          usually within one business day.
        </p>
        <ContactEmailLink email={email} />
      </div>
    </section>
  );
};
