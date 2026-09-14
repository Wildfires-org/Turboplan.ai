"use client";

import { useEffect, useState } from "react";

// Tailwind v4 dropped `tailwindcss/resolveConfig` and breakpoints now live as
// `--breakpoint-*` tokens in the `@theme` block of `src/globals.css`. This map
// mirrors those values (Tailwind defaults for sm–xl plus the custom 2xl/3xl/
// ultrawide overrides) so the hook keeps working without a JS config lookup.
const screens = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1224px",
  "3xl": "1540px",
  ultrawide: "1920px",
} as const;

const useBreakpoint = (query: keyof typeof screens): boolean => {
  const [isMatch, setMatch] = useState<boolean>(false);
  const mediaQuery = `(min-width: ${screens[query]})`;
  const matchQueryList =
    typeof window === "undefined" || !window
      ? undefined
      : window?.matchMedia(mediaQuery);
  const onChange = (e: MediaQueryListEvent) => setMatch(e.matches);

  useEffect(() => {
    if (matchQueryList) {
      setMatch(matchQueryList.matches);
      matchQueryList.addEventListener("change", onChange);
      return () => matchQueryList.removeEventListener("change", onChange);
    }
  }, [query, matchQueryList]);

  return isMatch;
};
export default useBreakpoint;
