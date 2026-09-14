/**
 * Prompts for generating project and office titles.
 * Used on the landing page for quick project setup.
 */

/**
 * System prompt for the title generator.
 * Instructs the AI to output only valid JSON and use real offices.
 */
export const generateTitlesSystemPrompt = `You are a title generator for environmental planning projects. You MUST ONLY output valid JSON in the exact format specified.

CRITICAL RULES:
- For organizationName: ALWAYS select from the provided list. If none fit, return empty string.
- For officeTitle: ONLY use names of REAL government offices that actually exist.
- NEVER create fictional office names. NEVER invent names like "Village Name Department".
- Never include explanations, markdown, or additional text - only the JSON object.`;

/**
 * User prompt template for generating titles.
 * Uses {{description}}, {{organizations}}, and {{offices}} variables.
 */
export const generateTitlesUserPrompt = `Generate titles for this project description: "{{description}}"

AVAILABLE ORGANIZATIONS (select ONLY from this list):
{{organizations}}

OFFICES ALREADY IN OUR DATABASE:
{{offices}}

Requirements:
1. "projectTitle": Create a concise 4-5 word title describing the project.
2. "organizationName": Select the EXACT shortName (e.g., the authority's short code) from the organizations list. If none fit, return "".
3. "officeTitle":
   - FIRST: Check if any office from "OFFICES ALREADY IN OUR DATABASE" matches the project location
   - If YES: Use the EXACT name from our database
   - If NO match in our database: Use your knowledge to suggest a REAL government/authority office that actually exists for that location
   - NEVER invent fictional office names
   - NEVER create variations of existing offices (don't blend two real office names into one that doesn't exist)
   - Example: If the user mentions a small locality, use the matching office already in our database rather than inventing one
   - Example: If the user mentions a location not in our database, suggest a real government/authority office that actually exists for that location

Output ONLY this JSON: {"projectTitle": "...", "organizationName": "...", "officeTitle": "..."}`;
