"use client";

import { useEffect, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import Image from "next/image";
import { useInterval } from "usehooks-ts";

import { brand } from "@/lib/brand";
import { LOADING_FACTS } from "./loading-facts";

const FACT_ROTATION_MS = 6000;

interface LoadingStateProps {
  isAuthenticated: boolean;
}

// Mirrors the (auth) layout look (brand background, logo, white card, beaver)
// so the hand-off from the landing page doesn't land on a blank white screen.
export function LoadingState({ isAuthenticated }: LoadingStateProps) {
  const appName = brand.name;

  // Deterministic first render (this component is server-rendered), then jump
  // to a random fact after mount so repeat visitors don't always see the same
  // one. Randomizing in the useState initializer would run on the server too
  // and cause a hydration mismatch.
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    setFactIndex(Math.floor(Math.random() * LOADING_FACTS.length));
  }, []);

  useInterval(() => {
    setFactIndex((i) => (i + 1) % LOADING_FACTS.length);
  }, FACT_ROTATION_MS);

  const fact = LOADING_FACTS[factIndex];

  return (
    <div className="flex min-h-dvh w-screen bg-brandAlt-100">
      <div className="absolute top-6 left-6 sm:top-[63px] sm:left-[116px] flex items-center gap-1.5">
        <Image
          src={brand.logo}
          alt={appName}
          width={32}
          height={32}
          className="size-8"
        />
        <span className="font-mono font-semibold text-[22px] bg-gradient-to-b from-neutral-800 to-[#033923] bg-clip-text text-transparent tracking-tight">
          {appName}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] p-9 w-full max-w-[456px]">
          <div className="flex flex-col items-center gap-3 text-center">
            <Image
              src="/images/auth/beaver-verifying.gif"
              alt=""
              width={111}
              height={120}
              className="mb-2"
              unoptimized
            />
            <h1 className="text-2xl font-bold text-gray-950">
              {isAuthenticated
                ? "Creating your project..."
                : "Setting up your account..."}
            </h1>
            <p className="text-sm text-neutral-400">
              {isAuthenticated
                ? "This usually takes a few seconds"
                : "We'll send you a sign-in link in a moment"}
            </p>
          </div>

          <div className="mt-8 rounded-xl border border-brandAlt-200 bg-brandAlt-100/60 p-5 text-left">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brandAlt-500">
              <Lightbulb className="size-4" aria-hidden="true" />
              While you wait
            </div>
            <div className="relative min-h-[5.5rem]" aria-live="polite">
              <AnimatePresence mode="wait">
                <motion.div
                  key={factIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-sm leading-relaxed text-gray-950">
                    {fact.text}
                  </p>
                  <p className="mt-2 text-xs text-neutral-400">
                    Source: {fact.source}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
