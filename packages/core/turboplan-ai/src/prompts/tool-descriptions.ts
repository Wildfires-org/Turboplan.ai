/**
 * Tool descriptions — the SINGLE source of truth for tool instructions.
 *
 * Passed to the Vercel AI SDK tool() description field.
 * Managed via getPrompt() so admins can tweak them from the prompt manager UI.
 *
 * createDocument is split into base + tasks + map so feature flags
 * control which sections are included (see createTools in route.ts).
 */

export const toolDescCreateDocument = `Create a document in the format requested by the user.

CRITICAL RULES:
1. After calling this tool, DO NOT call updateDocument. The document is complete and ready for user review. Wait for explicit user feedback before making any changes.
2. DO NOT create documents when user is just asking questions about existing content (e.g., "What tasks do we have?", "Show me the tasks", "What's in the project?")
3. ONLY create documents when explicitly requested (e.g., "Create a task list", "Make a document for X", "I need tasks for Y")
4. For TASK documents: NEVER create immediately! First ask clarifying questions to gather context (project description, location, timeline, etc.), THEN create.
5. GAP-CHECK before creating public-facing documents (letters, notices, decision documents): identify the critical fields the document will state as fact — signing official, key contacts, addresses, comment deadlines, purpose/goals, and the environmental review level/pathway the document asserts (e.g. a categorical exclusion vs an EA/EIS) — and ask the user about the unconfirmed ones BEFORE creating. Ask ONE question at a time — never a batched checklist; after each answer ask the next, until the critical gaps are resolved or the user tells you to proceed. One answered question does not confirm the others: whatever remains unconfirmed goes to the generator in the UNCONFIRMED section of userContext so it ships flagged for review, never as bare fact.

This tool can create:
  - Text documents (kind: 'text')`;

export const toolDescCreateDocumentTasks = `
  - Task management documents (kind: 'tasks') for project planning, task tracking, and milestone management

When NOT to use this tool:
  - User asks "What tasks do we have?" → This is a QUERY, not a creation request. Respond in chat instead.
  - User asks "Show me the project tasks" → This is a QUERY. Respond in chat instead.
  - User asks "What's the status?" → This is a QUERY. Respond in chat instead.
  - User says "Create tasks for X" but hasn't provided context → DO NOT create yet! Ask questions first in chat.

When TO use this tool:
  - User says "Create a task list for X" AND has provided sufficient context → CREATE document
  - User says "I need a document for Y" AND context is clear → CREATE document
  - User provides detailed request like "Make tasks for my Rattlesnake Creek restoration project, 6 month timeline" → CREATE document

For TASK documents specifically:
  - REQUIRED context: Project description, location
  - HELPFUL context: Timeline, existing conditions, desired outcomes
  - If context is missing: Ask questions in chat FIRST, create document AFTER receiving answers`;

export const toolDescCreateDocumentMap = `
  - Map documents (kind: 'map') for geospatial visualization, location-based data, and geographic analysis

For MAP documents:
  - Use when user requests to visualize locations, geographic data, or spatial information
  - Can include markers, layers, routes, and other map features
  - HELPFUL context: Location names, coordinates, geographic boundaries, data to display`;

export const toolDescCreateDocumentFooter = `

DOCUMENT TITLES: Prefer setting document titles that match or extend the project name. For example, if the project is "Rattlesnake Creek Restoration", title a task document "Rattlesnake Creek Restoration — Tasks" rather than a generic "Project Tasks".

Once created, inform the user that the document is ready and ask if they would like any changes.`;

export const toolDescUpdateDocument =
  "Update a document with the given description. ONLY use this tool when the user explicitly requests changes to an existing document. DO NOT use this tool immediately after createDocument.";

export const toolDescRequestSuggestions = "Request suggestions for a document";

