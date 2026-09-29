// Catalog layout + surface classes. Builds on the homepage system in
// `home-v2/ui/layout.ts` so catalog content edges line up with the navbar
// pill and footer bar.

import { PAGE_GUTTER, PANEL_STACK_Y } from "@/components/home-v2/ui/layout";

// Page root: owns the space down to the footer (sections only pad their top).
export const CATALOG_PAGE_CLASS = "w-full pb-16 sm:pb-20 lg:pb-24";

// First block under the sticky navbar.
export const CATALOG_TOP_CLASS = `${PAGE_GUTTER} pt-6 sm:pt-8 lg:pt-10`;

// Every following section: one panel-stack step above it.
export const CATALOG_SECTION_CLASS = `${PAGE_GUTTER} ${PANEL_STACK_Y}`;

// Section header block → its grid.
export const CATALOG_HEADER_GAP_CLASS = "mb-8 sm:mb-10";

export const CATALOG_GRID_CLASS =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6";

// Shared H1 scale (36/48/60), same as the homepage hero.
export const CATALOG_H1_CLASS =
  "font-heading text-[36px] font-normal leading-[1.15] tracking-[-0.04em] text-balance text-egray-900 md:text-[48px] lg:text-[60px]";

// Clickable glass card: hover only lightens the surface (no lift), `press`
// owns the transitions and the active scale.
export const CATALOG_CARD_LINK_CLASS =
  "glass-card press group block overflow-hidden hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700";

// Secondary glass button / link.
export const GLASS_BUTTON_CLASS =
  "glass press inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 font-inter text-[14px] font-medium text-brand-800 hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700";

// Filled primary button.
export const PRIMARY_BUTTON_CLASS =
  "btn-primary press inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 font-inter text-[14px] font-medium";

// Skeleton bar: soft pulse, frozen for reduced motion.
export const SKELETON_BAR_CLASS =
  "rounded-md bg-brandAlt-200/70 animate-pulse motion-reduce:animate-none";

// Status / meta chip on cards.
export const CARD_CHIP_CLASS =
  "inline-flex items-center rounded-full bg-brandAlt-100 px-2.5 py-1 font-heading text-[12px] font-medium uppercase leading-[16px] tracking-[0.08em]";

// Faux button inside a card link (a real <button> can't nest in <a>).
export const CARD_ACTION_CLASS =
  "glass inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl font-inter text-[14px] font-medium text-brand-800 transition-colors duration-200 group-hover:bg-white";

export const CARD_ACTION_ICON_CLASS =
  "size-4 transition-transform duration-200 ease-out-expo group-hover:translate-x-0.5 motion-reduce:transition-none";

// Dialog surface: the opaque Mist ground (a translucent card reads grey over
// the dark overlay) with the glass-card edge + shadow. Inner inputs use
// `glass-inset` so they lift as white against it.
export const MODAL_SURFACE_CLASS =
  "rounded-[28px] border-[1.5px] border-white bg-brandAlt-100 shadow-[var(--glass-card-shadow)]";

// Round glass close button pinned to a dialog's top-right corner.
export const MODAL_CLOSE_BUTTON_CLASS =
  "glass press absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full text-egray-900 hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 sm:right-5 sm:top-5";

// Form field "pressed into the glass". Outline focus ring because
// glass-inset owns box-shadow.
export const GLASS_INPUT_CLASS =
  "glass-inset rounded-xl border-0 font-inter text-egray-900 placeholder:text-egray-600 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-700/40";
