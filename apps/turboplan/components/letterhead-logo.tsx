import Image from "next/image";

interface LetterheadLogoProps {
  src: string;
}

// Mirrors the PDF/DOCX export: the logo sits in the left margin beside the
// letterhead. Phones have no margin to spare, so it sits above it instead.
export const LetterheadLogo = ({ src }: LetterheadLogoProps) => (
  <div className="prose dark:prose-invert relative mx-auto">
    <Image
      src={src}
      alt="Letterhead logo"
      width={44}
      height={56}
      unoptimized
      className="not-prose mb-3 h-14 w-11 object-contain object-left md:absolute md:top-0 md:right-full md:mr-3 md:mb-0 md:object-right"
    />
  </div>
);
