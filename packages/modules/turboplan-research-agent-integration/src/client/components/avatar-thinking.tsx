"use client";

import { useState } from "react";

import { cn } from "@wildfires-org/turboplan-utils";

import { Persona, type PersonaState } from "./ai-elements/persona";

const PERSONA_STATES: PersonaState[] = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "asleep",
];

const DEBUG = false;

type AvatarThinkingProps = {
  className?: string;
  state: PersonaState;
};

export function AvatarThinking({ className, state }: AvatarThinkingProps) {
  const [debugState, setDebugState] = useState<PersonaState | null>(null);
  const activeState = debugState ?? state;

  return (
    <div className="relative">
      <Persona
        variant="opal"
        state={activeState}
        className={cn(
          "size-6 transition-all duration-300",
          activeState === "idle" && "saturate-50 scale-90",
          className,
        )}
      />
      {DEBUG && (
        <PersonaDebugSelector
          activeState={activeState}
          onStateSelect={setDebugState}
        />
      )}
    </div>
  );
}

type PersonaDebugSelectorProps = {
  activeState: PersonaState;
  onStateSelect: (state: PersonaState) => void;
};

function PersonaDebugSelector({
  activeState,
  onStateSelect,
}: PersonaDebugSelectorProps) {
  return (
    <div className="absolute top-full -right-1/2 mt-2 z-50 flex gap-1 bg-white border border-neutral-200 rounded-lg p-1.5 shadow-lg whitespace-nowrap">
      {PERSONA_STATES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStateSelect(s);
          }}
          className={cn(
            "px-2 py-0.5 text-[10px] rounded-md font-medium transition-colors",
            activeState === s
              ? "bg-brand-800 text-white"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
