"use client";

import {
  AddAdminUserForm,
  AdminUsersList,
  useAdminUsers,
} from "@wildfires-org/turboplan-admin/client";

import { useAdminContext } from "../../admin-context";

export function AdminUsersManager() {
  const { isSuperAdmin } = useAdminContext();
  const { adminUsers, isLoading, refreshAdminUsers } = useAdminUsers();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-medium">Add admin user</h2>
        <AddAdminUserForm onAdded={() => refreshAdminUsers()} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">
          Current admins ({adminUsers.length})
        </h2>
        <AdminUsersList
          adminUsers={adminUsers}
          isLoading={isLoading}
          isSuperAdmin={isSuperAdmin}
          onRemoved={() => refreshAdminUsers()}
        />
      </div>
    </div>
  );
}
