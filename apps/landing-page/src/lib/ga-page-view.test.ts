import { buildPageViewParams } from "./ga-page-view";

describe("buildPageViewParams", () => {
  it("redacts campaign PII from page_location", () => {
    expect(
      buildPageViewParams(
        "https://example.com/?utm_email=a%40b.c&utm_uid=123&utm_source=mail",
        "",
      ),
    ).toEqual({
      page_location:
        "https://example.com/?utm_email=[redacted]&utm_uid=123&utm_source=mail",
    });
  });

  it("redacts the referrer when one is present", () => {
    expect(
      buildPageViewParams(
        "https://example.com/pricing",
        "https://example.com/?email=a@b.c",
      ),
    ).toEqual({
      page_location: "https://example.com/pricing",
      page_referrer: "https://example.com/?email=[redacted]",
    });
  });

  it("omits page_referrer when document.referrer is empty", () => {
    expect(buildPageViewParams("https://example.com/", "")).not.toHaveProperty(
      "page_referrer",
    );
  });
});
