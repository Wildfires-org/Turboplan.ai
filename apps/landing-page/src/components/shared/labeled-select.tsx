import React from "react";

import {
  darkFormLabelStyles,
  darkFormSelectStyles,
  hasErrorStyles,
  inputStyles,
} from "@/components/shared/styles";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function LabeledSelect({
  label,
  placeholder,
  isDark,
  hasError,
  className,
  ...props
}: {
  label: string;
  placeholder?: string;
  isDark?: boolean;
  hasError?: boolean;
  className?: string;
} & React.ComponentProps<typeof Select>) {
  return (
    <div className="relative">
      <Select {...props}>
        <SelectTrigger
          className={cn(
            inputStyles,
            isDark && darkFormSelectStyles,
            hasError && hasErrorStyles,
          )}
        >
          <SelectValue
            placeholder={placeholder}
            {...(isDark ? { className: "border-transparent" } : {})}
          />
        </SelectTrigger>
        {props.children}
      </Select>
      <label
        className={cn(
          "absolute left-3 top-2 label text-neutral-black",
          isDark && darkFormLabelStyles,
        )}
      >
        {label}
      </label>
    </div>
  );
}
