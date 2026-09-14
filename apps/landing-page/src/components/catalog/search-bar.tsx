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
          <OmniSearch.Input
            placeholder={placeholder}
            className="border-0 outline-hidden"
          />
          <OmniSearch.Overlay />
          <OmniSearch.Content />
        </OmniSearch.Root>
      ) : (
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none size-5 left-4" />
          <div className="h-12 w-full rounded-3xl border border-input bg-white px-12 text-base tracking-tight text-muted-foreground flex items-center">
            {placeholder}
          </div>
        </div>
      )}
    </div>
  );
}