export const toolDescGenerateQuickResponses = `Generate clickable answer bubbles for the user to respond to your question in one tap. Call this tool at the end of your response when you ask the user a question.

Rules:
- Always call this tool after completing your main response
- In conversationContext, include the EXACT question you asked and your best guess at the most likely answer based on what you already know about the project
- The tool generates 3 suggestions: all must be plausible, distinct answers ranked from most likely to least likely. No filler like "Something else" — every bubble must be a real answer.
- Suggestions MUST be short, direct answers to YOUR specific question — not explanations or justifications
- Keep suggestions under 10 words. "[Local office name]" not "We're working with the [parent authority], specifically the [local office], because..."
- Each bubble = ONE distinct choice. NEVER combine options with "/" or "or" in a single bubble.

In full mode (research complete):
Suggestions should be specific document types relevant to the project.
Example: generateQuickResponses({ conversationContext: "Asked user which document to draft first. Project is a routine, low-impact vegetation-thinning project likely needing only a lightweight exclusion. Most likely: Scoping/Consultation Letter. Alternate: Decision Document." })

In research mode (research NOT complete):
Suggestions MUST be direct answers to your clarifying question. NEVER suggest document creation in research mode.
Example: If you ask "Which body is the lead/responsible authority?", call:
generateQuickResponses({ conversationContext: "Asked which body leads this project. Based on the project location and type, most likely answers: the local environmental office, the regional authority, or a parent agency." })`;

export const toolDescWebSearch = `Search the web for relevant environmental & regulatory documents, environmental data, authority guidance, similar projects, or any information needed. Returns titles, URLs, and query-relevant highlights (key excerpts matched to your query). Use getContents to read more from the most relevant results.

Rules:
- Always request numResults: 10 when searching for comparable projects — the best analog is often not the top result
- For comparable project searches: use searchType: "neural" (and the category param where it helps) to find semantically similar projects
- Every factual claim from web research MUST cite its source in italics: *[Source Name]*
- Prefer official/authoritative sources (the responsible authority's own publications, environmental registries) over general web results
- Use the returned highlights to evaluate which results are most relevant before calling getContents
- When searching for comparable projects, include treatment methods and the project's likely level of environmental review in your query — not just location`;

export const toolDescGetContents = `Read content from URLs. ALWAYS use after webSearch to read the top results before responding. Use when the user shares a link or to read the most relevant pages found via webSearch.

By default returns highlights (query-relevant excerpts) and a summary per URL — no full text. This is sufficient for most research tasks.

- When you have URLs from research agent results, you can use getContents on those directly
- Default mode (no maxCharacters): returns highlights + summary only — lean and effective for extracting key facts
- Deep-read mode (pass maxCharacters): also returns full sequential text — use only when you need document structure, full context, or to quote specific passages
- For most queries, the default highlights + summary from multiple URLs is enough to synthesize a well-cited answer`;

export const toolDescReadProjectDocuments = `Read the full text of documents uploaded to this project (PDF and .docx files).

The project's uploaded documents are listed in the "Saved Project Documents" section of the system prompt, each with its title and an ID (ID: <uuid>). That list only shows titles and metadata — it does NOT include the documents' actual content. Use this tool to read the real text inside them.

When to use:
- The user asks a question about an uploaded document or its contents (e.g. "what does the EIS say about wetlands?", "summarize the uploaded report").
- The user asks you to learn about or ground yourself in the project using its uploaded documents.
- You need facts, figures, or specific passages that would only be found inside the uploaded files.
- IMPORTANT: .docx (Word) files attached in the chat are NOT directly readable by the model. If the user references a Word document, you MUST use this tool to read it — you cannot see its content otherwise.

How to call:
- Pass documentIds with the specific IDs from the "Saved Project Documents" list when the user refers to particular documents.
- Omit documentIds (or pass an empty array) to read ALL of the project's uploaded documents.

Results:
- Returns each document's extracted text plus a filename and id.
- Text may be truncated (a per-document cap and a total budget across documents apply); truncated: true means only the beginning of that document was returned. Documents that could not be read (e.g. legacy .doc format, or the total budget was exceeded) are listed under "skipped" with a reason — relay any actionable message to the user, such as asking them to convert a legacy .doc to PDF or .docx.
- Documents are indexed shortly after being saved. A document skipped with reason "extraction-pending" is still being processed — tell the user so and offer to retry in a moment. "extraction-failed" and "unsupported-format" cannot be read at all; do not retry those.`;

