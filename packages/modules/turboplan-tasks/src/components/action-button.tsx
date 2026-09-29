import React from "react";

export interface ActionButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
  icon?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  onClick,
  className = "",
  icon = "+",
}) => {
  return (
    <button
      className={`text-md text-brand-800 hover:text-brand-900 ${className}`}
      onClick={onClick}
    >
      {icon} {label}
    </button>
  );
};
