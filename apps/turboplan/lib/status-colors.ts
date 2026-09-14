export function getStatusColor(status: string) {
  switch (status) {
    case "active":
      return "text-green-600 bg-green-50 ring-green-500/10 dark:text-green-400 dark:bg-green-400/10 dark:ring-green-400/20";
    case "completed":
      return "text-blue-600 bg-blue-50 ring-blue-500/10 dark:text-blue-400 dark:bg-blue-400/10 dark:ring-blue-400/20";
    case "archived":
      return "text-gray-600 bg-gray-50 ring-gray-500/10 dark:text-gray-400 dark:bg-gray-400/10 dark:ring-gray-400/20";
    default:
      return "text-gray-600 bg-gray-50 ring-gray-500/10 dark:text-gray-400 dark:bg-gray-400/10 dark:ring-gray-400/20";
  }
}
