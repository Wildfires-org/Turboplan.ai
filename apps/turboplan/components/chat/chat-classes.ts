// Shared geometry/recipes for the project chat, so the page, its loading
// fallback and the message list render the same boxes (no layout shift).

/** Chat title row; its min height matches the research pane header. */
export const CHAT_HEADER_CLASS =
  "flex min-h-[72px] shrink-0 items-center gap-5 border-b border-slate-900/[0.06] px-6 py-4 dark:border-white/10";

/** Centered message column (one per message row). */
export const CHAT_MESSAGE_ROW_CLASS = "mx-auto w-full max-w-3xl px-4";

/** Composer column under the message list. */
export const CHAT_FORM_CLASS =
  "mx-auto flex w-full flex-col gap-2 px-4 pb-4 md:max-w-3xl md:pb-6";

/** Glass card the composer's inset field sits in. */
export const CHAT_COMPOSER_SHELL_CLASS = "glass-card rounded-[20px] p-1.5";

/** Research side pane: glass sheet attached to the right edge. */
export const RESEARCH_PANE_CLASS =
  "relative hidden shrink-0 flex-col overflow-hidden border-l border-white/90 bg-white/60 shadow-[-18px_0_48px_-34px_rgba(15,23,42,0.24),inset_1px_0_0_rgba(255,255,255,0.9)] backdrop-blur-2xl backdrop-saturate-150 md:flex dark:border-white/10 dark:bg-slate-950/60";

/** Research pane default width (matches the resizable panel's default). */
export const RESEARCH_PANE_DEFAULT_WIDTH_CLASS = "w-[595px]";

/** User turn: white glass bubble, squared off toward the sender. */
export const USER_BUBBLE_SHELL_CLASS =
  "rounded-2xl rounded-br-md border border-white/90 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_30px_-18px_rgba(21,102,71,0.3)] dark:border-white/10 dark:bg-slate-900/70";
