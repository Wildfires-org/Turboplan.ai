export type McpUserContext = {
  userId: string;
  email: string;
  actor: string;
  patId: string;
  userRole?: string;
};

export type McpToolResult = {
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
};
