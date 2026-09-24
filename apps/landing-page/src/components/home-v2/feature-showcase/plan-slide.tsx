import { ListChecks, Lock } from "lucide-react";
import Image from "next/image";

import { AppWindow } from "./app-window";
import { ProgressBar, Reveal, SectionCard } from "./showcase-ui";

// ---------------------------------------------------------------------------
// Slide 3 — Plan projects with AI (overview header + Tasks / Gantt)
// ---------------------------------------------------------------------------

const GANTT_ROWS = [
  {
    task: "Botany & wildlife surveys",
    start: "9/01",
    due: "12/19",
    status: "✅ Complete",
    offset: 0,
    width: 100,
  },
  {
    task: "GIS boundary delineation",
    start: "9/01",
    due: "2/10",
    status: "🔄 In Progress",
    offset: 0,
    width: 68,
  },
  {
    task: "Public scoping period",
    start: "2/11",
    due: "6/02",
    status: "⭕ Not Started",
    offset: 22,
    width: 40,
  },
  {
    task: "Draft decision memo",
    start: "6/03",
    due: "7/25",
    status: "⏰ Delayed",
    offset: 40,
    width: 30,
  },
];

export function PlanSlide({ reduce }: { reduce: boolean }) {
  return (
    <AppWindow active="overview" contentClassName="bg-egray-50">
      {/* Mirrors the real project page (project-page-header.tsx): the cover
          sits behind the content at z-0 and fades into the page background,
          and the header card (z-10) overlaps its lower half. */}
      <div className="relative isolate h-full overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[140px]">
          <Image
            src="/images/project-header-default-background.png"
            alt=""
            fill
            sizes="(min-width: 1024px) 1100px, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-b from-transparent from-35% to-egray-50" />
        </div>

        <div className="relative z-10 flex flex-col gap-4 px-5 pb-5 pt-10">
          {/* Project header card — glass like the real one, over the cover */}
          <div className="rounded-2xl border-[1.5px] border-white/95 bg-white/85 p-4 shadow-[0_20px_56px_-40px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.95)]">
            <div className="flex items-start gap-4">
              <Reveal index={0} reduce={reduce}>
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-brandAlt-400 font-heading text-[16px] sm:size-14 sm:text-[18px] font-semibold text-white shadow-lg">
                  CT
                </span>
              </Reveal>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Reveal
                  index={1}
                  reduce={reduce}
                  className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2"
                >
                  <span className="flex shrink-0 items-center gap-1 rounded-md bg-neutral-black px-2 py-0.5">
                    <Lock className="size-2.5 text-white" />
                    <span className="font-heading text-[10px] font-medium text-white">
                      Manager view
                    </span>
                  </span>
                  <h2 className="max-w-full font-heading text-[16px] font-semibold leading-[22px] text-neutral-black sm:truncate sm:text-[18px] sm:leading-[24px]">
                    Canyon Three Fuels Reduction
                  </h2>
                </Reveal>
                <Reveal
                  index={2}
                  reduce={reduce}
                  className="flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-inter text-[12px] font-medium text-egray-700">
                      Progress
                    </span>
                    <span className="font-inter text-[12px] text-egray-600">
                      40/180 days
                    </span>
                  </div>
                  <ProgressBar pct={22} reduce={reduce} />
                  <span className="font-inter text-[11.5px] text-egray-600">
                    <span className="font-semibold text-neutral-black">
                      140 days left
                    </span>{" "}
                    · due December 30, 2026
                  </span>
                </Reveal>
              </div>
            </div>
          </div>

          {/* Tasks / Gantt card */}
          <SectionCard
            icon={<ListChecks className="size-4" />}
            title="Tasks"
            subtitle="3 milestones · 7 tasks"
          >
            {/* View tabs — active tab is orange in the real app */}
            <div className="mb-2 flex items-center gap-4 border-b border-egray-100">
              <span className="border-b-2 border-orange-60 pb-2 font-heading text-[12.5px] font-medium text-orange-60">
                Gantt view
              </span>
              <span className="pb-2 font-heading text-[12.5px] font-medium text-egray-500">
                Card view
              </span>
            </div>

            {/* Column headers */}
            <div className="flex items-center gap-3 px-1 pb-1.5">
              <span className="flex-1 font-heading text-[10px] font-medium uppercase tracking-wider text-egray-500">
                Task
              </span>
              <span className="hidden w-12 text-center font-heading text-[10px] font-medium uppercase tracking-wider text-egray-500 sm:block">
                Start
              </span>
              <span className="hidden w-12 text-center font-heading text-[10px] font-medium uppercase tracking-wider text-egray-500 sm:block">
                Due
              </span>
              <span className="w-24 font-heading text-[10px] font-medium uppercase tracking-wider text-egray-500">
                Status
              </span>
              <span className="hidden w-40 font-heading text-[10px] font-medium uppercase tracking-wider text-egray-500 lg:block">
                Timeline
              </span>
            </div>

            {/* Rows */}
            <div className="flex flex-col">
              {GANTT_ROWS.map((row, i) => (
                <Reveal key={row.task} index={i} reduce={reduce}>
                  <div className="flex items-center gap-3 border-t border-egray-100 px-1 py-2">
                    <span className="flex-1 truncate font-inter text-[12.5px] font-medium text-neutral-black">
                      {row.task}
                    </span>
                    <span className="hidden w-12 text-center font-inter text-[11.5px] text-egray-600 sm:block">
                      {row.start}
                    </span>
                    <span className="hidden w-12 text-center font-inter text-[11.5px] text-egray-600 sm:block">
                      {row.due}
                    </span>
                    <span className="w-24 truncate font-inter text-[11.5px] text-egray-700">
                      {row.status}
                    </span>
                    {/* Mini gantt bar */}
                    <span className="relative hidden h-2 w-40 overflow-hidden rounded-full bg-egray-75 lg:block">
                      <span
                        className="showcase-progress-fill absolute top-0 h-full origin-left rounded-full bg-brandAlt-400"
                        style={{
                          left: `${row.offset}%`,
                          width: `${row.width}%`,
                          transform: reduce ? "scaleX(1)" : "scaleX(0)",
                          animation: reduce
                            ? "none"
                            : `showcase-progress 0.9s var(--ease-out-expo) ${0.35 + i * 0.06}s both`,
                        }}
                      />
                    </span>
                  </div>
                </Reveal>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </AppWindow>
  );
}
