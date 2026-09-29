// Homepage layout system. Every section, the navbar pill and the footer bar
// share these so their content edges line up.

// Side gutters, on the full-width section wrapper.
export const PAGE_GUTTER = "px-4 sm:px-6 lg:px-8";

// One content width for the whole page. Narrow reading blocks (section
// intros, the FAQ list) may be narrower but stay centered.
export const PAGE_CONTAINER = "mx-auto w-full max-w-[1200px]";

// Vertical rhythm: each section owns only the space ABOVE it, so two
// consecutive sections are one rhythm unit apart (not top + bottom stacked).
// Sections never add bottom padding; the CTA owns the space down to the footer.
export const SECTION_Y = "pt-16 sm:pt-20 lg:pt-28";

// Tighter step between two consecutive glass panels (Contact → CTA), so they
// read as a pair rather than two separate sections.
export const PANEL_STACK_Y = "pt-10 sm:pt-12 lg:pt-16";

// Gap between a section's header block and its content.
export const HEADER_CONTENT_GAP = "gap-10 sm:gap-12 lg:gap-16";
