import * as React from "react";

import { cn } from "../../tailwind";
import { GLASS_INSET_CLASS } from "./glass-classes";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          GLASS_INSET_CLASS,
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
