"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useUserOrganizations } from "@/hooks/use-organization";
import { AppUrls } from "@/lib/nav/urls";
import { OrgAvatar } from "../org-avatar";

export function SidebarOrgContent() {
  const { organizations, isLoading } = useUserOrganizations();
  const params = useParams<{ orgSlug?: string; officeSlug?: string }>();

  return (
    <>
      {/* Back to projects */}
      {params.orgSlug && params.officeSlug && (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Back to Projects"
                  className="h-11"
                  asChild
                >
                  <Link
                    href={AppUrls.office(params.orgSlug, params.officeSlug)}
                  >
                    <ArrowLeft className="size-4" />
                    <span>Back to Projects</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {/* Organizations list */}
      <SidebarGroup>
        <SidebarGroupLabel>Organizations</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {isLoading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuButton className="h-11">
                      <div className="size-5 shrink-0 animate-pulse rounded-sm bg-muted" />
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </>
            ) : (
              organizations.map((org) => (
                <SidebarMenuItem key={org.id}>
                  <SidebarMenuButton
                    tooltip={org.name}
                    asChild
                    className="h-11"
                  >
                    <Link href={AppUrls.organization(org.slug)}>
                      <OrgAvatar
                        name={org.name}
                        logoUrl={org.logoUrl}
                        className="size-5"
                      />
                      <span className="truncate">{org.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
