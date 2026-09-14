const MISSING_AREA_LABELS: Record<string, string> = {
  description: "project description",
  location: "location",
  existing_conditions: "site conditions",
  desired_conditions: "desired outcomes",
};

export const formatMissingDetails = (missing?: string[]): string => {
  if (!missing || missing.length === 0) {
    return "Your prompt was missing key details required to initialize a project.";
  }
  const labels = missing.map((m) => MISSING_AREA_LABELS[m] || m);
  return `Your prompt was missing ${labels.join(", ")}. These details are required to initialize a project.`;
};
