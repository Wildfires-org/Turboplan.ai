"use client";

import { useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CircleChevronDown, CircleChevronUp } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";

type StepStatus = "completed" | "active" | "pending";

type Step = {
  label: string;
  status: StepStatus;
  subSteps?: string[];
};

type ProjectSetupBannerProps = {
  isResearchAgentCompleted: boolean;
  hasSavedItems: boolean;
  onCompleteResearch: () => void;
  isCompleting: boolean;
};

const STEP_2_SUB_STEPS = [
  "Review findings in 'Research' panel",
  "Select relevant artifacts",
  "Save to project",
];

const StepDot = ({ status }: { status: StepStatus }) => {
  if (status === "completed") {
    return (
      <div className="flex size-[10px] items-center justify-center">
        <Check className="size-[10px] text-brand-800" strokeWidth={3} />
      </div>
    );
  }

  return (
    <div className="flex size-[10px] items-center justify-center">
      <div
        className={cn(
          "size-2 rounded-full",
          status === "active" ? "bg-brand-700" : "bg-gray-400",
        )}
      />
    </div>
  );
};

export const ProjectSetupBanner = ({
  isResearchAgentCompleted,
  hasSavedItems,
  onCompleteResearch,
  isCompleting,
}: ProjectSetupBannerProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getSteps = (): Step[] => {
    const step1Status: StepStatus = isResearchAgentCompleted
      ? "completed"
      : "active";

    let step2Status: StepStatus = "pending";
    if (isResearchAgentCompleted && hasSavedItems) {
      step2Status = "completed";
    } else if (isResearchAgentCompleted) {
      step2Status = "active";
    }

    let step3Status: StepStatus = "pending";
    if (isResearchAgentCompleted && hasSavedItems) {
      step3Status = "active";
    }

    return [
      { label: "Define project scope", status: step1Status },
      {
        label: "Review & Save Research",
        status: step2Status,
        subSteps: STEP_2_SUB_STEPS,
      },
      { label: "Research complete", status: step3Status },
    ];
  };

  const steps = getSteps();

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex === 2 && steps[2].status === "active") {
      onCompleteResearch();
    }
  };

  const isStepClickable = (stepIndex: number) => {
    if (stepIndex === 2 && steps[2].status === "active") {
      return true;
    }
    return false;
  };

  return (
    <div className="h-[60px] shrink-0 relative z-20">
      <div className="absolute inset-x-0 top-0 px-4 pt-3">
        <div
          className={cn(
            // Glass strip (landing `glass`), mint-tinted like the page ground.
            "glass relative overflow-hidden rounded-2xl bg-brandAlt-100/80",
          )}
        >
          {/* Collapsed header - always visible */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className={cn(
              "flex w-full items-center gap-3 px-[18px] py-[18px]",
              "cursor-pointer select-none",
            )}
          >
            <span className="whitespace-nowrap text-xs font-semibold tracking-[0.12px] text-gray-550">
              Project Setup:
            </span>

            {!isExpanded && (
              <div className="flex items-center flex-1 min-w-0 justify-evenly">
                {steps.map((step, index) => (
                  <div
                    key={step.label}
                    className="flex items-center gap-1.5 min-w-0"
                  >
                    <span className="w-3 shrink-0 text-xs font-medium tracking-wide text-gray-550">
                      {index + 1}.
                    </span>
                    <StepDot status={step.status} />
                    <span
                      className={cn(
                        "text-xs font-medium tracking-wide whitespace-nowrap truncate",
                        step.status === "completed" && "text-brand-800",
                        step.status === "active" && "text-foreground",
                        step.status === "pending" && "text-gray-550",
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {isExpanded && <div className="flex-1" />}

            {isExpanded ? (
              <CircleChevronUp className="size-5 shrink-0 text-gray-550" />
            ) : (
              <CircleChevronDown className="size-5 shrink-0 text-gray-550" />
            )}
          </button>

          {/* Mascot image - visible when expanded */}
          {isExpanded && (
            <Image
              src="/images/project-setup.png"
              alt=""
              width={380}
              height={410}
              className="absolute -right-4 -bottom-4 pointer-events-none select-none"
              priority
            />
          )}

          {/* Expanded content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="px-[18px] pb-[18px]">
                  <div className="flex flex-col gap-3">
                    {steps.map((step, index) => {
                      const clickable = isStepClickable(index);
                      const showSubSteps = !!step.subSteps;
                      const isFirst = index === 0;
                      const isLast = index === steps.length - 1;

                      return (
                        <div key={step.label} className="flex flex-col gap-1.5">
                          {isLast && (
                            <div className="h-px w-[244px] bg-gray-200" />
                          )}

                          <div className="flex gap-2 items-start">
                            <span className="w-3 shrink-0 text-xs font-medium leading-4 tracking-[0.24px] text-gray-550">
                              {index + 1}.
                            </span>
                            <div className="flex flex-col gap-1.5">
                              <div
                                role={clickable ? "button" : undefined}
                                tabIndex={clickable ? 0 : undefined}
                                aria-disabled={
                                  isCompleting && index === 2 ? true : undefined
                                }
                                onClick={() => {
                                  if (
                                    clickable &&
                                    !(isCompleting && index === 2)
                                  ) {
                                    handleStepClick(index);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (
                                    clickable &&
                                    !(isCompleting && index === 2) &&
                                    (e.key === "Enter" || e.key === " ")
                                  ) {
                                    e.preventDefault();
                                    handleStepClick(index);
                                  }
                                }}
                                className={cn(
                                  "flex items-center gap-1.5",
                                  clickable &&
                                    "cursor-pointer hover:bg-white/50 rounded-lg px-1 -mx-1",
                                  isCompleting &&
                                    index === 2 &&
                                    "opacity-50 pointer-events-none",
                                )}
                              >
                                <StepDot status={step.status} />
                                <span
                                  className={cn(
                                    "text-xs font-medium tracking-[0.24px] leading-4",
                                    step.status === "completed" &&
                                      "text-brand-800",
                                    step.status === "active" &&
                                      "text-foreground",
                                    step.status === "pending" &&
                                      "text-gray-550",
                                  )}
                                >
                                  {step.label}
                                </span>
                              </div>

                              {showSubSteps &&
                                step.subSteps?.map((subStep) => (
                                  <div
                                    key={subStep}
                                    className="flex items-center gap-1 pl-1"
                                  >
                                    <div className="w-1.5 h-2.5 shrink-0 border-l border-b border-gray-300 rounded-bl-sm" />
                                    <span className="text-xs leading-4 text-gray-550">
                                      {subStep}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>

                          {isFirst && (
                            <div className="h-px w-[244px] bg-gray-200" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
