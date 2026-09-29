// Class recipes shared by the /docs chrome (sidebar, TOC, mobile bar). Kept in
// a plain module so both server and client components can import them.

// Same recipe as the navbar's mobile menu button.
export const DOCS_ICON_BUTTON_CLASS =
  "press flex size-10 shrink-0 items-center justify-center rounded-xl text-egray-700 hover:bg-white/60 hover:text-egray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700";

// Small uppercase label (sidebar title, "On this page"). The site's eyebrow
// type without the chip.
export const DOCS_LABEL_CLASS =
  "font-heading text-[12px] font-medium uppercase leading-4 tracking-[0.08em] text-brand-800";
