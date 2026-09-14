export interface GenerateTitlesResponse {
  projectTitle?: string;
  organizationName?: string;
  officeTitle?: string;
  error?: string;
}

export async function generateTitles(
  url: string,
  { arg }: { arg: { description: string } },
): Promise<GenerateTitlesResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ description: arg.description }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to generate titles");
  }

  return await response.json();
}
