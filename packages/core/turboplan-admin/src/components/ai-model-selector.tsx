"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { useOnClickOutside } from "usehooks-ts";

import { cn, Input, Label, ScrollArea } from "@wildfires-org/turboplan-utils";

import type { AvailableModel } from "../hooks/use-ai-models";

const groupModelsByProvider = (models: AvailableModel[]) => {
  const groups = new Map<string, AvailableModel[]>();

  for (const model of models) {
    const slashIndex = model.id.indexOf("/");
    const provider =
      slashIndex !== -1 ? model.id.slice(0, slashIndex) : "other";
    const existing = groups.get(provider);
    if (existing) {
      existing.push(model);
    } else {
      groups.set(provider, [model]);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([provider, models]) => ({ provider, models }));
};

export type AiModelSelectorProps = {
  id: string;
  label: string;
  value: string;
  defaultValue: string;
  models: AvailableModel[];
  modelsLoading: boolean;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export const AiModelSelector = ({
  id,
  label,
  value,
  defaultValue,
  models,
  modelsLoading,
  onChange,
  disabled,
}: AiModelSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useOnClickOutside(containerRef as React.RefObject<HTMLElement>, () => {
    setIsOpen(false);
    setSearch("");
  });

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredGroups = useMemo(() => {
    const query = search.toLowerCase().trim();
    const filtered = query
      ? models.filter(
          (m) =>
            m.id.toLowerCase().includes(query) ||
            m.name.toLowerCase().includes(query),
        )
      : models;
    return groupModelsByProvider(filtered);
  }, [models, search]);

  const activeModelId = value || defaultValue;
  const activeModelName =
    models.find((m) => m.id === activeModelId)?.name ?? activeModelId;
  const isDefault = activeModelId === defaultValue;

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const handleTriggerClick = () => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
      setSearch("");
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          id={id}
          onClick={handleTriggerClick}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm ring-offset-background",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <span
            className={cn("truncate", isDefault && "text-muted-foreground")}
          >
            {activeModelName}
            {isDefault && " (default)"}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleClear(e as unknown as React.MouseEvent);
                  }
                }}
                className="rounded-sm opacity-70 hover:opacity-100"
              >
                <X className="size-3.5" />
              </span>
            )}
            <ChevronDown className="size-4 opacity-50" />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
            <div className="p-2">
              <Input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="h-8"
              />
            </div>
            <ScrollArea className="max-h-[300px] overflow-y-auto">
              {modelsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No models found.
                </div>
              ) : (
                <div className="p-1">
                  {filteredGroups.map((group) => (
                    <div key={group.provider}>
                      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase capitalize">
                        {group.provider}
                      </div>
                      {group.models.map((model) => {
                        const isSelected = model.id === value;
                        const isDefault = model.id === defaultValue;
                        return (
                          <button
                            type="button"
                            key={model.id}
                            onClick={() => handleSelect(model.id)}
                            className={cn(
                              "flex w-full items-center gap-2 px-3 py-2 text-sm cursor-pointer rounded-sm text-left",
                              "hover:bg-accent",
                              isSelected && "bg-accent",
                            )}
                          >
                            <Check
                              className={cn(
                                "size-4 shrink-0",
                                isSelected ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate">
                                {model.name}
                                {isDefault && (
                                  <span className="text-muted-foreground ml-1">
                                    (default)
                                  </span>
                                )}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {model.id}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
};
