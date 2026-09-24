"use client";

import { useState } from "react";

import { cva } from "class-variance-authority";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  FileText,
  Flag,
  Layers,
  Save,
  Tag,
} from "lucide-react";

import { Button } from "@wildfires-org/turboplan-utils";

import {
  type ProgressMessageData,
  type ResearchAgentMessage,
  ResearchAgentMessageType,
  type ResearchAgentStatus,
} from "../../../types";
import { useElapsedTime } from "../../hooks/use-elapsed-time";
import { AvatarThinking } from "../avatar-thinking";
import { StartResearchButton } from "../start-research-button";

type EmptyStateProps = {
  isLoading?: boolean;
  isAgentRunning?: boolean;
  status?: ResearchAgentStatus;
  progressMessages?: ResearchAgentMessage[];
  /** Project the panel belongs to — enables the on-demand start/retry action. */
  projectId?: string;
  /** Whether the current user can trigger research (UPDATE permission). */
  canEdit?: boolean;
};

const MOCK_FIELDS = [
  { label: "Framework", value: "National Environmental Policy Act" },
  { label: "Review Type", value: "Categorical Exclusion (CE)" },
  {
    label: "CE Category",
    value: "43 CFR 46.210 - Road Maintenance and Repair",
  },
  {
    label: "Legal Authority",
    value: "NPS NEPA Handbook, 516 DM 6 (Departmental Manual), 43 CFR Part 46",
  },
  {
    label: "Framework",
    value: "NAAQS - National Ambient Air Quality Standards",
  },
  { label: "Review Type", value: "Environmental Assessment (EA)" },
  { label: "CE Category", value: "40 CFR Part 1501 - General Procedures" },
  { label: "Legal Authority", value: "NEPA, 42 U.S.C. § 4321 et seq." },
  { label: "Framework", value: "CWA - Clean Water Act" },
  { label: "Review Type", value: "Individual Permit (IP)" },
];

const MOCK_MILESTONES = [
  { title: "NEPA Scoring Phase", date: "2026-03-15 - 2026-04-30", tasks: 3 },
  {
    title: "Categorical Exclusion Preparation",
    date: "2026-05-01 - 2026-06-15",
    tasks: 3,
  },
  {
    title: "Decision and Implementation Phase",
    date: "2026-06-16 - 2027-06-30",
    tasks: 4,
  },
];

const mockSectionVariants = cva("rounded-xl border p-5", {
  variants: {
    tone: {
      purple:
        "bg-gradient-to-br from-purple-50/80 to-violet-50/60 dark:from-purple-950/20 dark:to-violet-950/20 border-purple-100 dark:border-purple-800/30",
      blue: "bg-gradient-to-br from-blue-50/80 to-indigo-50/60 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100 dark:border-blue-800/30",
    },
  },
});

const mockSectionDividerVariants = cva("divide-y", {
  variants: {
    tone: {
      purple: "divide-purple-100 dark:divide-purple-800/30",
      blue: "divide-blue-100 dark:divide-blue-800/30",
    },
  },
});

const mockSaveButtonVariants = cva("gap-1.5", {
  variants: {
    tone: {
      purple: "border-purple-200 dark:border-purple-700",
      blue: "border-blue-200 dark:border-blue-700",
    },
  },
});

function MockFieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="size-4 rounded border border-purple-200 dark:border-purple-700 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm text-muted-foreground ml-2">{value}</span>
      </div>
    </div>
  );
}

