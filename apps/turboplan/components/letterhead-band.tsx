"use client";

import type { CSSProperties } from "react";

import Image from "next/image";

import { cn } from "@wildfires-org/turboplan-utils";
import {
  GRID_LINE_SCALE,
  type GridVerticalAlign,
  gridBaseFontRatio,
  gridLogoCells,
  type PublicDocumentLetterhead,
  type PublicGridLetterhead,
} from "@wildfires-org/turboplan-workspace/types";

import { useLetterheadLogoState } from "@/hooks/use-letterhead-logo";
import { type GridBandCell, layoutGridBand } from "@/lib/letterhead-grid-band";

export interface LetterheadBandProps {
  letterhead: PublicDocumentLetterhead;
  // The letterhead's single logo: the margin/inline logo or banner graphic of
  // a settings layout, and the margin logo of a grid without logo cells (the
  // office → organization logo).
  logoSrc?: string | null;
  // Where a grid's logo cells come from (`useLetterheadLogo` by index). A grid
  // rendered without a project leaves its logo cells empty.
  projectId?: string | null;
  documentId?: string | null;
  // A grid's logo images by logo `index` (`gridLogoCells` order), used
  // instead of fetching them through the letterhead-logo proxy — the
  // letterhead editor previews logos that are not saved yet. A null or
  // missing entry leaves that logo cell empty. Ignored by the other layouts.
  logoSrcs?: (string | null)[];
  // With `logoSrcs`: by logo `index`, true while that logo is still loading,
  // so its cell keeps the logo's box instead of collapsing (as a proxied logo
  // does while it loads).
  logoLoading?: boolean[];
  className?: string;
}

interface LetterheadLayoutProps {
  nameLines: string[];
  contactLines: string[];
  logoSrc?: string | null;
  // The letterhead's brand color for the bold name lines (null → text color).
  nameStyle?: CSSProperties;
}

interface GridLayoutProps {
  grid: PublicGridLetterhead;
  marginLogoSrc?: string | null;
  projectId?: string | null;
  documentId?: string | null;
  logoSrcs?: (string | null)[];
  logoLoading?: boolean[];
  nameStyle?: CSSProperties;
}

type GridTextBandCell = Extract<GridBandCell, { kind: "text" }>;
type GridLogoBandCell = Extract<GridBandCell, { kind: "logo" }>;

interface GridLogoProps {
  cell: GridLogoBandCell;
  projectId?: string | null;
  documentId?: string | null;
  logoSrcs?: (string | null)[];
  logoLoading?: boolean[];
}

// The grid's own breakpoints follow the band's width, not the viewport's: the
// `band-wide:` variant (tailwind.config.ts) is a container query on the band
// (a size container) from 30rem — a narrow band (the editor's preview on a
// small screen, a narrow document column) stacks like a phone does.

// A text cell's alignment once the band is wide; a narrow band stacks the
// cells and left-aligns them all.
const GRID_ALIGN_CLASS = {
  left: "band-wide:text-left",
  center: "band-wide:text-center",
  right: "band-wide:text-right",
} as const;

// Where a cell (text or logo) sits in the row's height once the band is
// wide: the row is as tall as its tallest cell, so a shorter one moves down
// by what the exporters offset it (`gridCellOffset`) without measuring. A
// narrow band stacks the cells and ignores it.
const GRID_VALIGN_CLASS: Record<GridVerticalAlign, string | undefined> = {
  top: undefined,
  middle: "band-wide:self-center",
  bottom: "band-wide:self-end",
};

// A grid band is a size container, so its text can be sized from its width.
// In dark mode it is a sheet of white paper: a reference's brand colours and
// its logo crops (often on white) stay as they were printed.
const GRID_BAND_CLASS =
  "[container-type:inline-size] dark:rounded-t-md dark:border-neutral-900/60 dark:bg-white dark:px-4 dark:pt-3 dark:text-neutral-900";

// A grid logo's box: a small 40px logo in a narrow band, its column's share
// of the width (`--grid-logo-width`) in a wide one; the height follows the
// aspect.
const GRID_LOGO_CLASS =
  "h-10 w-auto max-w-[45%] shrink-0 band-wide:row-start-1 band-wide:h-auto band-wide:w-[var(--grid-logo-width)] band-wide:max-w-none";

