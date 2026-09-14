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
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.href === activeHref;

          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border pl-2.5 pr-3 py-1.5 text-xs font-normal tracking-[0.12px] transition-colors",
                active
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50",
              )}
            >
              <Icon className="size-[21px]" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {onSearchChange !== undefined && (
        <div className="flex items-center gap-1.5 rounded-md border border-gray-200 p-2">
          <Search className="size-[19px] text-gray-400" />
          <input
            aria-label={searchPlaceholder}
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-[332px] bg-transparent text-xs tracking-[0.12px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
