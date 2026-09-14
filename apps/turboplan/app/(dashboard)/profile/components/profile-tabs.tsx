"use client";

import { type ReactNode, useState } from "react";

import { cn } from "@wildfires-org/turboplan-utils";

type Tab = "profile" | "tokens";

interface ProfileTabsProps {
  profileContent: ReactNode;
  tokensContent: ReactNode;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "tokens", label: "Access Tokens" },
];

export const ProfileTabs = ({
  profileContent,
  tokensContent,
}: ProfileTabsProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  return (
    <div className="flex gap-8">
      <nav className="flex w-48 shrink-0 flex-col gap-1" aria-label="Tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="flex-1 min-w-0">
        {activeTab === "profile" ? profileContent : tokensContent}
      </div>
    </div>
  );
};
