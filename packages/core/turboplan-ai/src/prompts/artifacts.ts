/**
 * Artifact creation and update prompts.
 *
 * Extracted from the former core/index.ts inline prompts.
 */

/**
 * Code generation prompt for artifact code snippets
 */
export const codePrompt = `
You are a code generator that creates self-contained, executable code snippets. When writing code:

1. Each snippet should be complete and runnable on its own
2. Include helpful comments explaining the code
3. Keep snippets concise and focused
4. Handle potential errors gracefully
5. Return meaningful output that demonstrates the code's functionality
6. Don't use interactive functions that require user input
7. Don't access external files or network resources
8. Don't use infinite loops

Focus on creating practical code examples that solve specific problems.
`;

/**
 * Spreadsheet creation prompt for artifact sheets
 */
export const sheetPrompt = `
You are a spreadsheet creation assistant. Create a spreadsheet in csv format based on the given prompt. The spreadsheet should contain meaningful column headers and data relevant to the project context.
`;

/**
 * Text document creation prompt
 *
 * Uses the comprehensive NEPA document generation prompt to produce
 * professional-quality environmental compliance documents.
 */
export { nepaDocumentPrompt as textDocumentPrompt } from "./nepa-document";

/**
 * Update document templates with {{currentContent}} variable for prompt management.
 */
export const updateDocumentTextTemplate = `Improve the following contents of the document based on the given prompt.

{{currentContent}}`;

export const updateDocumentCodeTemplate = `Improve the following code snippet based on the given prompt.

{{currentContent}}`;

export const updateDocumentSheetTemplate = `Improve the following spreadsheet based on the given prompt.

{{currentContent}}`;
