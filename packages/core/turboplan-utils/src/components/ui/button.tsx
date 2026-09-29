import * as React from "react";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../tailwind";
import { GLASS_CLASS } from "./glass-classes";

// Press feedback (landing `press`): scale .97 on :active, 160ms strong
// ease-out, off for reduced motion. Replaces the base transition-colors.
const GLASS_PRESS_CLASS =
  "transition-[transform,opacity,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] motion-reduce:active:scale-100";

// Outline focus: these variants own their box-shadow, which a ring would
// replace.
const OUTLINE_FOCUS_CLASS =
  "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        "ghost-outline":
          "border border-transparent hover:border-purple-100 hover:bg-gradient-to-tr hover:text-accent-foreground from-purple-50/80 to-violet-50/60",
        link: "text-primary underline-offset-4 hover:underline",
        brandAlt: "bg-brandAlt-400 text-white hover:bg-brandAlt-500",
        // Filled primary CTA (landing `btn-primary`): diagonal brand gradient,
        // top inner highlight, soft drop; hover dims via opacity only.
        brand: `${GLASS_PRESS_CLASS} rounded-xl bg-[linear-gradient(135deg,#1d8a60_0%,#1b845c_25%,#156647_65%,#0f4832_100%)] text-white shadow-[inset_0_2px_2px_0_rgba(255,255,255,0.25),0_6px_16px_-8px_rgba(15,72,50,0.45)] [@media(hover:hover)]:hover:opacity-90 disabled:bg-none disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100 disabled:shadow-none ${OUTLINE_FOCUS_CLASS}`,
        // Secondary glass button (landing `GLASS_BUTTON_CLASS`).
        glass: `${GLASS_PRESS_CLASS} ${GLASS_CLASS} rounded-xl text-brand-800 hover:bg-white/90 dark:text-brand-300 dark:hover:bg-white/10 ${OUTLINE_FOCUS_CLASS}`,
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3",
        xs: "h-7 px-2 text-xs",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
