"use client";

import { useMemo } from "react";

import { BookText, Building2, FileSignature, FolderOpen } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { isSigningPackageEnabled } from "@wildfires-org/turboplan-feature-flags";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useIsCitizen } from "@/hooks/use-citizen-mode";
import { AppUrls } from "@/lib/nav/urls";

export function SidebarBottomNav() {
  const params = useParams<{
    orgSlug?: string;
    officeSlug?: string;
  }>();

  const { orgSlug, officeSlug } = params;
  const isCitizen = useIsCitizen();

  const bottomNavItems = useMemo(
    () =>
      orgSlug && officeSlug
        ? isCitizen
          ? [
              {
                label: "Templates",
                icon: BookText,
                href: AppUrls.officeProjectTemplates(orgSlug, officeSlug),
              },
            ]
          : [
              {
                label: "Offices",
                icon: Building2,
                href: AppUrls.organization(orgSlug),
              },
              {
                label: "Templates",
                icon: BookText,
                href: AppUrls.officeProjectTemplates(orgSlug, officeSlug),
              },
              {
                label: "All Projects",
                icon: FolderOpen,
                href: AppUrls.office(orgSlug, officeSlug),
              },
              ...(isSigningPackageEnabled()
                ? [
                    {
                      label: "My Signatures",
                      icon: FileSignature,
                      href: AppUrls.organizationSigning(orgSlug),
                    },
                  ]
                : []),
            ]
        : [],
    [orgSlug, officeSlug, isCitizen],
  );

  if (bottomNavItems.length === 0) return null;

  return (
    <SidebarGroup className="border-t border-brandAlt-100 bg-white py-3">
      <SidebarGroupContent>
        <SidebarMenu>
          {bottomNavItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                tooltip={item.label}
                className="h-11 p-3"
                asChild
              >
                <Link href={item.href}>
                  <item.icon className="size-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
