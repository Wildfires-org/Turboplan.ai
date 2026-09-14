import { redactUrl, sanitizeProperties } from "./posthog-sanitize";

describe("redactUrl", () => {
  it("redacts sensitive params, keeps the rest", () => {
    expect(redactUrl("/check-email?email=a%40b.c&type=login")).toBe(
      "/check-email?email=[redacted]&type=login",
    );
    expect(redactUrl("/projects?page=2")).toBe("/projects?page=2");
  });
});

describe("stripTelemetryHeaders (via sanitize module sibling)", () => {
  it("sanitizeProperties redacts URL-shaped props", () => {
    const out = sanitizeProperties({
      $initial_referrer: "https://ref/?email=a@b.c",
      plain: "x",
    });
    expect(out.$initial_referrer).toBe("https://ref/?email=[redacted]");
    expect(out.plain).toBe("x");
  });
});
