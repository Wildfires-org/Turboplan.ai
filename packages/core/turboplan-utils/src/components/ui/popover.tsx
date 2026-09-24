"use client";

import * as React from "react";

import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "../../tailwind";
import {
  GLASS_POPOVER_CLASS,
  GLASS_POPPER_MOTION_CLASS,
} from "./glass-classes";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 origin-[--radix-popover-content-transform-origin] p-4 text-popover-foreground outline-none",
        GLASS_POPOVER_CLASS,
        GLASS_POPPER_MOTION_CLASS,
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
