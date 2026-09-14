"use client";

import { FolderInput, FolderKanban, Users } from "lucide-react";

import { TabNav } from "@/components/dashboard/tab-nav";
import { useIsCitizen } from "@/hooks/use-citizen-mode";
import { AppUrls } from "@/lib/nav/urls";

type OfficeTabNavProps = {
  orgSlug: string;
  officeSlug: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
};

export function OfficeTabNav({
  orgSlug,
  officeSlug,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
}: OfficeTabNavProps) {
  const isCitizen = useIsCitizen();

  const tabs = [
    {
      key: "projects",
      label: "Projects",
      icon: FolderKanban,
      href: AppUrls.office(orgSlug, officeSlug),
    },
    {
      key: "members",
      label: "Members",
      icon: Users,
      href: AppUrls.officeMembers(orgSlug, officeSlug),
    },
    ...(!isCitizen
      ? [
          {
            key: "citizen-submissions",
            label: "Citizen Submissions",
            icon: FolderInput,
            href: AppUrls.officeCitizenSubmissions(orgSlug, officeSlug),
          },
        ]
      : [
          {
            key: "my-submissions",
            label: "My Submissions",
            icon: FolderInput,
            href: AppUrls.officeMySubmissions(orgSlug, officeSlug),
          },
        ]),
  ];

  return (
    <TabNav
      tabs={tabs}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
    />
  );
}
