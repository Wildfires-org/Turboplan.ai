import type { CSSProperties } from "react";

import Image from "next/image";

import { cn } from "@wildfires-org/turboplan-utils";
import type { DocumentLetterhead } from "@wildfires-org/turboplan-workspace/types";

interface LetterheadBandProps {
  letterhead: DocumentLetterhead;
  logoSrc?: string | null;
  className?: string;
}

interface LetterheadLayoutProps {
  nameLines: string[];
  contactLines: string[];
  logoSrc?: string | null;
  // The letterhead's brand color for the bold name lines (null → text color).
  nameStyle?: CSSProperties;
}

// Renders a structured letterhead the way the PDF/DOCX export lays it out:
// bold name lines, smaller muted contact lines and a thin rule beneath. The
// "columns" layout puts the logo in the left margin, so the parent must leave
// room for it at md+ (the document column's gutter, or padding in a preview).
// The "banner" layout is the organization's own letterhead graphic, shown
// full width in place of the text lines. The brand color (user data, hence the
// inline styles) tints the rule and the bold name lines.
export const LetterheadBand = ({
  letterhead,
  logoSrc,
  className,
}: LetterheadBandProps) => {
  const { layout, nameLines, contactLines, color } = letterhead;
  const nameStyle = color ? { color } : undefined;
  const layoutProps = { nameLines, contactLines, logoSrc, nameStyle };

  return (
    <div
      className={cn(
        "not-prose relative mb-6 border-b border-foreground/60 pb-3 text-[13px] leading-snug text-foreground",
        className,
      )}
      style={color ? { borderBottomColor: color } : undefined}
    >
      {layout === "banner" ? (
        logoSrc && (
          <Image
            src={logoSrc}
            alt="Letterhead"
            width={1200}
            height={140}
            unoptimized
            className="h-auto max-h-[140px] w-full object-contain"
          />
        )
      ) : layout === "split" ? (
        <SplitLayout {...layoutProps} />
      ) : layout === "centered" ? (
        <CenteredLayout {...layoutProps} />
      ) : (
        <ColumnsLayout {...layoutProps} />
      )}
    </div>
  );
};

// Agency style: one bold column per name line and a right-aligned contact
// column; the logo hangs in the left margin (above the band on phones).
const ColumnsLayout = ({
  nameLines,
  contactLines,
  logoSrc,
  nameStyle,
}: LetterheadLayoutProps) => (
  <>
    {logoSrc && (
      <Image
        src={logoSrc}
        alt="Letterhead logo"
        width={44}
        height={56}
        unoptimized
        className="mb-3 h-14 w-11 object-contain object-left md:absolute md:top-0 md:right-full md:mr-3 md:mb-0 md:object-right"
      />
    )}
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      {nameLines.length > 0 && (
        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-4">
          {nameLines.map((line, index) => (
            <p
              key={`${index}-${line}`}
              className="min-w-0 font-bold"
              style={nameStyle}
            >
              {line}
            </p>
          ))}
        </div>
      )}
      <ContactBlock
        lines={contactLines}
        className="sm:ml-auto sm:shrink-0 sm:text-right"
      />
    </div>
  </>
);

// Firm style: a larger logo inline at the left with the bold name lines beside
// it, and a smaller contact block flush right.
const SplitLayout = ({
  nameLines,
  contactLines,
  logoSrc,
  nameStyle,
}: LetterheadLayoutProps) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
    <div className="flex min-w-0 items-center gap-3">
      {logoSrc && (
        <Image
          src={logoSrc}
          alt="Letterhead logo"
          width={96}
          height={72}
          unoptimized
          className="h-[72px] w-auto max-w-24 shrink-0 object-contain object-left"
        />
      )}
      <NameLines lines={nameLines} className="text-sm" style={nameStyle} />
    </div>
    <ContactBlock
      lines={contactLines}
      className="text-xs sm:ml-auto sm:shrink-0 sm:text-right"
    />
  </div>
);

// Centered: logo on top, bold name lines centered, contact lines on one
// centered line joined by middle dots.
const CenteredLayout = ({
  nameLines,
  contactLines,
  logoSrc,
  nameStyle,
}: LetterheadLayoutProps) => (
  <div className="flex flex-col items-center gap-1.5 text-center">
    {logoSrc && (
      <Image
        src={logoSrc}
        alt="Letterhead logo"
        width={96}
        height={64}
        unoptimized
        className="mb-1 h-16 w-auto max-w-40 object-contain"
      />
    )}
    <NameLines lines={nameLines} style={nameStyle} />
    {contactLines.length > 0 && (
      <p className="text-xs text-muted-foreground">
        {contactLines.join(" · ")}
      </p>
    )}
  </div>
);

const NameLines = ({
  lines,
  className,
  style,
}: {
  lines: string[];
  className?: string;
  style?: CSSProperties;
}) =>
  lines.length > 0 ? (
    <div className={cn("min-w-0 font-bold", className)} style={style}>
      {lines.map((line, index) => (
        <p key={`${index}-${line}`}>{line}</p>
      ))}
    </div>
  ) : null;

const ContactBlock = ({
  lines,
  className,
}: {
  lines: string[];
  className?: string;
}) =>
  lines.length > 0 ? (
    <div className={cn("text-muted-foreground", className)}>
      {lines.map((line, index) => (
        <p key={`${index}-${line}`}>{line}</p>
      ))}
    </div>
  ) : null;
