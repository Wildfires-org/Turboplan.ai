import { motion } from "framer-motion";

const Dot = ({ delay }: { delay: number }) => {
  const dotAnimation = {
    y: [0, -8, 0],
  };

  return (
    <motion.span
      className="rounded-full"
      style={{ width: "4px", height: "4px", backgroundColor: "#9299A1" }}
      animate={dotAnimation}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    />
  );
};

export const ThinkingDots = () => {
  return (
    <div className="flex gap-1.5 items-center h-8">
      <Dot delay={0} />
      <Dot delay={0.15} />
      <Dot delay={0.3} />
    </div>
  );
};
