"use client";

import { useEffect, useState } from "react";

import { Search } from "lucide-react";
import { useIntersectionObserver } from "usehooks-ts";

import { OmniSearch } from "@wildfires-org/turboplan-search/client";

import { useSearch } from "@/hooks/use-search";
import { cn } from "@/lib/utils";
import { useSearchVisibilityStore } from "@/stores/search-visibility-store";

interface SearchBarProps {
  placeholder?: string;
  className?: string;
}

export default function SearchBar({
  placeholder = "Search agencies, offices and projects...",
  className,
}: SearchBarProps) {
  const [search, setSearch] = useSearch();
  const [isMounted, setIsMounted] = useState(false);

  const { ref: searchBarRef, isIntersecting } = useIntersectionObserver({
    threshold: 0.5,
  });
  const setHeroSearchVisible = useSearchVisibilityStore(
    (state) => state.setHeroSearchVisible,
  );

  useEffect(() => {
    setHeroSearchVisible(isIntersecting ?? true);
  }, [isIntersecting, setHeroSearchVisible]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div
      ref={searchBarRef}
      className={cn("w-full max-w-3xl mx-auto", className)}
    >
      {isMounted ? (
        <OmniSearch.Root value={search} onValueChange={setSearch}>
          {/* glass-inset only while closed: once the dropdown opens the
              input sits transparent on top of the results panel. */}
          <OmniSearch.Input
            placeholder={placeholder}
            className="rounded-2xl border-0 font-inter text-[15px] text-egray-900 placeholder:text-egray-600 focus-visible:ring-0 focus-visible:ring-offset-0 aria-[expanded=false]:glass-inset aria-[expanded=false]:focus-visible:outline-solid aria-[expanded=false]:focus-visible:outline-2 aria-[expanded=false]:focus-visible:outline-brand-700/40"
          />
          <OmniSearch.Overlay />
          <OmniSearch.Content />
        </OmniSearch.Root>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-muted-foreground" />
          <div className="glass-inset flex h-12 w-full items-center rounded-2xl px-12 font-inter text-[15px] text-egray-600">
            {placeholder}
          </div>
        </div>
      )}
    </div>
  );
}
