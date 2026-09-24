import {
  ArrowUp,
  ChevronDown,
  Lightbulb,
  Paperclip,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { AppWindow } from "./app-window";
import { Reveal } from "./showcase-ui";

// ---------------------------------------------------------------------------
// Slide 1 — Research projects with AI (project chat + research agent)
// ---------------------------------------------------------------------------

const RESEARCH_FINDINGS = [
  { label: "Project", value: "Canyon Three Fuels Reduction" },
  { label: "Location", value: "Sierra National Forest, Fresno County, CA" },
  { label: "Size", value: "~1,250 acres" },
  { label: "Lead Agency", value: "USDA Forest Service" },
  {
    label: "NEPA Pathway",
    value: "Categorical Exclusion — 36 CFR 220.6(e)(6)",
  },
];

const RESEARCH_ACTIONS = [
  "📄 Decision Memo",
  "📊 Environmental Assessment",
  "✅ Task List",
];

export function ResearchSlide({ reduce }: { reduce: boolean }) {
  return (
    <AppWindow crumb="New Chat" active="chat" contentClassName="bg-white">
      <div className="flex h-full flex-col">
        {/* Chat page heading */}
        <div className="flex h-14 shrink-0 items-center border-b border-egray-100 px-5">
          <span className="font-heading text-[14px] font-bold text-neutral-black">
            New Chat
          </span>
        </div>

        {/* Conversation */}
        <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
          <div className="mx-auto flex max-w-[600px] flex-col gap-4">
            {/* User bubble */}
            <Reveal index={0} reduce={reduce} className="flex justify-end">
              <span className="max-w-[80%] rounded-xl bg-blue-140 px-3 py-2 font-inter text-[13px] leading-[20px] text-blue-80">
                Research fuel-reduction options near the Deer Creek watershed.
              </span>
            </Reveal>

            {/* Assistant */}
            <div className="flex gap-3">
              <Reveal index={1} reduce={reduce}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-egray-100">
                  <Sparkles className="size-4 text-brand-800" />
                </span>
              </Reveal>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <Reveal index={1} reduce={reduce} className="hidden sm:block">
                  <span className="inline-flex h-5 w-fit items-center gap-1 rounded border border-egray-200 bg-egray-50 px-1.5 text-[10px] font-medium leading-4 text-egray-600">
                    readProjectDocuments result
                  </span>
                </Reveal>

                <Reveal index={2} reduce={reduce} className="hidden sm:block">
                  <div className="flex items-center gap-2 rounded-lg border border-egray-100 bg-white px-4 py-2.5 shadow-sm">
                    <Lightbulb className="size-4 shrink-0 text-brand-deco" />
                    <span className="font-inter text-[13px] font-medium text-neutral-black">
                      Project Context from Uploaded Document
                    </span>
                    <ChevronDown className="ml-auto size-4 text-egray-400" />
                  </div>
                </Reveal>

                <div className="flex flex-col gap-1.5">
                  {RESEARCH_FINDINGS.map((finding, i) => (
                    <Reveal
                      key={finding.label}
                      index={i + 3}
                      reduce={reduce}
                      // Phones show the first three findings only.
                      className={cn(i > 2 && "hidden sm:block")}
                    >
                      <p className="font-inter text-[13px] leading-[20px] text-neutral-black">
                        <span className="font-semibold">{finding.label}:</span>{" "}
                        <span className="text-egray-700">{finding.value}</span>
                      </p>
                    </Reveal>
                  ))}
                </div>

                <Reveal
                  index={8}
                  reduce={reduce}
                  className="flex flex-wrap gap-2"
                >
                  {RESEARCH_ACTIONS.map((action) => (
                    <span
                      key={action}
                      className="rounded-md border border-egray-200 bg-white px-3 py-1.5 font-inter text-[12.5px] font-medium text-neutral-black"
                    >
                      {action}
                    </span>
                  ))}
                </Reveal>
              </div>
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-egray-100 px-5 py-3">
          <Reveal index={9} reduce={reduce} className="mx-auto max-w-[600px]">
            <div className="relative flex items-center rounded-xl border-2 border-neutral-black/85 bg-white py-2.5 pl-3.5 pr-20">
              <span className="font-inter text-[13px] text-egray-500">
                Draft the scoping letter for the CE
              </span>
              <span className="absolute bottom-2 right-10 flex size-7 items-center justify-center rounded-md bg-egray-75">
                <Paperclip className="size-3.5 text-egray-600" />
              </span>
              <span className="absolute bottom-2 right-2 flex size-7 items-center justify-center rounded-md bg-neutral-black">
                <ArrowUp className="size-4 text-white" strokeWidth={2.5} />
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </AppWindow>
  );
}
