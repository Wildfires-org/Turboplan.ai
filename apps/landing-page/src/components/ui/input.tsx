import * as React from "react";

import { cx } from "class-variance-authority";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: () => React.JSX.Element;
  rightIcon?: () => React.JSX.Element;
  maxWidth?: string;
  iconClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      maxWidth,
      iconClassName,
      ...props
    },
    ref,
  ) => {
    return (
      <div className={cn("relative flex w-full items-center ", maxWidth)}>
        {LeftIcon && (
          <div className={cx("absolute ml-4 mt-2", iconClassName)}>
            <LeftIcon />
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground placeholder:text-neutral-greyDark focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 text-ellipsis",
            LeftIcon ? "pl-12" : "",
            RightIcon ? "pr-12" : "",
            className,
          )}
          ref={ref}
          {...props}
        />
        {RightIcon && (
          <div className={cx("absolute right-4 mt-2", iconClassName)}>
            <RightIcon />
          </div>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
