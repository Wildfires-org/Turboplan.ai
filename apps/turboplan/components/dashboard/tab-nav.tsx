"use client";

import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
      <nav
        aria-label="Sections"
        className="glass flex max-w-full items-center gap-1 self-start overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.href === activeHref;

          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700",
                active
                  ? "bg-white text-brand-800 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_4px_12px_-6px_rgba(21,102,71,0.25),inset_0_1px_0_#fff] dark:bg-white/15 dark:text-white"
                  : "text-gray-550 hover:bg-white/60 hover:text-foreground dark:text-slate-300 dark:hover:bg-white/10",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {onSearchChange !== undefined && (
        <label className="glass-inset flex h-10 w-full items-center gap-2 rounded-xl px-3 focus-within:outline focus-within:outline-2 focus-within:outline-brand-700/40 sm:w-[340px]">
          <Search aria-hidden className="size-4 shrink-0 text-gray-550" />
          <input
            aria-label={searchPlaceholder}
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-gray-550 focus:outline-none"
          />
        </label>
      )}
    </div>
  );
}
