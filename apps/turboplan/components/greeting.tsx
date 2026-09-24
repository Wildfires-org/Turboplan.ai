import { motion, useReducedMotion } from "framer-motion";

import { SparklesIcon } from "./icons";

const ENTER_EASE = [0.23, 1, 0.32, 1] as const;

/** Empty chat state: glass mark + app-scaled page title and lead. */
export const Greeting = () => {
  const shouldReduceMotion = useReducedMotion();
  const offset = shouldReduceMotion ? "0px" : "8px";

  return (
    <div
      key="overview"
      className="mx-auto flex size-full max-w-3xl flex-col justify-center px-8 md:mt-20"
    >
      <motion.div
        initial={{ opacity: 0, transform: `translateY(${offset})` }}
        animate={{ opacity: 1, transform: "translateY(0px)" }}
        transition={{ delay: 0.15, duration: 0.3, ease: ENTER_EASE }}
        className="flex flex-col gap-3"
      >
        <span className="glass flex size-10 items-center justify-center rounded-2xl text-brand-800">
          <SparklesIcon size={16} />
        </span>
        <div>
          <h2 className="text-[26px] font-medium leading-[1.15] tracking-[-0.03em] text-foreground">
            Hello there!
          </h2>
          <p className="mt-1.5 text-[17px] leading-6 tracking-[-0.01em] text-gray-550">
            How can I help you today?
          </p>
        </div>
      </motion.div>
    </div>
  );
};
