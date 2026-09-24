// Dashboard recipes for the glass ("Mist") system. Built on the `glass`,
// `glass-card`, `glass-inset`, `btn-primary` and `press` utilities in
// app/globals.css (values copied from the landing page, whose equivalents live
// in apps/landing-page/src/components/catalog/catalog-layout.ts). Shared
// primitives (Dialog, Input, Select, menus, Button `brand`/`glass` variants)
// are styled in @wildfires-org/turboplan-utils instead.

import { cn } from "@/lib/utils";

/** Flat page ground behind every dashboard page (brandAlt-100). */
export const PAGE_GROUND_CLASS = "bg-[#F4F9F7]";

/** Content column shared by the entity header and the page body. */
export const PAGE_CONTAINER_CLASS = "container mx-auto px-6";

/** Page H1: app-scaled version of the landing H1 (tight negative tracking). */
export const PAGE_TITLE_CLASS =
  "text-[26px] font-medium leading-[1.15] tracking-[-0.03em] text-foreground text-balance sm:text-[30px]";

/** Lead paragraph under a page title (egray-700: >= 4.5:1 on white/mint). */
export const PAGE_LEAD_CLASS = "text-[14px] leading-[21px] text-gray-550";

/** Sticky tabs/search/filter band under the entity header. Same ground as the
 * page, lightly translucent so cards scrolling under it soften instead of
 * cutting off hard. */
export const STICKY_TOOLBAR_CLASS = cn(
  "sticky top-[120px] z-20 -mx-6 bg-[#F4F9F7]/90 px-6 pb-2 pt-4 backdrop-blur-md",
  "dark:bg-slate-950/80",
);

/** Clickable glass card: hover only lightens the surface (no lift); `press`
 * owns the transitions and the active scale. */
export const GLASS_CARD_LINK_CLASS =
  "glass-card press group block overflow-hidden hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 dark:hover:bg-slate-900/70";

/** Small glass chip trigger for filter / sort / view dropdowns. */
export const GLASS_CHIP_TRIGGER_CLASS =
  "glass press inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-normal text-foreground hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 data-[state=open]:bg-white/90";

/** Round glass icon button (card overflow menus, pagination). */
export const GLASS_ICON_BUTTON_CLASS =
  "glass press inline-flex size-8 items-center justify-center rounded-full text-foreground hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:pointer-events-none disabled:opacity-40";

/** Status / meta chips on cards. Tones keep text >= 4.5:1 at 11px. */
export const CHIP_BASE_CLASS =
  "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium leading-4 [&_svg]:size-3";

export const CHIP_TONE_CLASS = {
  brand: "bg-brand-50 text-brand-900 ring-1 ring-inset ring-brand-800/15",
  neutral:
    "bg-slate-900/[0.04] text-gray-550 ring-1 ring-inset ring-slate-900/[0.06]",
  danger: "bg-error-50 text-error-700 ring-1 ring-inset ring-error-700/10",
  info: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10",
} as const;

export type ChipTone = keyof typeof CHIP_TONE_CLASS;

/** Skeleton fill inside glass shells: soft pulse, static for reduced motion. */
export const SKELETON_BAR_CLASS =
  "rounded-md bg-brandAlt-200/70 animate-pulse motion-reduce:animate-none";

/** Size for entity-header actions (paired with Button `brand` / `glass`). */
export const HEADER_ACTION_BUTTON_CLASS = "h-9 gap-2 px-4 text-[14px]";

/** Solid destructive confirm (error-700: white text >= 4.5:1), with press. */
export const DESTRUCTIVE_BUTTON_CLASS =
  "rounded-xl bg-error-700 text-white hover:bg-error-800 active:scale-[0.97] motion-reduce:active:scale-100";

/** Segmented glass control (tabs / view switchers): the track... */
export const SEGMENTED_TRACK_CLASS =
  "glass flex max-w-full items-center gap-1 self-start overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** ...and its segments; the active one is a white pill with a top highlight. */
export const SEGMENT_CLASS =
  "press inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 [&_svg]:size-4";

export const SEGMENT_ACTIVE_CLASS =
  "bg-white text-brand-800 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_4px_12px_-6px_rgba(21,102,71,0.25),inset_0_1px_0_#fff] dark:bg-white/15 dark:text-white";

export const SEGMENT_INACTIVE_CLASS =
  "text-gray-550 hover:bg-white/60 hover:text-foreground dark:text-slate-300 dark:hover:bg-white/10";

/** Inset search field (label wrapper around a bare input). */
export const SEARCH_FIELD_CLASS =
  "glass-inset flex h-10 w-full items-center gap-2 rounded-xl px-3 focus-within:outline focus-within:outline-2 focus-within:outline-brand-700/40 sm:w-[340px]";

export const SEARCH_INPUT_CLASS =
  "min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-gray-550 focus:outline-none";

/** Empty state inside a glass card / section body. */
export const EMPTY_STATE_TITLE_CLASS =
  "text-[15px] font-medium leading-6 tracking-[-0.01em] text-foreground";

export const EMPTY_STATE_TEXT_CLASS = "text-[13px] leading-5 text-gray-550";

/** Sub-view content panel (timeline, comments, documents, context...). */
export const PANEL_CLASS = "glass-card rounded-[20px] p-4 sm:p-5";

/** Title inside a PANEL_CLASS panel. */
export const PANEL_TITLE_CLASS =
  "text-[16px] font-medium leading-6 tracking-[-0.01em] text-foreground";

/** Edge-to-edge panel for content with its own toolbar (tasks table). */
export const FLUSH_PANEL_CLASS = "glass-card overflow-hidden rounded-[20px]";
