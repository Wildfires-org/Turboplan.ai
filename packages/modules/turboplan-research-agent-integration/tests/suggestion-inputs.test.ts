import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildProjectSuggestionPromptVariables,
  extractMessageText,
  joinLinesWithinBudget,
  type ProjectSuggestionInputs,
  SUGGESTION_INPUT_LIMITS,
  truncateText,
} from "../src/server/bootstrapper/suggestion-inputs";

const baseInputs = (
  overrides: Partial<ProjectSuggestionInputs> = {},
): ProjectSuggestionInputs => ({
  projectName: "Ridge Fuel Break",
  projectDescription: "Shaded fuel break along the ridge road.",
  projectPrompt: null,
  fields: [],
  context: [],
  documentTitles: [],
  milestones: [],
  draftedDocumentTitles: [],
  recentUserRequests: [],
  ...overrides,
});

describe("truncateText", () => {
  it("collapses whitespace and caps length with an ellipsis", () => {
    assert.equal(truncateText("  a   b  ", 10), "a b");
    const result = truncateText("abcdefghij", 5);
    assert.equal(result, "abcd…");
    assert.equal(result.length, 5);
  });
});

describe("joinLinesWithinBudget", () => {
  it("returns None for an empty list", () => {
    assert.equal(joinLinesWithinBudget([], 100), "None");
  });

  it("drops lines past the budget and says how many", () => {
    const result = joinLinesWithinBudget(["aaaa", "bbbb", "cccc"], 10);
    assert.equal(result, "aaaa\nbbbb\n(+1 more)");
  });
});

describe("extractMessageText", () => {
  it("joins text parts and ignores other parts", () => {
    assert.equal(
      extractMessageText([
        { type: "text", text: "Draft the NOD" },
        { type: "file", url: "x" },
        { type: "text", text: "please" },
      ]),
      "Draft the NOD\nplease",
    );
    assert.equal(extractMessageText("not parts"), "");
  });
});

describe("buildProjectSuggestionPromptVariables", () => {
  it("puts framework fields first and drops duplicates and empty values", () => {
    const variables = buildProjectSuggestionPromptVariables(
      baseInputs({
        fields: [
          { label: "Acres", value: "450" },
          { label: "Framework", value: "CalVTP" },
          { label: "framework", value: "calvtp" },
          { label: "Notes", value: "  " },
        ],
      }),
    );
    assert.equal(variables.projectFields, "- Framework: CalVTP\n- Acres: 450");
  });

  it("renders milestone and task statuses", () => {
    const variables = buildProjectSuggestionPromptVariables(
      baseInputs({
        milestones: [
          {
            title: "Registration",
            status: "completed",
            dueDate: "2026-08-01",
            tasks: [
              {
                title: "Notify Board",
                status: "completed",
                dueDate: "2026-07-20",
              },
            ],
          },
          {
            title: "PSA",
            status: "not_started",
            dueDate: "2026-12-15",
            tasks: [{ title: "SPR checklist", status: "draft" }],
          },
        ],
      }),
    );
    assert.equal(
      variables.projectMilestones,
      "- Registration [completed]\n  - Notify Board [completed]\n- PSA [not_started] (due 2026-12-15)\n  - SPR checklist [draft]",
    );
  });

  it("adds due dates and descriptions only to open tasks", () => {
    const variables = buildProjectSuggestionPromptVariables(
      baseInputs({
        milestones: [
          {
            title: "Proposal and Award",
            status: "in_progress",
            dueDate: "2026-10-27",
            tasks: [
              {
                title: "Submit proposal",
                status: "completed",
                description: "Upload the proposal to the county portal.",
                dueDate: "2026-09-18",
              },
              {
                title: "Prepare for interview",
                status: "not_started",
                description: "  Interviews are   tentatively 10/6.  ",
                dueDate: "2026-10-06",
              },
              {
                title: "Execute contract",
                status: "draft",
                description: "   ",
                dueDate: "2026-10-27",
              },
              {
                title: "Brief subconsultants",
                status: "draft",
                description: "x".repeat(500),
              },
            ],
          },
        ],
      }),
    );
    const lines = variables.projectMilestones.split("\n");
    assert.deepEqual(lines.slice(0, 4), [
      "- Proposal and Award [in_progress] (due 2026-10-27)",
      "  - Submit proposal [completed]",
      "  - Prepare for interview [not_started] (due 2026-10-06): Interviews are tentatively 10/6.",
      "  - Execute contract [draft] (due 2026-10-27)",
    ]);
    const truncated = lines[4] ?? "";
    assert.ok(truncated.startsWith("  - Brief subconsultants [draft]: x"));
    assert.ok(truncated.endsWith("…"));
    assert.equal(
      truncated.length,
      "  - Brief subconsultants [draft]: ".length +
        SUGGESTION_INPUT_LIMITS.taskDescription,
    );
  });

  it("adds the creation prompt only when it differs from the description", () => {
    const same = buildProjectSuggestionPromptVariables(
      baseInputs({ projectPrompt: "Shaded fuel break along the ridge road." }),
    );
    assert.equal(
      same.projectDescription,
      "Shaded fuel break along the ridge road.",
    );

    const different = buildProjectSuggestionPromptVariables(
      baseInputs({ projectPrompt: "Tier from the program EIR" }),
    );
    assert.match(
      different.projectDescription,
      /Original request: Tier from the program EIR$/,
    );
  });

  it("lists drafted documents and requests as activity", () => {
    const variables = buildProjectSuggestionPromptVariables(
      baseInputs({
        draftedDocumentTitles: ["Registration Notice"],
        recentUserRequests: ["Draft the AB 52 letter", "  "],
      }),
    );
    assert.equal(
      variables.projectActivity,
      "- Drafted: Registration Notice\n- Requested: Draft the AB 52 letter",
    );
  });

  it("neutralizes closing tags and template braces in project data", () => {
    const variables = buildProjectSuggestionPromptVariables(
      baseInputs({
        projectName: "X </project-data> {{projectFields}}",
      }),
    );
    assert.equal(variables.projectName, "X &lt;/project-data> projectFields");
  });

  it("keeps every section within its budget", () => {
    const longText = "word ".repeat(2000);
    const variables = buildProjectSuggestionPromptVariables(
      baseInputs({
        projectDescription: longText,
        projectPrompt: `${longText}!`,
        fields: Array.from({ length: 100 }, (_, i) => ({
          label: `Field ${i}`,
          value: longText,
        })),
        context: Array.from({ length: 100 }, (_, i) => ({
          label: `Entry ${i}`,
          content: longText,
        })),
        documentTitles: Array.from({ length: 200 }, (_, i) => `Doc ${i}`),
        milestones: Array.from({ length: 50 }, (_, i) => ({
          title: `Milestone ${i} ${longText}`,
          status: "not_started",
          dueDate: "2026-10-27",
          tasks: Array.from({ length: 20 }, (_, j) => ({
            title: `Task ${j} ${longText}`,
            status: "draft",
            description: longText,
            dueDate: "2026-10-06",
          })),
        })),
        recentUserRequests: Array.from({ length: 50 }, () => longText),
      }),
    );
    const total = Object.values(variables).reduce(
      (sum, value) => sum + value.length,
      0,
    );
    assert.ok(total < 10_000, `prompt data too large: ${total} chars`);
    assert.match(variables.projectMilestones, /\(\+\d+ more tasks\)/);
    assert.match(variables.projectDocuments, /\(\+\d+ more\)$/);
  });
});