// Renders a structured letterhead the way the PDF/DOCX export lays it out:
// bold name lines, smaller muted contact lines and a thin rule beneath. The
// "columns" layout puts the logo in the left margin, so the parent must leave
// room for it at md+ (the document column's gutter, or padding in a preview).
// The "banner" layout is the organization's own letterhead graphic, shown
// full width in place of the text lines. A "grid" (a reference's copy) is one
// row of cells across the full width, placed like the exporters place them;
// its band is a size container (the text scales with its width, and the
// cells stack when it is narrow), so it needs a definite width — any block
// parent gives it one, a shrink-to-fit parent (inline-block, flex row) would
// collapse it. The brand color (user data,
// hence the inline styles) tints the rule and the bold name lines.
export const LetterheadBand = ({
  letterhead,
  logoSrc,
  projectId,
  documentId,
  logoSrcs,
  logoLoading,
  className,
}: LetterheadBandProps) => {
  const { nameLines, contactLines, color } = letterhead;
  const nameStyle = color ? { color } : undefined;
  const layoutProps = { nameLines, contactLines, logoSrc, nameStyle };

  return (
    <div
      data-testid="letterhead-band"
      className={cn(
        "not-prose relative mb-6 border-b border-foreground/60 pb-3 text-[13px] leading-snug text-foreground",
        letterhead.layout === "grid" && GRID_BAND_CLASS,
        className,
      )}
      style={color ? { borderBottomColor: color } : undefined}
    >
      {letterhead.layout === "grid" ? (
        <GridLayout
          grid={letterhead.grid}
          marginLogoSrc={logoSrc}
          projectId={projectId}
          documentId={documentId}
          logoSrcs={logoSrcs}
          logoLoading={logoLoading}
          nameStyle={nameStyle}
        />
      ) : letterhead.layout === "banner" ? (
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
      ) : letterhead.layout === "split" ? (
        <SplitLayout {...layoutProps} />
      ) : letterhead.layout === "centered" ? (
        <CenteredLayout {...layoutProps} />
      ) : (
        <ColumnsLayout {...layoutProps} />
      )}
    </div>
  );
};

// The logo hanging in the left margin, beside the letterhead (above it on
// phones, which have no margin to spare).
const MarginLogo = ({ src }: { src: string }) => (
  <Image
    src={src}
    alt="Letterhead logo"
    width={44}
    height={56}
    unoptimized
    className="mb-3 h-14 w-11 object-contain object-left md:absolute md:top-0 md:right-full md:mr-3 md:mb-0 md:object-right"
  />
);

