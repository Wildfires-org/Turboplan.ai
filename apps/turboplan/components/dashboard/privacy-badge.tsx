import { Eye, EyeOff } from "lucide-react";

import { CHIP_BASE_CLASS, CHIP_TONE_CLASS } from "@/lib/glass";
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
    <span className={cn(CHIP_BASE_CLASS, CHIP_TONE_CLASS.neutral, className)}>
      <Icon aria-hidden />
      {config.label}
    </span>
  );
}
