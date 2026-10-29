import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ScrollRevealProps {
  children: ReactNode;
  /** Stagger, in the seconds the old timed reveal used; each 0.1 starts the
   * reveal 20px later in the scroll. */
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
  className?: string;
}

type Direction = NonNullable<ScrollRevealProps["direction"]>;

const DEFAULT_DISTANCE = 24;

// Scroll distance per second of `delay`.
const STAGGER_PX_PER_SECOND = 200;

const getOffsetTransform = (direction: Direction, distance: number) => {
  switch (direction) {
    case "up":
      return `translateY(${distance}px)`;
    case "down":
      return `translateY(${-distance}px)`;
    case "left":
      return `translateX(${distance}px)`;
    case "right":
      return `translateX(${-distance}px)`;
    default:
      return "none";
  }
};

/**
 * Fades content in as it scrolls into view, with a CSS scroll-driven animation
 * (`.scroll-reveal` in globals.css). The content is in the server HTML at full
 * opacity: browsers without view timelines, and reduced-motion users, simply
 * see it, and nothing waits for JavaScript. The framer-motion `whileInView`
 * version held every section at opacity 0 until hydration, which made a
 * below-the-fold card the page's largest contentful paint.
 */
export const ScrollReveal = ({
  children,
  delay = 0,
  direction = "up",
  distance = DEFAULT_DISTANCE,
  className,
}: ScrollRevealProps) => {
  const style = {
    "--reveal-from": getOffsetTransform(direction, Math.abs(distance)),
    "--reveal-start": `${Math.round(delay * STAGGER_PX_PER_SECOND)}px`,
  } as CSSProperties;

  return (
    <div className={cn("scroll-reveal", className)} style={style}>
      {children}
    </div>
  );
};
