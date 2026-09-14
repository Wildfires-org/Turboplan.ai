import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

type PrivacyBadgeProps = {
  isPublic: boolean;
  className?: string;
};

const privacyConfig = {
  public: {
    label: "Public",
    icon: Eye,
  },
  private: {
    label: "Private",
    icon: EyeOff,
  },
};

export function PrivacyBadge({ isPublic, className }: PrivacyBadgeProps) {
  const config = isPublic ? privacyConfig.public : privacyConfig.private;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded border border-gray-100 bg-gray-50 px-1.5 py-0.5 text-gray-500",
        className,
      )}
    >
      <Icon className="size-3.5" />
      <span className="text-[10px] font-semibold leading-4">
        {config.label}
      </span>
    </div>
  );
}
