import {
  ArrowUp,
  ChevronDown,
  Download,
  Keyboard,
  MoreVertical,
  Paperclip,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { AppWindow } from "./app-window";
import { DocAction, Insert, Reveal } from "./showcase-ui";

// ---------------------------------------------------------------------------
// Slide 2 — Draft NEPA documents (TipTap / MUI document editor)
// ---------------------------------------------------------------------------

const DRAFT_INSERTS = [
  "District Ranger name",
  "Project location description",
  "Exact treatment acreage",
  "Comment deadline",
  "Project contact",
];

const DRAFT_CHAT_ACTIONS = [
  "📍 Add location details",
  "👤 Add District Ranger name",
  "✏️ Make other edits first",
];

// Slide 2 — Draft NEPA documents: the project chat with the document artifact
// preview panel open (split view). Left: chat rail where the agent reports the
// drafted scoping letter and the details still needed. Right: the live letter
// preview with USFS letterhead + inline [INSERT] placeholders highlighted.
export function DraftSlide({ reduce }: { reduce: boolean }) {
  return (
    <AppWindow crumb="Chat" active="chat" contentClassName="bg-white">
      <div className="flex h-full">
        {/* Chat rail */}
        <div className="hidden w-[38%] max-w-[340px] shrink-0 flex-col border-r border-egray-100 bg-white md:flex">
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-egray-100 px-4">
            <span className="truncate font-heading text-[14px] font-bold text-neutral-black">
              Canyon Three Fuels Reduction
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-md border border-egray-200 px-2 py-1 font-heading text-[10px] font-medium text-egray-600">
              <Sparkles className="size-3 text-brand-800" />
              Research
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden px-4 py-3">
            <div className="flex gap-2.5">
              <Reveal index={0} reduce={reduce}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-egray-100">
                  <Sparkles className="size-3.5 text-brand-800" />
                </span>
              </Reveal>
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                <Reveal index={0} reduce={reduce}>
                  <p className="font-inter text-[12.5px] leading-[19px] text-neutral-black">
                    The{" "}
                    <span className="font-semibold">
                      Canyon Three — Scoping Letter
                    </span>{" "}
                    is ready. It follows the same structure and formal USFS tone
                    as the reference letter. A few details still need your
                    input:
                  </p>
                </Reveal>
                <Reveal index={1} reduce={reduce}>
                  <ul className="flex flex-col gap-0.5">
                    {DRAFT_INSERTS.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-1.5 font-inter text-[12px] leading-[18px] text-egray-700"
                      >
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-egray-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Reveal>
                <Reveal index={2} reduce={reduce}>
                  <p className="font-inter text-[12.5px] leading-[19px] text-egray-700">
                    Would you like to fill in any of these now, or should I
                    proceed with the suggested values?
                  </p>
                </Reveal>
                <Reveal
                  index={3}
                  reduce={reduce}
                  className="flex flex-wrap gap-1.5"
                >
                  {DRAFT_CHAT_ACTIONS.map((action) => (
                    <span
                      key={action}
                      className="rounded-md border border-egray-200 bg-white px-2 py-1 font-inter text-[11px] font-medium text-neutral-black"
                    >
                      {action}
                    </span>
                  ))}
                </Reveal>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-egray-100 px-4 py-3">
            <div className="relative flex items-center rounded-xl border border-egray-200 bg-white py-2.5 pl-3.5 pr-16">
              <span className="font-inter text-[12.5px] text-egray-400">
                Send a message…
              </span>
              <span className="absolute bottom-1.5 right-9 flex size-7 items-center justify-center rounded-md text-egray-500">
                <Paperclip className="size-3.5" />
              </span>
              <span className="absolute bottom-1.5 right-2 flex size-7 items-center justify-center rounded-md bg-neutral-black">
                <ArrowUp className="size-4 text-white" strokeWidth={2.5} />
              </span>
            </div>
          </div>
        </div>

        {/* Document artifact preview */}
        <div className="flex min-w-0 flex-1 flex-col bg-white">
          {/* Preview header */}
          <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-egray-100 px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md text-egray-500 hover:bg-egray-75">
                <X className="size-4" />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-heading text-[14px] font-medium text-neutral-black">
                  Canyon Three — Scoping Letter
                </span>
                <span className="font-inter text-[11px] text-egray-500">
                  Updated less than a minute ago
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <DocAction
                className="hidden lg:flex"
                icon={<Keyboard className="size-3.5 text-egray-500" />}
                label="Prompt"
              />
              <DocAction
                className="hidden sm:flex"
                icon={<MoreVertical className="size-3.5 text-egray-500" />}
              />
              <DocAction
                icon={<Download className="size-3.5 text-egray-500" />}
                label="Download"
                trailing={<ChevronDown className="size-3 text-egray-400" />}
              />
              <DocAction
                className="hidden sm:flex"
                icon={<Users className="size-3.5 text-egray-500" />}
                label="Request signatures"
              />
            </div>
          </div>

          {/* Letter body — on phones the letter runs past the window, so it
              fades out at the bottom edge like a page continuing below. */}
          <div className="min-h-0 flex-1 overflow-hidden px-6 py-6 max-sm:[mask-image:linear-gradient(to_bottom,black_75%,transparent)] sm:px-10">
            <div className="mx-auto flex max-w-[520px] flex-col gap-3.5">
              {/* USFS letterhead table */}
              <Reveal index={0} reduce={reduce}>
                <div className="flex overflow-hidden rounded-sm border border-egray-300 font-inter text-[9.5px] leading-[14px] text-egray-700">
                  <div className="flex-1 border-r border-egray-300 p-2.5">
                    <p>United States Department of Agriculture</p>
                    <p className="font-semibold text-neutral-black">
                      Forest Service
                    </p>
                    <p>Tahoe National Forest — Nevada City Ranger District</p>
                  </div>
                  <div className="w-[42%] p-2.5">
                    <p>
                      <Insert>
                        [INSERT: office street address — 631 Coyote St.]
                      </Insert>
                    </p>
                    <p className="mt-0.5">Nevada City, CA 95959</p>
                    <p className="mt-0.5">530-265-4531</p>
                    <p className="mt-0.5">
                      Fax: <Insert>[INSERT: office fax number]</Insert>
                    </p>
                  </div>
                </div>
              </Reveal>

              <Reveal index={1} reduce={reduce}>
                <div className="flex flex-col items-end gap-0.5 font-inter text-[10.5px] text-egray-700">
                  <p>
                    File Code: <Insert>[INSERT: file code]</Insert>
                  </p>
                  <p>Date: August 12, 2026</p>
                </div>
              </Reveal>

              <Reveal index={2} reduce={reduce}>
                <p className="font-inter text-[11.5px] font-medium text-neutral-black">
                  Dear Interested Party:
                </p>
              </Reveal>

              <Reveal index={3} reduce={reduce}>
                <p className="font-inter text-[11.5px] leading-[19px] text-egray-700">
                  The Tahoe National Forest,{" "}
                  <Insert>
                    [INSERT: Nevada City Ranger District — suggested: Yuba River
                    Ranger District]
                  </Insert>
                  , is proposing the Canyon Three Fuels Reduction project to
                  reduce hazardous fuels across{" "}
                  <Insert>
                    [INSERT: treatment acreage — within the 50–100 acre range]
                  </Insert>{" "}
                  near{" "}
                  <Insert>
                    [INSERT: project location description — e.g., watershed or
                    road corridor]
                  </Insert>
                  .
                </p>
              </Reveal>

              <Reveal index={4} reduce={reduce}>
                <p className="font-inter text-[11.5px] leading-[19px] text-egray-700">
                  We invite your comments during the scoping period. Please
                  submit written comments by{" "}
                  <Insert>[INSERT: comment deadline]</Insert> to the address
                  above or through the project web page at{" "}
                  <Insert>[INSERT: project web page URL]</Insert>.
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}
