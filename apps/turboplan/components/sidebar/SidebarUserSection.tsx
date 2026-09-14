"use client";

import { useMemo } from "react";

import { ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import type { User } from "next-auth";

import { useAdminStatus } from "@wildfires-org/turboplan-admin/client";
import type { Profile } from "@wildfires-org/turboplan-db/types";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  generateDisplayName,
  generateInitials,
} from "@wildfires-org/turboplan-utils";

import { useLogout } from "@/hooks/use-logout";

interface SidebarUserSectionProps {
  user: User;
  profile?: Profile | null;
  onLinkClick?: () => void;
}

/**
 * Reusable user profile section
 * Displays user avatar, name, and email with dropdown menu
 */
export function SidebarUserSection({
  user,
  profile,
  onLinkClick,
}: SidebarUserSectionProps) {
  const { logout } = useLogout();
  const { isAdmin } = useAdminStatus();

  const initials = useMemo(() => {
    return generateInitials({
      firstName: profile?.firstName,
      lastName: profile?.lastName,
      email: user.email,
    });
  }, [profile?.firstName, profile?.lastName, user.email]);

  const displayName = useMemo(() => {
    return generateDisplayName({
      firstName: profile?.firstName,
      lastName: profile?.lastName,
      email: user.email,
    });
  }, [profile?.firstName, profile?.lastName, user.email]);

  const handleLogoutClick = () => {
    logout();
    onLinkClick?.();
  };

  return (
    <div className="mt-2">
      <DropdownMenu>
        <DropdownMenuTrigger className="w-full outline-none">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background border border-sidebar-border hover:bg-sidebar-accent transition-colors">
            <Avatar className="size-10">
              <AvatarImage
                src={profile?.avatarUrl || ""}
                alt={displayName || undefined}
              />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium truncate">{displayName}</div>
              {profile?.firstName || profile?.lastName ? (
                <div className="text-xs text-muted-foreground truncate">
                  {user.email || ""}
                </div>
              ) : null}
            </div>
            <ChevronsUpDown className="size-4 text-muted-foreground shrink-0" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {isAdmin && (
            <>
              <DropdownMenuItem asChild>
                <Link href="/admin" onClick={onLinkClick}>
                  Admin panel
                </Link>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem asChild>
            <Link href="/profile" onClick={onLinkClick}>
              Profile Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogoutClick}>
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
