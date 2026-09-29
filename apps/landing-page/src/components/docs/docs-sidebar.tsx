"use client";

import type { ReactNode } from "react";

import type * as PageTree from "fumadocs-core/page-tree";
import {
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarItem,
  SidebarSeparator,
} from "fumadocs-ui/components/layout/sidebar";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { useTreePath } from "fumadocs-ui/contexts/tree";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { DOCS_ICON_BUTTON_CLASS, DOCS_LABEL_CLASS } from "./docs-classes";

interface DocsSidebarFolderProps {
  item: PageTree.Folder;
  level: number;
  children: ReactNode;
}

// Shared by pages and folder rows. Fumadocs' own item classes are merged with
// tailwind-merge, so these replace its grey hover/active colours. Nested rows
// are indented with margin (not padding) so the active glass pill starts to
// the right of the folder rail instead of covering it. The transparent border
// keeps the row height identical when the pill's 1px glass border appears.
const ROW_CLASS =
  "ms-[calc(var(--sidebar-item-offset)-0.5rem)] w-auto gap-2 rounded-xl border border-transparent py-[7px] ps-2.5 pe-2 font-inter text-[14px] leading-5 text-egray-700 hover:bg-white/60 hover:text-egray-900 hover:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 [&_svg]:size-4 [&_svg]:text-egray-500";

// Active page: glass pill with brand-800 text. `data-active` is set by
// Fumadocs from the current pathname. Denser than the `glass` utility so the
// pill still reads on top of the glass sidebar card.
const ACTIVE_ROW_CLASS =
  "data-[active=true]:border-white data-[active=true]:bg-white/90 data-[active=true]:font-medium data-[active=true]:text-brand-800 data-[active=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_6px_16px_-8px_rgba(21,102,71,0.3)] data-[active=true]:[&_svg]:text-brand-800";

// Folder rows are <button>s when the folder has no index page, and a button
// shrinks to its content, so give them the row width explicitly (minus the
// indent margin) to keep the chevron on the right edge.
const FOLDER_ROW_WIDTH_CLASS =
  "w-[calc(100%-var(--sidebar-item-offset)+0.5rem)]";

// Top-level folders read as section headings.
const FOLDER_ROW_CLASS = "font-medium text-egray-900";

const SEARCH_TRIGGER_CLASS =
  "glass-inset press flex h-10 w-full items-center gap-2 rounded-xl px-3 text-start font-inter text-[14px] text-egray-700 hover:text-egray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700";

export function DocsSidebarItem({ item }: { item: PageTree.Item }) {
  return (
    <SidebarItem
      href={item.url}
      external={item.external}
      icon={item.icon}
      className={cn(ROW_CLASS, ACTIVE_ROW_CLASS)}
    >
      {item.name}
    </SidebarItem>
  );
}

// Mirrors Fumadocs' PageTreeFolder (with the default `defaultOpenLevel` of 0):
// a folder starts open when the frontmatter asks for it or when it contains
// the current page.
export function DocsSidebarFolder({
  item,
  level,
  children,
}: DocsSidebarFolderProps) {
  const path = useTreePath();
  const isDefaultOpen = (item.defaultOpen ?? false) || path.includes(item);
  const rowClass = cn(
    ROW_CLASS,
    FOLDER_ROW_WIDTH_CLASS,
    level === 1 && FOLDER_ROW_CLASS,
    "[&_[data-icon]]:text-egray-500",
  );

  return (
    <SidebarFolder defaultOpen={isDefaultOpen}>
      {item.index ? (
        <SidebarFolderLink
          href={item.index.url}
          external={item.index.external}
          className={cn(rowClass, ACTIVE_ROW_CLASS)}
        >
          {item.icon}
          {item.name}
        </SidebarFolderLink>
      ) : (
        <SidebarFolderTrigger className={rowClass}>
          {item.icon}
          {item.name}
        </SidebarFolderTrigger>
      )}
      {/* Rail in brandAlt-200; the active page is marked by its pill, so
          Fumadocs' black active bar on the rail is switched off. */}
      <SidebarFolderContent className="flex flex-col gap-0.5 py-1 before:bg-brandAlt-200 **:data-[active=true]:before:hidden">
        {children}
      </SidebarFolderContent>
    </SidebarFolder>
  );
}

export function DocsSidebarSeparator({ item }: { item: PageTree.Separator }) {
  return (
    <SidebarSeparator
      className={cn(DOCS_LABEL_CLASS, "mt-5 mb-1.5 first:mt-0")}
    >
      {item.icon}
      {item.name}
    </SidebarSeparator>
  );
}

// Replaces Fumadocs' LargeSearchToggle (grey bordered box with kbd chips).
// Opens the same search dialog through Fumadocs' search context, so ⌘K and
// the dialog itself are unchanged.
export function DocsSearchTrigger({ className }: { className?: string }) {
  const { enabled, hotKey, setOpenSearch } = useSearchContext();

  if (!enabled) {
    return null;
  }

  return (
    <button
      type="button"
      data-search-full=""
      onClick={() => setOpenSearch(true)}
      className={cn(SEARCH_TRIGGER_CLASS, className)}
    >
      <Search className="size-4 shrink-0 text-egray-500" />
      <span className="flex-1 truncate">Search docs</span>
      <span className="hidden items-center gap-0.5 sm:inline-flex">
        {hotKey.map((key, index) => (
          <kbd
            key={index}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-brandAlt-100 px-1 font-inter text-[11px] font-medium text-egray-700"
          >
            {key.display}
          </kbd>
        ))}
      </span>
    </button>
  );
}

// Compact variant for the mobile docs bar, where the sidebar (and its full
// search trigger) lives in a drawer.
export function DocsSearchIconButton({ className }: { className?: string }) {
  const { enabled, setOpenSearch } = useSearchContext();

  if (!enabled) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Search docs"
      onClick={() => setOpenSearch(true)}
      className={cn(DOCS_ICON_BUTTON_CLASS, className)}
    >
      <Search className="size-4" />
    </button>
  );
}
