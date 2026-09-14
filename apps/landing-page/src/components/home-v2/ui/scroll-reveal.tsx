"use client";

import type { ReactNode } from "react";

import { motion } from "framer-motion";

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
  duration?: number;
  className?: string;
  once?: boolean;
}

const directionOffsets = {
  up: { y: 24 },
  down: { y: -24 },
  left: { x: 24 },
  right: { x: -24 },
  none: {},
};

export function ScrollReveal({
  children,
  delay = 0,
  direction = "up",
  distance,
  duration = 0.6,
  className,
  once = true,
}: ScrollRevealProps) {
  const offset = directionOffsets[direction];
  const scaledOffset = distance
    ? Object.fromEntries(
        Object.entries(offset).map(([k, v]) => [
          k,
          v > 0 ? distance : -distance,
        ]),
      )
    : offset;

  return (
    <motion.div
      initial={{ opacity: 0, ...scaledOffset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, margin: "-60px" }}
      transition={{
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
