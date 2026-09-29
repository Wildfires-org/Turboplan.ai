import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import SearchBar from "./search-bar";
import type { BreadcrumbItem } from "./types";

interface CatalogToolbarProps {
  breadcrumbs: BreadcrumbItem[];
  searchPlaceholder?: string;
  className?: string;
}

// Breadcrumb chip + catalog search, the first row of every catalog page.
export function CatalogToolbar({
  breadcrumbs,
  searchPlaceholder,
  className,
}: CatalogToolbarProps) {
  return (
    <div className={cn("flex flex-col items-center gap-5 sm:gap-6", className)}>
      <div className="glass max-w-full rounded-full px-4 py-2">
        <Breadcrumbs
          breadcrumbs={breadcrumbs}
          className="font-inter text-[13px] leading-[18px] text-egray-700 hover:text-egray-900 aria-[current=page]:font-medium aria-[current=page]:text-egray-900 sm:text-[14px]"
        />
      </div>

      <SearchBar placeholder={searchPlaceholder} className="max-w-[760px]" />
    </div>
  );
}