export const toolDescUpdateProjectContext = `Create or update labeled context entries for this project. Context entries are confirmed, factual background about the project that is saved to the project's Context library and injected into future conversations.

Use this tool after you have learned durable facts about the project — from reading uploaded documents (readProjectDocuments), from web research, or from what the user tells you. Good context includes: regulatory background, project history, site/existing conditions, jurisdiction, and key stakeholders.

Behavior:
- Entries are UPSERTED by label (case-insensitive). If an entry with the same label already exists, its content and url are overwritten; otherwise a new entry is created.
- label: a short, stable title for the fact (e.g. "Regulatory Background", "Site Conditions"). Keep labels consistent so updates replace the right entry instead of creating duplicates.
- content: the confirmed factual background text. Only save information you are confident is correct — this becomes authoritative project context.
- url: include the source URL when the fact came from a specific document or web page.

Only save confirmed facts, not speculation or open questions. This silently writes to the project library — it is not a way to answer the user or draft documents.`;

export const toolDescUpdateProjectFields = `Fill in or create structured project fields. The project's fields are listed in the "PROJECT FIELDS" section of the system prompt, each with its ID (ID: <uuid>). Fields marked [EMPTY] are known gaps that still need a value.

Use this tool to:
- Fill an EMPTY field (or correct an existing one) when you have learned its value from uploaded documents, web research, or the user. Pass the field's fieldId — copy it exactly from the PROJECT FIELDS list — along with the value(s).
- Create a new field for a clearly-supported, structured fact that deserves its own field (e.g. "Lead Agency", "Comment Deadline", "Project Acreage"). Omit fieldId and provide a name; a new field is created (default type "text" unless you pass type "list").

Value semantics:
- text fields hold a single value — pass a one-element array in "values" (e.g. ["Bureau of Land Management"]).
- list fields hold multiple values — pass all of them in "values".

Rules:
- Only set values you are confident are correct. These are authoritative project data.
- Prefer filling existing [EMPTY] fields over creating new ones. Only create a new field when no existing field fits.
- A project is limited to a fixed number of fields; requests beyond the limit, or a fieldId that does not belong to this project, are reported under "skipped".`;

export const toolDescUpdateProjectFieldsProactive = `PROACTIVE FIELD CREATION — this project was brought in mid-stream (it skipped the AI research phase), so its structured fields have not been set up yet.
After you learn structured facts about the project — from reading uploaded documents (readProjectDocuments), web research, or the user — proactively create the project's core fields with the values you can support (e.g. "Lead Agency", "Responsible Official", "Location", "Project Area", "NEPA Pathway", "Key Deadlines"). Do this in the same turn you save project context — do not wait to be asked.
Still prefer filling an existing [EMPTY] field over creating a duplicate, and only set values you are confident are correct.`;

export const toolDescResearchNotes = `Record research findings, analysis, and internal reasoning that should not appear as regular chat text.

Use this tool to capture:
- Synthesis of web search results and page contents
- Comparable project analysis and context
- Source evaluation and cross-referencing
- Internal reasoning that supports your final response

Always provide a concise title (3-6 words) summarizing the note, e.g., "Comparable Project Analysis" or "Trail Management Context".

IMPORTANT: Content must be PLAIN TEXT only — no markdown formatting, no headers (#), no bullet lists (-/*), no bold (**), no italic (*). Write in natural paragraphs. Include source citations in parentheses: (Source Name).`;
