import React from "react";

import {
  darkFormInputStyles,
  darkFormLabelStyles,
  hasErrorStyles,
  inputStyles,
} from "@/components/shared/styles";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const LabeledInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    isDark?: boolean;
    hasError?: boolean;
    optional?: boolean;
  }
>(
  (
    { label, placeholder, isDark, hasError, optional, className, ...props },
    ref,
  ) => (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        className={cn(
          isDark ? darkFormInputStyles : inputStyles,
          hasError && hasErrorStyles,
          className,
        )}
        placeholder={placeholder}
      />
      <label
        className={`absolute left-3 top-2 label ${isDark ? darkFormLabelStyles : "text-neutral-black"}`}
      >
        {label}{" "}
        <span className="text-neutral-grey3">
          {optional ? "(optional)" : ""}
        </span>
      </label>
    </div>
  ),
);
LabeledInput.displayName = "LabeledInput";

export default LabeledInput;
