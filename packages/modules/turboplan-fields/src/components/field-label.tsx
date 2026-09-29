"use client";

import { HelpCircle } from "lucide-react";

import {
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@wildfires-org/turboplan-utils";

interface FieldLabelProps {
  name: string;
  isRequired: boolean;
  tooltip?: string | null;
  className?: string;
  tooltipVariant?: "native" | "rich";
}

export function FieldLabel({
  name,
  isRequired,
  tooltip,
  className,
  tooltipVariant = "native",
}: FieldLabelProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className="truncate text-[13px] leading-5 text-gray-550">
        {name}
        {isRequired && <span className="ml-0.5 text-error-700">*</span>}
      </span>

      {tooltip &&
        (tooltipVariant === "rich" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="size-4 shrink-0 cursor-help text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-sm">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span title={tooltip}>
            <HelpCircle className="size-4 shrink-0 cursor-help text-muted-foreground" />
          </span>
        ))}
    </div>
  );
}
