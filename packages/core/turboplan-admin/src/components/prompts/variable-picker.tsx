"use client";

import { useMemo } from "react";

import { AlertTriangle, Check, ChevronDown } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";

import { usePromptVariablesFor } from "../../hooks/use-prompts";

interface VariablePickerProps {
  promptName: string;
  onSelect: (variable: string) => void;
  disabled?: boolean;
  content?: string;
}

export function VariablePicker({
  promptName,
  onSelect,
  disabled,
  content,
}: VariablePickerProps) {
  const { variables, isLoading } = usePromptVariablesFor(promptName);

  const presentVariables = useMemo(() => {
    if (!content) return new Set<string>();
    const names = new Set<string>();
    const regex = /\{\{(\w+)\}\}/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      names.add(match[1]);
    }
    return names;
  }, [content]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isLoading || variables.length === 0}
          className="gap-1"
        >
          Insert Variable
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {variables.map((variable) => (
          <DropdownMenuItem
            key={variable.name}
            onClick={() => onSelect(`{{${variable.name}}}`)}
            className="flex flex-col items-start gap-1 py-2"
          >
            <div className="flex items-center gap-2">
              {content !== undefined &&
                (presentVariables.has(variable.name) ? (
                  <Check className="size-3 text-green-500" />
                ) : (
                  <AlertTriangle className="size-3 text-amber-500" />
                ))}
              <code className="text-sm font-mono bg-muted px-1 rounded">
                {`{{${variable.name}}}`}
              </code>
              {variable.isProtected && (
                <span className="text-xs text-muted-foreground">
                  (protected)
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {variable.description}
            </span>
          </DropdownMenuItem>
        ))}
        {variables.length === 0 && !isLoading && (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            No variables for this prompt
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
