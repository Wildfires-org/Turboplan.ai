"use client";

import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SEARCH_FIELD_CLASS,
  SEARCH_INPUT_CLASS,
  SEGMENT_ACTIVE_CLASS,
  SEGMENT_CLASS,
  SEGMENT_INACTIVE_CLASS,
  SEGMENTED_TRACK_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";

type Tab = {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
};

type TabNavProps = {
  tabs: Tab[];
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
};

export function TabNav({
  tabs,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
}: TabNavProps) {
  const pathname = usePathname();

  const activeHref = tabs
    .filter((t) => pathname.startsWith(t.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      {/* Segmented glass control: active tab = white pill with a top highlight. */}
      <nav aria-label="Sections" className={SEGMENTED_TRACK_CLASS}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.href === activeHref;

          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                SEGMENT_CLASS,
                active ? SEGMENT_ACTIVE_CLASS : SEGMENT_INACTIVE_CLASS,
              )}
            >
              <Icon aria-hidden className="size-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {onSearchChange !== undefined && (
        <label className={SEARCH_FIELD_CLASS}>
          <Search aria-hidden className="size-4 shrink-0 text-gray-550" />
          <input
            aria-label={searchPlaceholder}
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={SEARCH_INPUT_CLASS}
          />
        </label>
      )}
    </div>
  );
}
