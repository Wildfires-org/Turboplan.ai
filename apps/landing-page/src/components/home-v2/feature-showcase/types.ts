export type SlideType = "research" | "draft" | "plan" | "collab";

export type ModuleKey =
  | "overview"
  | "chat"
  | "map"
  | "tasks"
  | "timeline"
  | "comments"
  | "documents"
  | "members";

export type Tab = {
  label: string;
  description: string;
  type: SlideType;
};
