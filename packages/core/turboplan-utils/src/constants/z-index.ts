/**
 * Centralized z-index values for consistent layering across the application
 * Using semantic names to make it clear what layer each component belongs to
 */

export const ZINDEX = {
  /** Base layer for most content */
  base: 0,

  /** Sticky headers, navigation bars */
  header: 10,

  /** Dropdowns, popovers, tooltips */
  dropdown: 50,

  /** Sidebars and drawers */
  sidebar: 100,

  /** Map container base layer */
  map: 400,

  /** Map controls (buttons on top of map) */
  mapControl: 401,

  /** Map control dropdowns (hover panels on map controls) */
  mapControlDropdown: 402,

  /** Modals and dialogs */
  modal: 500,

  /** Toast notifications */
  toast: 1000,
} as const;

export type ZIndexKey = keyof typeof ZINDEX;
