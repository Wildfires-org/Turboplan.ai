import * as React from "react";

import { cn } from "../../tailwind";
import { GLASS_INSET_CLASS } from "./glass-classes";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-xl px-3 py-2 text-base placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        GLASS_INSET_CLASS,
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
