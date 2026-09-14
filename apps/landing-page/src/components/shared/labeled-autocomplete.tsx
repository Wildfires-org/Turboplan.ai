import React from "react";

import {
  darkFormInputStyles,
  darkFormLabelStyles,
  hasErrorStyles,
  inputStyles,
} from "@/components/shared/styles";
import { Autocomplete, AutocompleteProps } from "@/components/ui/autocomplete";
import { cn } from "@/lib/utils";

export interface LabeledAutocompleteProps
  extends Omit<AutocompleteProps, "ref"> {
  label: string;
  isDark?: boolean;
  optional?: boolean;
}

export const LabeledAutocomplete = React.forwardRef<
  HTMLInputElement,
  LabeledAutocompleteProps
>(
  (
    {
      label,
      placeholder,
      isDark,
      optional,
      hasError,
      className,
      inputClassName,
      value,
      ...props
    },
    ref,
  ) => {
    return (
      <div className="relative">
        <Autocomplete
          {...props}
          ref={ref}
          placeholder={placeholder}
          hasError={hasError}
          value={value}
          inputClassName={cn(
            inputStyles,
            isDark && darkFormInputStyles,
            hasError && hasErrorStyles,
            className,
            inputClassName,
          )}
        />
        <label
          className={cn(
            "absolute left-3 top-2 label text-neutral-black",
            isDark && darkFormLabelStyles,
          )}
        >
          {label}{" "}
          <span className="text-neutral-grey3">
            {optional ? "(optional)" : ""}
          </span>
        </label>
      </div>
    );
  },
);

LabeledAutocomplete.displayName = "LabeledAutocomplete";

export default LabeledAutocomplete;
