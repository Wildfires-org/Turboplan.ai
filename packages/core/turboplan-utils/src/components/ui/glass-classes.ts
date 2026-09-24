// Glass ("Mist") surface recipes for the shared primitives, as plain Tailwind
// classes. Values mirror the `glass`, `glass-card`, `glass-inset` and
// `btn-primary` utilities in apps/landing-page/src/globals.css (and their
// copy in apps/turboplan/app/globals.css). They are spelled out as Tailwind
// classes rather than those custom utilities so that `cn()`/tailwind-merge can
// resolve conflicts with a consumer's `className` (e.g. a caller's `border` or
// `bg-transparent` still wins), and so they compile in both the Tailwind v3
// web app and the Tailwind v4 landing page.

/** Strong ease-out used by overlays (standards: enter/exit = ease-out). */
const EASE_OUT = "ease-[cubic-bezier(0.23,1,0.32,1)]";

/** Form field "pressed into the glass": inner shadow only. The 1px border is
 * transparent (visually border-0) so field metrics match the old bordered
 * inputs and a caller's `border-red-500` error state still shows. Focus uses
 * an outline because a ring would replace the inset box-shadow. */
export const GLASS_INSET_CLASS =
  "border border-transparent bg-white shadow-[inset_0_2px_6px_rgba(15,23,42,0.10),inset_0_1px_2px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.9)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-700/40 dark:bg-slate-900 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.4),inset_0_1px_2px_rgba(0,0,0,0.3)]";

/** Glass card (landing `glass-card`; same recipe as turboplan SectionCard). */
export const GLASS_CARD_CLASS =
  "rounded-2xl border-[1.5px] border-white/95 bg-white/[0.58] shadow-[0_18px_48px_-34px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-950/60";

/** Light glass for pills, chips and secondary buttons. */
export const GLASS_CLASS =
  "border border-white/85 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_30px_-12px_rgba(21,102,71,0.18)] backdrop-blur-[18px] backdrop-saturate-[1.6] dark:border-white/10 dark:bg-slate-950/60 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";

/** Floating menus (dropdown, select, popover): near-opaque so menu text stays
 * legible over any content, with the glass edge + a soft drop. */
export const GLASS_POPOVER_CLASS =
  "rounded-xl border border-white/90 bg-white/[0.92] shadow-[0_18px_48px_-20px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-950/[0.92]";

/** Menu rows inside a glass popover. */
export const GLASS_MENU_ITEM_CLASS =
  "rounded-lg focus:bg-brandAlt-100 focus:text-brand-900 data-[highlighted]:bg-brandAlt-100 data-[highlighted]:text-brand-900 dark:focus:bg-white/10 dark:focus:text-white";

/** Modal overlay: light green-tinted blur instead of a heavy black scrim. */
export const GLASS_OVERLAY_CLASS =
  "bg-[rgba(15,40,30,0.18)] backdrop-blur-sm dark:bg-black/60";

/** Modal surface: glass-card edge + shadow at a larger radius, near-opaque
 * (a translucent card reads grey over the overlay). */
export const GLASS_DIALOG_SURFACE_CLASS =
  "rounded-[24px] border-[1.5px] border-white bg-white/[0.94] shadow-[0_32px_80px_-32px_rgba(15,40,30,0.38),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-950/[0.94]";

/** Modal enter/exit: opacity + scale .96 -> 1, 200ms strong ease-out, centered
 * origin. The slide-*-1/2 pair only re-applies the -50% centering translate
 * that the animation keyframe would otherwise drop (no visible travel).
 * Reduced motion keeps the fade and drops the scale. */
export const GLASS_DIALOG_MOTION_CLASS = `duration-200 ${EASE_OUT} data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.96] data-[state=open]:zoom-in-[0.96] data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-1/2 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-1/2 motion-reduce:data-[state=closed]:zoom-out-100 motion-reduce:data-[state=open]:zoom-in-100`;

/** Overlay fade, same timing as the dialog. */
export const GLASS_OVERLAY_MOTION_CLASS = `duration-200 ${EASE_OUT} data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0`;

/** Popper enter/exit (dropdowns, selects, popovers): fade + scale .96 from the
 * trigger side, 150ms. Callers set the transform origin per primitive. */
export const GLASS_POPPER_MOTION_CLASS = `duration-150 ${EASE_OUT} data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.96] data-[state=open]:zoom-in-[0.96] motion-reduce:data-[state=closed]:zoom-out-100 motion-reduce:data-[state=open]:zoom-in-100`;
