import React from "react";

import { cn } from "@wildfires-org/turboplan-utils";

import {
  darkFormInputStyles,
  darkFormLabelStyles,
  hasErrorStyles,
  inputStyles,
} from "@/components/shared/styles";
import { Textarea } from "@/components/ui/textarea";

const LabeledTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label: string;
    isDark?: boolean;
    hasError?: boolean;
  }
>(({ label, placeholder, isDark, hasError, className, ...props }, ref) => (
  <div className="relative">
    <Textarea
      {...props}
      ref={ref}
      className={cn(
        "pt-6",
        "min-h-[120px]",
        isDark ? darkFormInputStyles : inputStyles,
        hasError ? hasErrorStyles : "",
        className,
      )}
      placeholder={placeholder}
    />
    <label
      className={`absolute left-3 top-2 label ${isDark ? darkFormLabelStyles : "text-neutral-black"}`}
    >
      {label}
    </label>
  </div>
));
LabeledTextarea.displayName = "LabeledTextarea";

export default LabeledTextarea;
