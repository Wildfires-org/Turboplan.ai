"use client";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";

type AdminUserProfile = {
  adminUser: {
    id: string;
    userId: string;
    createdAt: string;
    createdBy: string | null;
  };
  user: {
    id: string;
    email: string;
  };
  profile: {
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  } | null;
};

type AdminUsersResponse = {
  adminUsers: AdminUserProfile[];
};

const adminUsersFetcher = async (url: string): Promise<AdminUserProfile[]> => {
  const response = await fetcher<AdminUsersResponse>(url);
  return response.adminUsers;
};

export function useAdminUsers() {
  const {
    data: adminUsers,
    error,
    isLoading,
    mutate,
  } = useSWR<AdminUserProfile[]>("/api/admin/admin-users", adminUsersFetcher, {
    revalidateOnFocus: false,
  });

  return {
    adminUsers: adminUsers || [],
    isLoading,
    error: error?.message || null,
    refreshAdminUsers: mutate,
  };
}

export type { AdminUserProfile };
