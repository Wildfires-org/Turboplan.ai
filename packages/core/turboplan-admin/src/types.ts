export type CatalogerRunStatus =
  | "initializing"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type AdminRole = "super_admin" | "admin";

export type AdminStatusResponse = {
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

export type ModelKey = "primary" | "lite" | "imagePrimary" | "imageLite";

export type ModelValues = {
  defaultValue: string;
  currentValue: string | null;
};
