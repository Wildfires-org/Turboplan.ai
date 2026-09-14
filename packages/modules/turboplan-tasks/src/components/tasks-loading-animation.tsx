"use client";

import React from "react";

import { Calendar, CheckSquare, Loader2, Target } from "lucide-react";

import { cn } from "@wildfires-org/turboplan-utils";

interface TasksLoadingAnimationProps {
  size?: "sm" | "md" | "lg";
  message?: string;
  showMessage?: boolean;
  showDots?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    spinner: "w-10 h-10",
    icon: "w-4 h-4",
    iconOffset: "-top-1 -left-1",
    iconOffsetRight: "-top-1 -right-1",
    iconOffsetBottom: "-bottom-1",
    dot: "w-1.5 h-1.5",
    text: "text-sm",
  },
  md: {
    spinner: "w-12 h-12",
    icon: "w-5 h-5",
    iconOffset: "-top-1.5 -left-1.5",
    iconOffsetRight: "-top-1.5 -right-1.5",
    iconOffsetBottom: "-bottom-1.5",
    dot: "w-2 h-2",
    text: "text-base",
  },
  lg: {
    spinner: "w-16 h-16",
    icon: "w-6 h-6",
    iconOffset: "-top-2 -left-2",
    iconOffsetRight: "-top-2 -right-2",
    iconOffsetBottom: "-bottom-2",
    dot: "w-2 h-2",
    text: "text-xl",
  },
};

export const TasksLoadingAnimation: React.FC<TasksLoadingAnimationProps> = ({
  size = "md",
  message = "Loading...",
  showMessage = true,
  showDots = true,
  className,
}) => {
  const config = sizeConfig[size];

  return (
    <div className={cn("flex flex-col items-center space-y-4", className)}>
      {/* Animated Icons */}
      <div className="relative">
        <div className={cn("relative", config.spinner)}>
          <Loader2
            className={cn(config.spinner, "text-orange-500 animate-spin")}
          />
        </div>
        <div
          className={cn(
            "absolute text-blue-500 animate-bounce",
            config.icon,
            config.iconOffset,
          )}
          style={{ animationDelay: "0s" }}
        >
          <CheckSquare className={config.icon} />
        </div>
        <div
          className={cn(
            "absolute text-green-500 animate-bounce",
            config.icon,
            config.iconOffsetRight,
          )}
          style={{ animationDelay: "0.2s" }}
        >
          <Target className={config.icon} />
        </div>
        <div
          className={cn(
            "absolute left-1/2 transform -translate-x-1/2 text-purple-500 animate-bounce",
            config.icon,
            config.iconOffsetBottom,
          )}
          style={{ animationDelay: "0.4s" }}
        >
          <Calendar className={config.icon} />
        </div>
      </div>

      {/* Loading Text */}
      {showMessage && (
        <p
          className={cn(
            "font-medium text-zinc-700 dark:text-zinc-300",
            config.text,
          )}
        >
          {message}
        </p>
      )}

      {/* Progress Dots */}
      {showDots && (
        <div className="flex space-x-1.5">
          {[0, 0.2, 0.4, 0.6].map((delay, i) => (
            <div
              key={i}
              className={cn(
                "bg-orange-500 rounded-full animate-pulse",
                config.dot,
              )}
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
