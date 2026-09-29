"use client";

import {
  ArrowDownWideNarrow,
  Check,
  ChevronDown,
  Eye,
  Search,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";

import { GLASS_CHIP_TRIGGER_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

type FilterOption = {
  label: string;
  value: string;
};

type FilterConfig = {
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
};

type SortConfig = {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
};

type PageSizeConfig = {
  options: number[];
  value: number;
  onChange: (value: number) => void;
};

type FilterBarProps = {
  filters: FilterConfig[];
  sort?: SortConfig;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  pageSize?: PageSizeConfig;
  className?: string;
};

export function FilterBar({
  filters,
  sort,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  pageSize,
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 sm:gap-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => (
          <FilterDropdown key={filter.key} filter={filter} />
        ))}
      </div>

      <div className="flex items-center gap-2">
        {onSearchChange !== undefined && (
          <label className="glass-inset flex h-9 items-center gap-1.5 rounded-xl px-2.5 focus-within:outline focus-within:outline-2 focus-within:outline-brand-700/40">
            <Search aria-hidden className="size-4 text-gray-550" />
            <input
              aria-label={searchPlaceholder}
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-[200px] bg-transparent text-xs tracking-wide text-foreground placeholder:text-gray-550 focus:outline-none"
            />
          </label>
        )}

        {sort && <SortDropdown config={sort} />}
        {pageSize && <PageSizeDropdown config={pageSize} />}
      </div>
    </div>
  );
}

function FilterDropdown({ filter }: { filter: FilterConfig }) {
  const selectedOption = filter.options.find((o) => o.value === filter.value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={GLASS_CHIP_TRIGGER_CLASS}>
          <span className="text-gray-550">{filter.label}:</span>
          <span className="font-medium">{selectedOption?.label ?? "All"}</span>
          <ChevronDown aria-hidden className="size-3.5 text-gray-550" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[180px] p-1.5">
        {filter.options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => filter.onChange(option.value)}
            className="flex cursor-pointer items-center justify-between px-3 py-2"
          >
            {option.label}
            {filter.value === option.value && <SelectedCheck />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortDropdown({ config }: { config: SortConfig }) {
  const selectedOption = config.options.find((o) => o.value === config.value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={GLASS_CHIP_TRIGGER_CLASS}>
          <ArrowDownWideNarrow aria-hidden className="size-4 text-gray-550" />
          <span className="font-medium">{selectedOption?.label ?? "Sort"}</span>
          <ChevronDown aria-hidden className="size-3.5 text-gray-550" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px] p-1.5">
        <DropdownMenuLabel className="px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-550">
          Sort by
        </DropdownMenuLabel>
        {config.options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => config.onChange(option.value)}
            className="flex cursor-pointer items-center justify-between px-3 py-2"
          >
            {option.label}
            {config.value === option.value && <SelectedCheck />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PageSizeDropdown({ config }: { config: PageSizeConfig }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Items per page: ${config.value}`}
          className={GLASS_CHIP_TRIGGER_CLASS}
        >
          <Eye aria-hidden className="size-4 text-gray-550" />
          <span className="font-medium tabular-nums">{config.value}</span>
          <ChevronDown aria-hidden className="size-3.5 text-gray-550" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[120px] p-1.5">
        <DropdownMenuLabel className="px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-550">
          Per page
        </DropdownMenuLabel>
        {config.options.map((option) => (
          <DropdownMenuItem
            key={option}
            onSelect={() => config.onChange(option)}
            className="flex cursor-pointer items-center justify-between px-3 py-2 tabular-nums"
          >
            {option}
            {config.value === option && <SelectedCheck />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const SelectedCheck = () => (
  <Check aria-hidden className="size-4 text-brand-700" />
);
