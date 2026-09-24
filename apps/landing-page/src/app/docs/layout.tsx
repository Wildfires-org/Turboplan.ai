import type { ReactNode } from "react";

import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { DOCS_LABEL_CLASS } from "@/components/docs/docs-classes";
import {
  DocsSearchTrigger,
  DocsSidebarFolder,
  DocsSidebarItem,
  DocsSidebarSeparator,
} from "@/components/docs/docs-sidebar";
import { source } from "@/lib/source";
import { cn } from "@/lib/utils";

interface DocsRootLayoutProps {
  children: ReactNode;
}

// #nd-docs-layout. Fumadocs' default layout pins the sidebar and TOC with
// `position: fixed` from `--fd-nav-height` to the viewport bottom, which
// painted behind the floating navbar pill and over the site footer. Instead
// the docs area is a normal-flow grid inside the site container
// (1200px + the site gutters): sidebar column + page column, both chrome
// columns `sticky`, so they stop above the footer.
//
// `--fd-nav-height` = the sticky navbar (wrapper top padding + 64px pill:
// 12 + 64 below lg, 16 + 64 from lg, see home-v2/navbar.tsx) + a 12px gap. It
// is the sticky offset for the sidebar, TOC and the section bar.
//
// `--docs-chrome-max-h` caps the sticky sidebar/TOC. A sticky box can't
// leave its container, so a column taller than the space left above the
// footer at the end of the page would be pushed up under the navbar pill.
// 144px = site footer bar (<= 90px, home-v2/footer.tsx) + this container's
// 48px bottom padding + rounding, so the stuck column always fits between
// the pill and the footer; longer trees scroll inside the panel.
//
// These classes are merged by Fumadocs with tailwind-merge, so they replace
// its own values (padding-top of --fd-nav-height, margin offset, article
// padding). `!ps-*` beats the inline padding-inline-start it writes to make
// room for the fixed sidebar.
const CONTAINER_CLASS = cn(
  "[--fd-nav-height:88px] lg:[--fd-nav-height:92px]",
  "[--docs-chrome-max-h:calc(100vh/var(--ui-scale)-var(--fd-nav-height)-144px)]",
  "md:[--fd-sidebar-width:228px] lg:[--fd-sidebar-width:256px] xl:[--fd-toc-width:216px]",
  "mx-auto w-full max-w-[1264px] px-4 !ps-4 pt-3 pb-12 sm:px-6 sm:!ps-6 lg:px-8 lg:!ps-8",
  "md:grid md:grid-cols-[var(--fd-sidebar-width)_minmax(0,1fr)] md:gap-x-8 lg:gap-x-10",
  "md:[&_#nd-page_article]:pt-6 xl:[&_#nd-page_article]:px-0",
);

// Desktop sidebar (#nd-sidebar) and mobile drawer (#nd-sidebar-mobile) share
// this className; the md: half only reaches the desktop aside and the max-md:
// half only the drawer (Fumadocs renders one or the other by viewport).
// Surfaces (glass card, scrollbar) are in src/styles/fumadocs.css.
const SIDEBAR_CLASS = cn(
  "md:sticky md:top-(--fd-nav-height) md:bottom-auto md:self-start md:!w-auto",
  "md:max-h-(--docs-chrome-max-h)",
  "max-md:inset-y-2 max-md:end-2 max-md:z-[60] max-md:w-[min(85%,340px)]",
);

// `nav` is disabled: the global site <Navbar /> is the only top bar. Its
// title still renders as the sidebar heading. `themeSwitch` is disabled: the
// site is light-only (next-themes is off via RootProvider in the root layout).
// `collapsible` is off: the collapse button and its floating restore control
// don't fit the sticky, in-flow sidebar. The default search toggle is
// replaced by our own trigger (banner slot: desktop header + mobile drawer).
export default function DocsRootLayout({ children }: DocsRootLayoutProps) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        enabled: false,
        title: <span className={DOCS_LABEL_CLASS}>Documentation</span>,
        url: "/docs",
      }}
      themeSwitch={{ enabled: false }}
      searchToggle={{ enabled: false }}
      sidebar={{
        collapsible: false,
        className: SIDEBAR_CLASS,
        banner: <DocsSearchTrigger />,
        components: {
          Item: DocsSidebarItem,
          Folder: DocsSidebarFolder,
          Separator: DocsSidebarSeparator,
        },
      }}
      containerProps={{ className: CONTAINER_CLASS }}
    >
      {children}
    </DocsLayout>
  );
}
