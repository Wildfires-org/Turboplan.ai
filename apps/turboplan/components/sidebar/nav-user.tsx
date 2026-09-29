"use client";

import { useMemo } from "react";

import { BadgeCheck, ChevronsUpDown, LogOut, ShieldCheck } from "lucide-react";
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  generateDisplayName,
  generateInitials,
} from "@wildfires-org/turboplan-utils";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useLogout } from "@/hooks/use-logout";

interface NavUserProps {
  user: User;
  profile?: Profile | null;
}

export function NavUser({ user, profile }: NavUserProps) {
  const { isMobile } = useSidebar();
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
      email: user.name || user.email,
    });
  }, [profile?.firstName, profile?.lastName, user.name, user.email]);

  return (
    <SidebarMenu className="py-1">
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="h-11 p-[6px] !transition-none data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
            >
              <Avatar
                data-sidebar-keep=""
                className="size-8 rounded-lg shrink-0"
              >
                <AvatarImage
                  src={profile?.avatarUrl || ""}
                  alt={displayName || undefined}
                />
                <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg">
                  <AvatarImage
                    src={profile?.avatarUrl || ""}
                    alt={displayName || undefined}
                  />
                  <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <BadgeCheck />
                  Profile Settings
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <ShieldCheck />
                      Admin Panel
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()}>
              <LogOut />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
