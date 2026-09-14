import { resolveMetadataBase } from "./metadata-base";

describe("resolveMetadataBase", () => {
  it("returns undefined for an empty value", () => {
    expect(resolveMetadataBase("")).toBeUndefined();
  });

  it("prepends https:// when the scheme is missing", () => {
    expect(resolveMetadataBase("example.com")?.toString()).toBe(
      "https://example.com/",
    );
  });

  it("keeps an explicit https URL", () => {
    expect(resolveMetadataBase("https://example.com")?.toString()).toBe(
      "https://example.com/",
    );
  });

  it("keeps an explicit http URL", () => {
    expect(resolveMetadataBase("http://localhost:3002")?.toString()).toBe(
      "http://localhost:3002/",
    );
  });

  it("returns undefined instead of throwing for a malformed value", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    expect(resolveMetadataBase("https://")).toBeUndefined();

    warnSpy.mockRestore();
  });
});
