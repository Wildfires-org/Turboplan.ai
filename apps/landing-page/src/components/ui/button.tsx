import * as React from "react";

import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
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
        link: "text-primary underline-offset-4 hover:underline",
        primary:
          "text-base font-normal bg-green-60 text-white rounded-[8px] hover:bg-green-70 active:bg-green-80 focus:ring-4 focus:ring-green-10 disabled:text-gray-40 disabled:bg-neutral-grey",
        tertiary:
          "text-sm leading-[18px] font-normal bg-neutral-light text-neutral-black rounded-[100px] border-[0.75px] border-neutral-grey hover:bg-gray-10 hover:border-gray-30 active:bg-neutral-grey active:border-neutral-grey focus:ring-4 focus:ring-neutral-grey focus:bg-gray-10  disabled:text-gray-40 disabled:bg-neutral-grey disabled:ring-neutral-grey",
        secondaryV2:
          "text-base font-normal bg-white text-gray-70 rounded-[80px] hover:bg-gray-200 focus:ring-none focus:ring-neutral-grey disabled:text-gray-40",
      },
      size: {
        default: "h-10 px-5 py-2",
        small: "h-9 rounded-[8px] px-3 text-sm leading-[18px]",
        sm: "h-9 rounded-md px-3",
        lg: "rounded-[80px] px-5 py-3 font-medium text-lg leading-[24px]",
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
  rightIcon?: () => React.JSX.Element;
  iconClassName?: string;
  isLoading?: boolean;
  loadingText?: string;
  wideButton?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      rightIcon: RightIcon,
      iconClassName,
      isLoading = false,
      loadingText = "Loading",
      wideButton,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const iconContent = isLoading ? (
      <Loader2 className={cn("ml-3 h-5 w-5 animate-spin", iconClassName)} />
    ) : (
      RightIcon && <RightIcon />
    );

    if (asChild) {
      return (
        <Comp
          className={cn(
            buttonVariants({ variant, size, className }),
            wideButton && "w-full",
          )}
          ref={ref}
          disabled={isLoading || props.disabled}
          {...props}
        >
          <Slottable>{children}</Slottable>
          {iconContent}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          wideButton && "w-full",
        )}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        <span
          className={cn(
            "flex items-center justify-center w-full",
            wideButton && "justify-between",
          )}
        >
          {children}
          {iconContent}
        </span>
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
