import { SidebarTrigger } from "fumadocs-ui/components/layout/sidebar";
import {
  PageTOC,
  PageTOCItems,
  PageTOCPopover,
  PageTOCPopoverContent,
  PageTOCPopoverItems,
  PageTOCPopoverTrigger,
} from "fumadocs-ui/layouts/docs/page";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { DOCS_LABEL_CLASS } from "./docs-classes";
import { DocsSearchIconButton } from "./docs-sidebar";

// Right-hand "On this page" column (xl+). Fumadocs renders it `fixed` from
// the nav line to the viewport bottom, which ran over the site footer; here
// it is sticky inside the docs grid, so it stops with the content, and sized
// to its list (capped by --docs-chrome-max-h, see the docs layout) so it
// never slides up under the navbar pill at the end of the page. The
// `!end-auto` beats the inline `inset-inline-end` Fumadocs writes for its
// fixed positioning (irrelevant once sticky). Active item + thumb colours
// come from the fd tokens and the overrides in src/styles/fumadocs.css.
export function DocsTOC() {
  return (
    <PageTOC className="sticky bottom-auto !end-auto flex max-h-(--docs-chrome-max-h) shrink-0 flex-col self-start pt-6 pb-4">
      <p className={cn(DOCS_LABEL_CLASS, "mb-1")}>On this page</p>
      <PageTOCItems />
    </PageTOC>
  );
}

// Below xl there is no TOC column; Fumadocs shows a collapsible "current
// section" bar instead. It is also the only place a docs control fits on
// phones (the site navbar owns the top), so the sidebar-drawer trigger and
// search live here too. Sticky under the navbar pill; the section list drops
// down as a floating glass panel so opening it doesn't push the article.
export function DocsTOCBar() {
  return (
    <PageTOCPopover className="sticky !start-auto !end-auto z-30 mb-5 rounded-2xl border-b-0">
      <div className="flex items-center gap-1 p-1">
        <SidebarTrigger className="press flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 font-inter text-[14px] font-medium text-egray-800 hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 md:hidden">
          <Menu className="size-4" />
          Menu
        </SidebarTrigger>
        <span
          aria-hidden
          className="h-5 w-px shrink-0 bg-brandAlt-200 md:hidden"
        />
        <PageTOCPopoverTrigger className="h-10 w-auto min-w-0 flex-1 overflow-hidden rounded-xl px-3 font-inter text-egray-700 hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 md:px-3 [&_svg]:text-egray-500" />
        <DocsSearchIconButton className="md:hidden" />
      </div>
      <PageTOCPopoverContent className="glass-card absolute inset-x-0 top-full mt-2 max-h-[60vh] px-3 md:px-3">
        <PageTOCPopoverItems />
      </PageTOCPopoverContent>
    </PageTOCPopover>
  );
}
