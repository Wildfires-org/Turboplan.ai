import React from "react";

interface TabButtonProps {
  isActive: boolean;
  label: string;
  onClick: () => void;
  className?: string;
}

export const TabButton: React.FC<TabButtonProps> = ({
  isActive,
  label,
  onClick,
  className = "",
}) => {
  return (
    <button
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "text-blue-600 border-b-2 border-blue-600"
          : "text-gray-600 hover:text-gray-900"
      } ${className}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
};
