import React from "react";

import { Users } from "lucide-react";

import { generateInitials } from "@wildfires-org/turboplan-utils";

import type { User } from "../types";

interface AssigneeDisplayProps {
  assignees: User[];
  size?: "sm" | "md" | "lg";
  showNames?: boolean;
  className?: string;
  onClick?: () => void;
  onAvatarClick?: (user: User) => void;
}

export const AssigneeDisplay: React.FC<AssigneeDisplayProps> = ({
  assignees,
  size = "sm",
  showNames = false,
  className = "",
  onClick,
  onAvatarClick,
}) => {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  const textSizeClasses = {
    sm: "text-[10px]",
    md: "text-[11px]",
    lg: "text-xs",
  };

  // New logic: if <= 3 show all, if > 3 show 2 + "+N"
  const shouldShowAll = assignees.length <= 3;
  const displayedAssignees = shouldShowAll ? assignees : assignees.slice(0, 2);
  const remainingCount = shouldShowAll ? 0 : assignees.length - 2;

  if (assignees.length === 0) {
    return (
      <div
        className={`flex items-center gap-2 ${className} ${
          onClick ? "cursor-pointer" : ""
        }`}
        onClick={onClick}
      >
        <div
          className={`${sizeClasses[size]} rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400`}
        >
          <Users
            className={`${
              size === "sm" ? "h-3 w-3" : size === "md" ? "h-4 w-4" : "h-5 w-5"
            }`}
          />
        </div>
        {showNames && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Unassigned
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 ${className} ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex -space-x-2">
        {displayedAssignees.map((user, index) => (
          <div
            key={user.id}
            className={`${
              sizeClasses[size]
            } rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center font-medium overflow-hidden hover:z-20 transition-all duration-200 ${
              onAvatarClick || onClick ? "cursor-pointer hover:scale-110" : ""
            }`}
            style={{ zIndex: displayedAssignees.length - index + 10 }} // Left avatar has highest z-index
            title={user.email}
            onClick={(e) => {
              e.stopPropagation();
              if (onAvatarClick) {
                onAvatarClick(user);
              } else if (onClick) {
                onClick();
              }
            }}
          >
            <div
              className={`w-full h-full bg-brand-800 text-white flex items-center justify-center ${textSizeClasses[size]}`}
            >
              {generateInitials({ email: user.email })}
            </div>
          </div>
        ))}

        {remainingCount > 0 && (
          <div
            className={`${
              sizeClasses[size]
            } rounded-full border-2 border-white dark:border-gray-900 bg-gray-300 dark:bg-gray-600 flex items-center justify-center font-medium text-gray-700 dark:text-gray-300 hover:z-20 transition-all duration-200 ${
              textSizeClasses[size]
            } ${onClick ? "cursor-pointer hover:scale-110" : ""}`}
            style={{ zIndex: 9 }} // Lower than all avatars
            title={`${remainingCount} more: ${assignees
              .slice(2)
              .map((u) => u.email)
              .join(", ")}`}
            onClick={(e) => {
              e.stopPropagation();
              if (onClick) {
                onClick();
              }
            }}
          >
            +{remainingCount}
          </div>
        )}
      </div>

      {showNames && (
        <div className="flex flex-col">
          {displayedAssignees.length === 1 ? (
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {displayedAssignees[0].email}
            </span>
          ) : (
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {displayedAssignees.length} assignees
            </span>
          )}
        </div>
      )}
    </div>
  );
};
