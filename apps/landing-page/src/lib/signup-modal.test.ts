import { resolveProposedTitles } from "./signup-modal";

const PROMPT =
  "  Replace a failing culvert on Forest Road 43 in the Tahoe National Forest, near Truckee.";

describe("resolveProposedTitles", () => {
  it("uses the generated names when a project title came back", () => {
    expect(
      resolveProposedTitles(PROMPT, {
        projectTitle: "Forest Road 43 culvert",
        organizationName: "USDA Forest Service",
        officeTitle: "Tahoe National Forest",
      }),
    ).toEqual({
      projectTitle: "Forest Road 43 culvert",
      organizationName: "USDA Forest Service",
      officeName: "Tahoe National Forest",
    });
  });

  it("falls back to the first 50 characters of the trimmed prompt", () => {
    const fallback = PROMPT.trim().slice(0, 50);

    expect(resolveProposedTitles(PROMPT)).toEqual({
      projectTitle: fallback,
      organizationName: "",
      officeName: "",
    });
    expect(
      resolveProposedTitles(PROMPT, { error: "rate limited" }).projectTitle,
    ).toBe(fallback);
  });

  it("uses the page's office when none was generated", () => {
    expect(
      resolveProposedTitles(
        PROMPT,
        { projectTitle: "Forest Road 43 culvert" },
        "Truckee Ranger District",
      ).officeName,
    ).toBe("Truckee Ranger District");
  });
});
