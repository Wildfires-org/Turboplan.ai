"use client";

import { type ReactNode, useState } from "react";

import { KeyRound, Palette, UserRound } from "lucide-react";

import {
  SEGMENT_ACTIVE_CLASS,
  SEGMENT_CLASS,
  SEGMENT_INACTIVE_CLASS,
  SEGMENTED_TRACK_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";

type Tab = "profile" | "tokens" | "appearance";

interface ProfileTabsProps {
  profileContent: ReactNode;
  tokensContent: ReactNode;
  appearanceContent: ReactNode;
}

const PROFILE_TABS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "tokens", label: "Access Tokens", icon: KeyRound },
  { id: "appearance", label: "Appearance", icon: Palette },
] as const satisfies ReadonlyArray<{
  id: Tab;
  label: string;
  icon: typeof UserRound;
}>;

export const ProfileTabs = ({
  profileContent,
  tokensContent,
  appearanceContent,
}: ProfileTabsProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  const contentByTab: Record<Tab, ReactNode> = {
    profile: profileContent,
    tokens: tokensContent,
    appearance: appearanceContent,
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Profile sections"
        className={SEGMENTED_TRACK_CLASS}
      >
        {PROFILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`profile-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="profile-tab-panel"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                SEGMENT_CLASS,
                isActive ? SEGMENT_ACTIVE_CLASS : SEGMENT_INACTIVE_CLASS,
              )}
            >
              <Icon aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        id="profile-tab-panel"
        role="tabpanel"
        aria-labelledby={`profile-tab-${activeTab}`}
        className="min-w-0"
      >
        {contentByTab[activeTab]}
      </div>
    </div>
  );
};
