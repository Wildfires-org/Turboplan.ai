"use client";

import {
  ArrowDownWideNarrow,
  Check,
  ChevronDown,
  Eye,
  Search,
} from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";

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
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex items-center gap-2">
        {filters.map((filter) => (
          <FilterDropdown key={filter.key} filter={filter} />
        ))}
      </div>

      <div className="flex items-center gap-2">
        {onSearchChange !== undefined && (
          <div className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1.5">
            <Search className="size-4 text-gray-400" />
            <input
              aria-label={searchPlaceholder}
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-[200px] bg-transparent text-xs tracking-wide text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
          </div>
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
        <Button
          variant="ghost"
          size="sm"
          className="h-auto gap-1.5 px-2.5 py-1.5 text-sm font-normal"
        >
          <span className="text-sm font-medium text-muted-foreground">
            {filter.label}:
          </span>
          <span className="text-gray-800">
            {selectedOption?.label ?? "All"}
          </span>
          <ChevronDown className="size-4 text-gray-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {filter.options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => filter.onChange(option.value)}
            className={cn(
              "cursor-pointer",
              filter.value === option.value && "font-medium",
            )}
          >
            {option.label}
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
        <Button
          variant="ghost"
          size="sm"
          className="h-auto gap-1.5 px-2.5 py-1.5 text-sm font-normal text-gray-800"
        >
          <ArrowDownWideNarrow className="size-4 text-gray-500" />
          {selectedOption?.label ?? "Sort"}
          <ChevronDown className="size-3.5 text-gray-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px] p-2">
        <DropdownMenuLabel className="px-3 py-2.5 text-xs font-normal tracking-wide text-gray-400">
          Sort by
        </DropdownMenuLabel>
        {config.options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => config.onChange(option.value)}
            className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2.5 text-sm"
          >
            {option.label}
            {config.value === option.value && (
              <Check className="size-5 text-emerald-500" />
            )}
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
        <Button
          variant="ghost"
          size="sm"
          className="h-auto gap-1.5 px-2.5 py-1.5 text-sm font-normal text-gray-800"
        >
          <Eye className="size-5 text-gray-800" />
          {config.value}
          <ChevronDown className="size-4 text-gray-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {config.options.map((option) => (
          <DropdownMenuItem
            key={option}
            onSelect={() => config.onChange(option)}
            className={cn(
              "cursor-pointer",
              config.value === option && "font-medium",
            )}
          >
            {option}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
