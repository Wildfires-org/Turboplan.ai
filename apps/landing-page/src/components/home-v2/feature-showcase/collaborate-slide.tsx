import {
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  Eye,
  MoreVertical,
  Paperclip,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { AppWindow, SquareAvatar } from "./app-window";
import { Reveal, SectionCard } from "./showcase-ui";

// ---------------------------------------------------------------------------
// Slide 4 — Collaborate with partners (members table + activity timeline)
// ---------------------------------------------------------------------------

const MEMBERS = [
  {
    name: "Dana Whitfield",
    initials: "DW",
    email: "d.whitfield@example.org",
    role: "Owner",
    you: true,
  },
  {
    name: "Tahoe Conservancy",
    initials: "TC",
    email: "team@example.org",
    role: "Editor",
    you: false,
  },
  {
    name: "Cal Fire — Unit 12",
    initials: "CF",
    email: "unit12@example.org",
    role: "Reviewer",
    you: false,
  },
  {
    name: "Deer Creek Tribe",
    initials: "DC",
    email: "office@example.org",
    role: "Viewer",
    you: false,
  },
];

const TIMELINE = [
  {
    time: "July 10, 2026",
    author: "Dana Whitfield",
    initials: "DW",
    title: 'Updated Project "Canyon Three Fuels Reduction"',
    description: "Visibility changed from disabled to enabled",
    attachment: null as string | null,
  },
  {
    time: "July 3, 2026",
    author: "Dana Whitfield",
    initials: "DW",
    title: "Created Document",
    description: "scoping-letter-canyon-three.docx",
    attachment: "scoping-letter-canyon-three.docx",
  },
];

export function CollaborateSlide({ reduce }: { reduce: boolean }) {
  return (
    <AppWindow crumb="Members" active="members" contentClassName="bg-egray-50">
      <div className="grid h-full grid-cols-1 gap-4 overflow-hidden p-4 sm:grid-cols-2">
        {/* Members table */}
        <SectionCard
          icon={<Users className="size-4" />}
          title="Members"
          subtitle="4 members"
        >
          <div className="flex flex-col">
            {/* Column headers */}
            <div className="flex items-center gap-3 border-b border-egray-100 pb-2 font-heading text-[10px] font-medium uppercase tracking-wider text-egray-500">
              <span className="flex-1">User</span>
              <span className="w-16">Role</span>
              <span className="w-10 text-center">Status</span>
            </div>
            {MEMBERS.map((member, i) => (
              <Reveal key={member.name} index={i} reduce={reduce}>
                <div className="flex items-center gap-3 border-b border-egray-100 py-2.5">
                  <SquareAvatar initials={member.initials} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-inter text-[12.5px] font-medium text-neutral-black">
                        {member.name}
                      </span>
                      {member.you && (
                        <span className="shrink-0 rounded-md bg-egray-200 px-1.5 py-0.5 font-heading text-[8px] font-semibold text-neutral-black">
                          You
                        </span>
                      )}
                    </div>
                    <span className="truncate font-inter text-[10.5px] leading-4 text-egray-500">
                      {member.email}
                    </span>
                  </div>
                  <span className="w-16 shrink-0 font-inter text-[12px] text-egray-700">
                    {member.role}
                  </span>
                  <span className="flex w-10 justify-center">
                    <Check className="size-4 text-brand-600" />
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </SectionCard>

        {/* Activity timeline */}
        <SectionCard
          // Phones stack the cards in one column; only Members fits.
          className="hidden sm:flex"
          icon={<Clock className="size-4" />}
          title="Timeline"
          subtitle="5 entries"
          action={
            <span className="font-inter text-[12px] font-semibold text-blue-50">
              + Add
            </span>
          }
        >
          <div className="flex flex-col">
            {TIMELINE.map((entry, i) => {
              const isLast = i === TIMELINE.length - 1;
              return (
                <Reveal key={entry.title + i} index={i + 1} reduce={reduce}>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className="size-6 shrink-0 rounded-full border border-egray-200 bg-egray-50" />
                      <span className="font-inter text-[11px] leading-4 text-egray-500">
                        {entry.time}
                      </span>
                      <span className="size-0.5 rounded-full bg-egray-500" />
                      <span className="flex size-5 items-center justify-center rounded-full bg-egray-75 font-heading text-[9px] font-semibold text-egray-600">
                        {entry.initials}
                      </span>
                      <span className="font-inter text-[11px] font-medium leading-4 text-egray-600">
                        {entry.author}
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <span className="flex w-6 shrink-0 justify-center">
                        <span
                          className={cn(
                            "h-full w-px bg-egray-200",
                            isLast && "opacity-0",
                          )}
                        />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col pb-4 pt-1.5">
                        <div className="relative rounded-lg border border-egray-200 bg-[#F7FAFF] p-3.5">
                          <span className="absolute right-2.5 top-2.5 flex items-center gap-2 text-egray-400">
                            <Eye className="size-3.5" />
                            <MoreVertical className="size-3.5" />
                          </span>
                          <p className="pr-12 font-inter text-[12.5px] font-medium leading-[18px] text-egray-900">
                            {entry.title}
                          </p>
                          <p className="font-inter text-[12.5px] leading-[18px] text-egray-600">
                            {entry.description}
                          </p>
                          {entry.attachment && (
                            <div className="mt-2 flex w-fit items-center gap-1.5 rounded-lg border border-egray-300 px-2 py-1 font-inter text-[11px] leading-4 text-egray-800">
                              <Paperclip className="size-3.5" />
                              <span className="max-w-[150px] truncate">
                                {entry.attachment}
                              </span>
                              <ExternalLink className="size-3 text-egray-500" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
            <Reveal index={3} reduce={reduce}>
              <span className="flex items-center gap-1 pl-9 font-inter text-[11.5px] font-medium text-egray-500">
                <ChevronDown className="size-3.5" />
                Show 3 more
              </span>
            </Reveal>
          </div>
        </SectionCard>
      </div>
    </AppWindow>
  );
}
