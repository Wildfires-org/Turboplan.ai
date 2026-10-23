import { redactSensitiveUrl } from "./sentry-scrub";

describe("redactSensitiveUrl", () => {
  it("redacts sensitive params and keeps the rest intact", () => {
    expect(redactSensitiveUrl("https://x.com/p?token=abc&b=1")).toBe(
      "https://x.com/p?token=[redacted]&b=1",
    );
    expect(redactSensitiveUrl("https://x.com/verify?email=a@b.c#frag")).toBe(
      "https://x.com/verify?email=[redacted]#frag",
    );
  });

  it("matches the sensitive word anywhere in the param name", () => {
    expect(
      redactSensitiveUrl(
        "https://bucket.s3.amazonaws.com/f?X-Amz-Signature=deadbeef&X-Amz-Security-Token=zzz&x=1",
      ),
    ).toBe(
      "https://bucket.s3.amazonaws.com/f?X-Amz-Signature=[redacted]&X-Amz-Security-Token=[redacted]&x=1",
    );
  });

  it("redacts a sensitive param nested in another param's value", () => {
    expect(redactSensitiveUrl("/login?next=/verify?token=abc&x=1")).toBe(
      "/login?next=/verify?token=[redacted]&x=1",
    );
  });

  it("redacts params inside free text (exception messages)", () => {
    expect(redactSensitiveUrl("GET https://x.com/?code=123 failed")).toBe(
      "GET https://x.com/?code=[redacted] failed",
    );
    expect(redactSensitiveUrl("my token=abc")).toBe("my token=[redacted]");
  });

  it("leaves URLs without sensitive params untouched", () => {
    const url = "https://app.example.com/projects?page=2&sort=name";
    expect(redactSensitiveUrl(url)).toBe(url);
  });

  it("stays linear on input that backtracked catastrophically", () => {
    const k = 16_000;
    const url = `Y${"?".repeat(k)}${"KEY".repeat(k)}#KEY=v`;
    const start = performance.now();
    const redacted = redactSensitiveUrl(url);
    const elapsedMs = performance.now() - start;
    expect(redacted).toBe(`${url.slice(0, -1)}[redacted]`);
    expect(elapsedMs).toBeLessThan(250);
  });
});