// Agency style: one bold column per name line and a right-aligned contact
// column; the logo hangs in the left margin (above the band on phones).
const ColumnsLayout = ({
  nameLines,
  contactLines,
  logoSrc,
  nameStyle,
}: LetterheadLayoutProps) => (
  <>
    {logoSrc && <MarginLogo src={logoSrc} />}
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

// A reference's letterhead: one row of cells, each in its own column of a
// CSS grid whose columns are the shared layout's segments (see
// `layoutGridBand`), so the row is as tall as its tallest cell; a cell sits
// at its top unless its `valign` says the middle or the bottom. Set in Times
// with the exports' line height and, once the band is wide (`band-wide:`),
// at their size relative to the width. A narrow band stacks the cells
// instead: the logos in a row of their own first, then the text cells
// left-aligned, in reading order. The column widths and the logo sizes are
// fractions of the letterhead (user data, hence the inline styles); they only
// take effect in a wide band, where the container is a grid. Regular lines
// are in the band's ink, bold ones in the brand colour.
const GridLayout = ({
  grid,
  marginLogoSrc,
  projectId,
  documentId,
  logoSrcs,
  logoLoading,
  nameStyle,
}: GridLayoutProps) => {
  const { columns, cells } = layoutGridBand(grid);
  const logoCells = cells.filter(
    (cell): cell is GridLogoBandCell => cell.kind === "logo",
  );
  const textCells = cells.filter(
    (cell): cell is GridTextBandCell => cell.kind === "text",
  );
  // The base text size once the band is wide: the same fraction of its width
  // as in the PDF and DOCX exports (`gridBaseFontRatio` — the reference's own
  // size when the grid has one; `cqw` = 1% of the band's content width), so
  // lines wrap at the same words. A narrow band stacks the cells and keeps
  // the band's 13px.
  const fontSize = `${(gridBaseFontRatio(grid) * 100).toFixed(4)}cqw`;

  return (
    <>
      {/* A grid without logo cells keeps the office → organization logo in
          the margin, as the "columns" layout and the exports do. */}
      {gridLogoCells(grid).length === 0 && marginLogoSrc && (
        <MarginLogo src={marginLogoSrc} />
      )}
      <div
        className="flex flex-col gap-2 font-['Times_New_Roman',Times,serif] leading-[1.15] band-wide:grid band-wide:items-start band-wide:gap-0 band-wide:text-[length:var(--grid-font-size)]"
        style={
          {
            gridTemplateColumns: columns,
            "--grid-font-size": fontSize,
          } as CSSProperties
        }
      >
        {logoCells.length > 0 && (
          <div className="flex items-start gap-3 empty:hidden band-wide:contents">
            {logoCells.map((cell) => (
              <GridLogo
                key={`logo-${cell.cell.index}`}
                cell={cell}
                projectId={projectId}
                documentId={documentId}
                logoSrcs={logoSrcs}
                logoLoading={logoLoading}
              />
            ))}
          </div>
        )}
        {textCells.map(({ cell, column, lines }) => (
          <div
            key={`text-${column}`}
            className={cn(
              "min-w-0 break-words text-left band-wide:row-start-1",
              GRID_ALIGN_CLASS[cell.align],
              GRID_VALIGN_CLASS[cell.valign ?? "top"],
            )}
            style={{ gridColumnStart: column }}
          >
            {lines.map((line, index) => (
              <p
                key={`${index}-${line.text}`}
                className={line.bold ? "font-bold" : undefined}
                style={{
                  fontSize: `${GRID_LINE_SCALE[line.size]}em`,
                  ...(line.bold ? nameStyle : undefined),
                }}
              >
                {line.text}
              </p>
            ))}
          </div>
        ))}
      </div>
    </>
  );
};

// One logo cell: `logoSrcs[index]` when given (loading per `logoLoading`),
// else fetched through the proxy by its index (one hook per logo). Its box is
// kept while it loads, so the letterhead does not jump; like the exporters, a
// logo that is missing leaves its column empty and adds no height to the
// row. Decorative (the identity text sits beside it), hence the empty alt.
const GridLogo = ({
  cell,
  projectId,
  documentId,
  logoSrcs,
  logoLoading,
}: GridLogoProps) => {
  // With `logoSrcs` the proxy is not asked (a null key fetches nothing).
  const proxied = useLetterheadLogoState(
    logoSrcs ? null : projectId,
    documentId,
    cell.cell.index,
  );
  const src = logoSrcs ? (logoSrcs[cell.cell.index] ?? null) : proxied.src;
  const isLoading = logoSrcs
    ? (logoLoading?.[cell.cell.index] ?? false)
    : proxied.isLoading;
  const style = {
    gridColumnStart: cell.column,
    aspectRatio: cell.aspectRatio,
    "--grid-logo-width": cell.width,
  } as CSSProperties;
  const valignClass = GRID_VALIGN_CLASS[cell.cell.valign ?? "top"];

  if (!src) {
    return isLoading ? (
      <div
        aria-hidden
        data-testid="letterhead-logo-placeholder"
        className={cn(
          GRID_LOGO_CLASS,
          valignClass,
          "rounded-sm bg-neutral-900/5",
        )}
        style={style}
      />
    ) : null;
  }

  return (
    <Image
      src={src}
      alt=""
      width={Math.max(1, Math.round(cell.aspectRatio * 100))}
      height={100}
      unoptimized
      className={cn(
        GRID_LOGO_CLASS,
        valignClass,
        "object-contain object-left-top",
      )}
      style={style}
    />
  );
};

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
