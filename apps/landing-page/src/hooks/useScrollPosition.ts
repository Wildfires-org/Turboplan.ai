import { RefObject, useEffect, useRef, useState } from "react";

interface ScrollPosition {
  isAtTop: boolean;
  isBottomAtTop: boolean;
}

export function useScrollPosition<T extends HTMLElement>(
  headerHeight: number = 0,
): [RefObject<T | null>, ScrollPosition] {
  const [scrollPosition, setScrollPosition] = useState<ScrollPosition>({
    isAtTop: false,
    isBottomAtTop: false,
  });
  const sectionRef = useRef<T>(null);
  const lastScrollY = useRef<number>(0);

  useEffect(() => {
    const handleScroll = (): void => {
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect();
        const currentScrollY = window.scrollY;
        const isScrollingUp = currentScrollY < lastScrollY.current;

        setScrollPosition({
          isAtTop: !isScrollingUp ? rect.top <= headerHeight : false,
          isBottomAtTop: isScrollingUp
            ? rect.bottom >= headerHeight && rect.bottom < 200
            : false,
        });

        lastScrollY.current = currentScrollY;
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [headerHeight]);

  return [sectionRef, scrollPosition];
}
