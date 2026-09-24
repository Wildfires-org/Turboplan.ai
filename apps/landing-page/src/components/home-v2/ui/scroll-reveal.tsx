"use client";

import type { ReactNode } from "react";

import { motion, useReducedMotion } from "framer-motion";

import { EASE_OUT } from "./motion";

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
  duration?: number;
  className?: string;
  once?: boolean;
}

type Direction = NonNullable<ScrollRevealProps["direction"]>;

const DEFAULT_DISTANCE = 24;

// Full transform strings rather than framer's `x`/`y` shorthands — the
// shorthands run on the main thread and drop frames under load.
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
      return null;
  }
};

const getRestTransform = (direction: Direction) =>
  direction === "left" || direction === "right"
    ? "translateX(0px)"
    : "translateY(0px)";

export function ScrollReveal({
  children,
  delay = 0,
  direction = "up",
  distance = DEFAULT_DISTANCE,
  duration = 0.45,
  className,
  once = true,
}: ScrollRevealProps) {
  const prefersReducedMotion = useReducedMotion();

  // Reduced motion keeps the fade but drops the positional offset.
  const offset = prefersReducedMotion
    ? null
    : getOffsetTransform(direction, Math.abs(distance));

  return (
    <motion.div
      initial={offset ? { opacity: 0, transform: offset } : { opacity: 0 }}
      whileInView={
        offset
          ? { opacity: 1, transform: getRestTransform(direction) }
          : { opacity: 1 }
      }
      viewport={{ once, margin: "-60px" }}
      transition={{
        duration,
        delay,
        ease: EASE_OUT,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
