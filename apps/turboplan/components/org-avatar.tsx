"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  cn,
  generateInitialsFromName,
} from "@wildfires-org/turboplan-utils";

interface OrgAvatarProps {
  name: string;
  logoUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export function OrgAvatar({
  name,
  logoUrl,
  className,
  fallbackClassName,
}: OrgAvatarProps) {
  return (
    <Avatar data-sidebar-keep="" className={cn("size-8 rounded-sm", className)}>
      {logoUrl && (
        <AvatarImage
          src={logoUrl}
          alt={name}
          className="object-contain rounded-sm bg-white p-0.5"
        />
      )}
      <AvatarFallback
        className={cn(
          "rounded-sm bg-brandAlt-400 text-[10px] font-semibold text-white",
          fallbackClassName,
        )}
      >
        {generateInitialsFromName(name)}
      </AvatarFallback>
    </Avatar>
  );
}
