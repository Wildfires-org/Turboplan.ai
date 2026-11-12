import { cn } from "../../tailwind";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Glass-system placeholder tone (cream), static for reduced motion.
        "animate-pulse rounded-md bg-brandAlt-200/70 motion-reduce:animate-none dark:bg-slate-800/70",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