function MockMilestoneRow({
  title,
  date,
  tasks,
}: {
  title: string;
  date: string;
  tasks: number;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="pt-0.5">
        <div className="size-4 rounded border border-blue-200 dark:border-blue-700 shrink-0" />
      </div>
      <div className="flex items-start justify-between gap-2 min-w-0 flex-1">
        <div className="min-w-0">
          <span className="text-sm font-semibold block">{title}</span>
          <span className="text-xs text-muted-foreground block mt-0.5">
            {date}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {tasks} task{tasks > 1 ? "s" : ""}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

function AgentRunningState({
  status,
  progressMessages = [],
}: {
  status?: ResearchAgentStatus;
  progressMessages: ResearchAgentMessage[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isActive = status?.hasActiveRun ?? false;
  const currentStep = status?.currentStep || "Processing...";

  const elapsedTime = useElapsedTime(
    status?.createdAt,
    status?.updatedAt,
    isActive,
  );

  return (
    <div className="relative flex items-center justify-center h-full overflow-hidden">
      {/* Soft elliptical gradient glow */}
      <div className="absolute pointer-events-none w-[562px] h-[284px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 blur-[40px] bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.06)_0%,rgba(99,102,241,0.03)_40%,transparent_70%)]" />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative flex flex-col items-center gap-5 w-[384px] text-center px-4"
      >
        <AvatarThinking state="thinking" className="size-20" />

        <div className="flex flex-col items-center gap-3">
          <Button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            variant="glass"
            size="xs"
            className="rounded-full"
          >
            <FileText className="size-3 shrink-0 text-gray-550" />
            <span className="max-w-[190px] truncate text-xs text-foreground">
              {currentStep}
            </span>
            {elapsedTime && (
              <span className="text-xs font-medium tabular-nums text-gray-550">
                {elapsedTime}
              </span>
            )}
            {isExpanded ? (
              <ArrowDownLeft className="size-3.5 shrink-0 text-purple-600" />
            ) : (
              <ArrowUpRight className="size-3.5 shrink-0 text-purple-600" />
            )}
          </Button>

          <AnimatePresence>
            {isExpanded && progressMessages.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  duration: 0.2,
                  ease: [0.455, 0.03, 0.515, 0.955],
                }}
                className="overflow-hidden"
              >
                <div className="flex flex-col">
                  {progressMessages.map((msg) => {
                    if (msg.type !== ResearchAgentMessageType.PROGRESS) {
                      return null;
                    }
                    const data = msg.data as ProgressMessageData;
                    return (
                      <span
                        key={msg.id}
                        className="text-xs leading-5 text-gray-550"
                      >
                        &lsaquo; {data.step}
                      </span>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="w-[290px] text-xs leading-5 text-gray-550">
            The Research Agent is currently scanning databases to find relevant
            details, citations, frameworks, and historical precedents. Your
            artifacts will populate here shortly.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export function EmptyState({
  isLoading,
  isAgentRunning,
  status,
  progressMessages = [],
  projectId,
  canEdit,
}: EmptyStateProps) {
  if (isAgentRunning) {
    return (
      <AgentRunningState status={status} progressMessages={progressMessages} />
    );
  }

  if (isLoading) {
    return null;
  }

  return (
    <div className="relative h-full">
      {/* Faded mock content background */}
      <div className="opacity-30 blur-[4px] pointer-events-none select-none space-y-6">
        {/* Mock Fields Section */}
        <div className={mockSectionVariants({ tone: "purple" })}>
          <div className="flex items-center gap-2 mb-4">
            <Tag className="size-4 text-purple-600 dark:text-purple-400" />
            <h3 className="text-sm font-bold text-purple-700 dark:text-purple-300">
              Project Fields
            </h3>
          </div>
          <div className={mockSectionDividerVariants({ tone: "purple" })}>
            {MOCK_FIELDS.map((field, i) => (
              <MockFieldRow key={i} label={field.label} value={field.value} />
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className={mockSaveButtonVariants({ tone: "purple" })}
              disabled
            >
              <Save className="size-3.5" />
              Save to project
              <span className="inline-flex items-center justify-center size-5 rounded-full bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 text-xs font-medium">
                0
              </span>
            </Button>
          </div>
        </div>

        {/* Mock Milestones Section */}
        <div className={mockSectionVariants({ tone: "blue" })}>
          <div className="flex items-center gap-2 mb-4">
            <Flag className="size-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300">
              Suggested Milestones
            </h3>
          </div>
          <div className={mockSectionDividerVariants({ tone: "blue" })}>
            {MOCK_MILESTONES.map((ms, i) => (
              <MockMilestoneRow
                key={i}
                title={ms.title}
                date={ms.date}
                tasks={ms.tasks}
              />
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className={mockSaveButtonVariants({ tone: "blue" })}
              disabled
            >
              <Save className="size-3.5" />
              Save to project
              <span className="inline-flex items-center justify-center size-5 rounded-full bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 text-xs font-medium">
                0
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Blur layer with radial gradient mask for smooth fade */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{
          maskImage:
            "radial-gradient(ellipse 70% 50% at 50% 50%, black 20%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 50% at 50% 50%, black 20%, transparent 100%)",
        }}
      />

      {/* Text content on top */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="px-8 py-6 max-w-xs text-center">
          <span className="glass mx-auto mb-3 flex size-10 items-center justify-center rounded-2xl text-brand-800">
            <Layers aria-hidden className="size-5" />
          </span>
          <h3 className="mb-1.5 text-[15px] font-medium leading-6 tracking-[-0.01em] text-foreground">
            Project Artifacts
          </h3>
          <p className="text-[13px] leading-5 text-gray-550">
            There are no artifacts yet. Start the Research Agent to extract key
            details, compliance citations, and milestones, and organize them
            here for your review.
          </p>
          {projectId && (
            <div className="mt-4 flex justify-center">
              <StartResearchButton
                projectId={projectId}
                canEdit={canEdit ?? false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
