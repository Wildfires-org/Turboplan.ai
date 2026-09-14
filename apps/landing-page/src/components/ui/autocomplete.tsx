import {
  forwardRef,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type Option = Record<"value" | "label", string> & Record<string, string>;

export interface AutocompleteProps {
  options: Option[];
  emptyMessage?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  hasError?: boolean;
  className?: string;
  inputClassName?: string;
}

export const Autocomplete = forwardRef<HTMLInputElement, AutocompleteProps>(
  (
    {
      options,
      placeholder,
      emptyMessage,
      value,
      onValueChange,
      onBlur,
      disabled,
      hasError,
      className,
      inputClassName,
    },
    ref,
  ) => {
    const [isOpen, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState<string>(value || "");
    const [isUserTyping, setIsUserTyping] = useState(false);

    useEffect(() => {
      setInputValue(value || "");
    }, [value]);

    const filteredOptions = useMemo(() => {
      if (!isUserTyping) {
        return options;
      }
      const lowercasedInput = inputValue.toLowerCase();
      return options.filter((option) =>
        option.label.toLowerCase().includes(lowercasedInput),
      );
    }, [options, inputValue, isUserTyping]);

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          onValueChange?.(inputValue);
          setOpen(false);
          if (ref && "current" in ref && ref.current) {
            ref.current.blur();
          }
        }
        if (event.key === "Escape") {
          setOpen(false);
          if (ref && "current" in ref && ref.current) {
            ref.current.blur();
          }
        }
      },
      [onValueChange, inputValue, ref],
    );

    const handleBlur = useCallback(
      (event: React.FocusEvent) => {
        // Only close if focus is not within the popover
        const relatedTarget = event.relatedTarget as HTMLElement | null;
        if (!relatedTarget?.closest("[cmdk-list-sizer]")) {
          onBlur?.();
        }
      },
      [onBlur],
    );

    const handleSelectOption = useCallback(
      (selectedOption: Option) => {
        setInputValue(selectedOption.label);
        setIsUserTyping(false);
        onValueChange?.(selectedOption.label);
        setOpen(false);
        if (ref && "current" in ref && ref.current) {
          ref.current.blur();
        }
      },
      [onValueChange, ref],
    );

    const handleInputChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setInputValue(value);
        setIsUserTyping(true);
        onValueChange?.(value);
        setOpen(true);
      },
      [onValueChange],
    );

    const handleInputClick = useCallback(() => {
      setIsUserTyping(false);
      setOpen(true);
    }, []);

    return (
      <div className={cn("relative", className)}>
        <Popover open={isOpen} onOpenChange={setOpen}>
          <Command shouldFilter={false}>
            <PopoverTrigger asChild>
              <div
                className={cn(
                  "flex items-center w-full bg-popover rounded-md bg-white",
                  hasError && "border-red-500",
                )}
                onClick={handleInputClick}
              >
                <Input
                  ref={ref}
                  value={inputValue}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  disabled={disabled}
                  className={cn(
                    "w-full h-14 px-3 text-base focus:outline-hidden focus:ring-0 focus:border-ring bg-transparent",
                    inputClassName,
                  )}
                />
              </div>
            </PopoverTrigger>
            {!isOpen && <CommandList aria-hidden="true" className="hidden" />}
            <PopoverContent
              className="z-[70] w-[--radix-popover-trigger-width] overflow-hidden p-0"
              onOpenAutoFocus={(e) => e.preventDefault()}
              align="start"
              sideOffset={4}
              onMouseDown={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              <CommandList
                className="max-h-60 overflow-y-auto overscroll-contain rounded-md text-base focus:outline-hidden sm:text-sm"
                onMouseDown={(e) => e.preventDefault()}
              >
                {filteredOptions.length > 0 ? (
                  <CommandGroup>
                    {filteredOptions.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        onSelect={() => handleSelectOption(option)}
                        className="cursor-pointer select-none relative py-2 pl-3 pr-9 text-gray-900 hover:bg-gray-100"
                      >
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {filteredOptions.length === 0 && emptyMessage && (
                  <CommandEmpty className="py-2 px-3 text-sm text-gray-500">
                    {emptyMessage}
                  </CommandEmpty>
                )}
              </CommandList>
            </PopoverContent>
          </Command>
        </Popover>
      </div>
    );
  },
);

Autocomplete.displayName = "Autocomplete";

export default Autocomplete;
