"use client";

import { useState } from "react";

import { ChevronDown, LayoutDashboard, LogOut, User } from "lucide-react";
import Link from "next/link";

import type { Session } from "@wildfires-org/turboplan-auth/types";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  generateInitials,
} from "@wildfires-org/turboplan-utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { routing } from "@/utils/routing";

interface UserAvatarDropdownProps {
  session: NonNullable<Session>;
}

export function UserAvatarDropdown({ session }: UserAvatarDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const initials = generateInitials(
    {
      firstName: session.profile?.firstName,
      lastName: session.profile?.lastName,
      email: session.user.email,
    },
    "U",
  );

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-10 items-center gap-1.5 rounded-full border border-neutral-200 bg-white py-0 p-1.5 focus:outline-hidden"
          aria-label="User menu"
        >
          {/* Avatar with initials */}
          <Avatar className="size-[30px]">
            <AvatarImage
              src={session.profile?.avatarUrl ?? undefined}
              alt={session.user.email ?? "User avatar"}
            />
            <AvatarFallback className="bg-yellow-400 text-sm font-medium text-neutral-800">
              {initials}
            </AvatarFallback>
          </Avatar>
          {/* Chevron indicator */}
          <ChevronDown
            className={cn("size-5 text-neutral-600", isOpen && "rotate-180")}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" sideOffset={8}>
        <DropdownMenuItem asChild>
          <Link
            href={routing.dashboard()}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 px-3 py-2",
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={routing.profile()}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 px-3 py-2",
            )}
          >
            <User className="h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={routing.signOut()}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 px-3 py-2",
            )}
          >
            <LogOut className="h-4 w-4" />
            <span>Log Out</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
