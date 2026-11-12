import assert from "node:assert/strict";
import { afterEach, before, beforeEach, describe, it, mock } from "node:test";

import type * as FirecrawlClientModule from "../lib/ai/firecrawl-client";

const API_KEY = "fc-test-key";

let apiKey: string | undefined = API_KEY;

mock.module("@wildfires-org/turboplan-env", {
  namedExports: { getWebEnv: () => ({ FIRECRAWL_API_KEY: apiKey }) },
});

// The turboplan app resolves as CJS, so import after the mock is registered.
let firecrawlSearch: typeof FirecrawlClientModule.firecrawlSearch;
let firecrawlGetContents: typeof FirecrawlClientModule.firecrawlGetContents;

before(async () => {
  ({ firecrawlSearch, firecrawlGetContents } = await import(
    "../lib/ai/firecrawl-client"
  ));
});

type FetchCall = {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  hasSignal: boolean;
};

const fetchCalls: FetchCall[] = [];
const logged: string[] = [];
const originalFetch = globalThis.fetch;
const originalWarn = console.warn;
const originalError = console.error;

/** Replace fetch: `respond` gets each request's parsed JSON body. */
const mockFetch = (
  respond: (body: Record<string, unknown>) => Response | Promise<Response>,
) => {
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    fetchCalls.push({
      url: String(input),
      headers: init?.headers as Record<string, string>,
      body,
      hasSignal: init?.signal instanceof AbortSignal,
    });
    return respond(body);
  }) as typeof fetch;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const searchBody = (
  web: Array<{ url?: string; title?: string; description?: string }>,
) => ({ success: true, data: { web }, creditsUsed: 2 });

const scrapeBody = ({
  url,
  markdown = "Page text",
  summary = "Page summary",
  title = "Page title",
  statusCode = 200,
  error,
}: {
  url: string;
  markdown?: string;
  summary?: string;
  title?: string;
  statusCode?: number;
  error?: string;
}) => ({
  success: true,
  data: {
    markdown,
    summary,
    metadata: {
      title,
      sourceURL: url,
      url: `${url}?redirected=1`,
      statusCode,
      ...(error && { error }),
    },
  },
});

beforeEach(() => {
  apiKey = API_KEY;
  fetchCalls.length = 0;
  logged.length = 0;
  console.warn = (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  };
  console.error = console.warn;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
  console.error = originalError;
  // Nothing we log may carry the key.
  for (const line of logged) {
    assert.ok(!line.includes(API_KEY), `logged the API key: ${line}`);
  }
});

describe("firecrawlSearch", () => {
  it("posts the query with the key and maps results to titles, URLs and snippets", async () => {
    mockFetch(() =>
      json(
        searchBody([
          {
            url: "https://www.fs.usda.gov/project/1",
            title: "Road Maintenance CE",
            description: "Decision memo for road maintenance.",
          },
          { url: "https://example.gov/no-snippet", title: "", description: "" },
          { title: "No URL" },
        ]),
      ),
    );

    const response = await firecrawlSearch("road maintenance");

    assert.equal(fetchCalls.length, 1);
    const [call] = fetchCalls;
    assert.equal(call.url, "https://api.firecrawl.dev/v2/search");
    assert.equal(call.headers.Authorization, `Bearer ${API_KEY}`);
    assert.equal(call.headers["Content-Type"], "application/json");
    assert.ok(call.hasSignal);
    assert.deepEqual(call.body, { query: "road maintenance", limit: 5 });
    assert.deepEqual(response, {
      results: [
        {
          title: "Road Maintenance CE",
          url: "https://www.fs.usda.gov/project/1",
          highlights: ["Decision memo for road maintenance."],
        },
        {
          title: "https://example.gov/no-snippet",
          url: "https://example.gov/no-snippet",
        },
      ],
    });
  });

  it("limits a government search to .gov sites", async () => {
    mockFetch(() => json(searchBody([])));

    await firecrawlSearch("road maintenance", { category: "government" });

    assert.equal(fetchCalls[0].body.query, "road maintenance site:gov");
    assert.ok(!("categories" in fetchCalls[0].body));
  });

  it("passes the pdf and research categories, and ignores others", async () => {
    mockFetch(() => json(searchBody([])));

    await firecrawlSearch("decision memo", { category: "pdf" });
    await firecrawlSearch("fire ecology", { category: "research" });
    await firecrawlSearch("anything", { category: "news" });

    assert.deepEqual(fetchCalls[0].body.categories, ["pdf"]);
    assert.deepEqual(fetchCalls[1].body.categories, ["research"]);
    assert.deepEqual(fetchCalls[2].body, { query: "anything", limit: 5 });
  });

  it("turns published dates into a custom date range", async () => {
    mockFetch(() => json(searchBody([])));

    await firecrawlSearch("q", {
      startPublishedDate: "2020-01-05",
      endPublishedDate: "2025-12-31",
    });
    await firecrawlSearch("q", { startPublishedDate: "2020-01-05" });
    await firecrawlSearch("q", { endPublishedDate: "2021-12-31" });

    assert.deepEqual(
      fetchCalls.map(({ body }) => body.tbs),
      [
        "cdr:1,cd_min:1/5/2020,cd_max:12/31/2025",
        "cdr:1,cd_min:1/5/2020",
        "cdr:1,cd_max:12/31/2021",
      ],
    );
  });

  it("skips invalid dates", async () => {
    mockFetch(() => json(searchBody([])));

    await firecrawlSearch("q", {
      startPublishedDate: "2021-02-30",
      endPublishedDate: "last year",
    });
    await firecrawlSearch("q", {
      startPublishedDate: "01/05/2020",
      endPublishedDate: "2025-06-01",
    });

    assert.ok(!("tbs" in fetchCalls[0].body));
    assert.equal(fetchCalls[1].body.tbs, "cdr:1,cd_max:6/1/2025");
  });

  it("warns without calling Firecrawl when no key is configured", async () => {
    apiKey = undefined;
    mockFetch(() => json(searchBody([])));

    const response = await firecrawlSearch("q");

    assert.deepEqual(response, {
      results: [],
      warning:
        "FIRECRAWL_API_KEY is not configured. Web search is unavailable.",
    });
    assert.equal(fetchCalls.length, 0);
  });

  it("explains rate limits, missing credits and other errors", async () => {
    const warnings: Array<string | undefined> = [];
    for (const status of [429, 402, 500]) {
      mockFetch(() => json({ success: false }, status));
      warnings.push((await firecrawlSearch("q")).warning);
    }

    assert.deepEqual(warnings, [
      "Web search is temporarily unavailable due to rate limiting. Please try again in a moment.",
      "Web search is unavailable because the search service has no credits left.",
      "Web search returned an error (500). Please try again.",
    ]);
  });

  it("treats an unsuccessful body as an error", async () => {
    mockFetch(() => json({ success: false, error: "Bad query" }));

    const response = await firecrawlSearch("q");

    assert.deepEqual(response, {
      results: [],
      warning: "Web search returned an error. Please try again.",
    });
  });

  it("warns when the request itself fails", async () => {
    mockFetch(() => {
      throw new TypeError("fetch failed");
    });

    const response = await firecrawlSearch("q");

    assert.deepEqual(response, {
      results: [],
      warning: "Web search timed out or failed. Please try again.",
    });
    assert.ok(logged.some((line) => line.startsWith("[Firecrawl]")));
  });
});

describe("firecrawlGetContents", () => {
  it("returns a summary and the opening of each page by default", async () => {
    const markdown = `# Heading\n\n${"a".repeat(3000)}`;
    mockFetch((body) =>
      json(scrapeBody({ url: String(body.url), markdown, summary: "Short." })),
    );

    const response = await firecrawlGetContents(["https://example.gov/a"]);

    assert.equal(fetchCalls.length, 1);
    const [call] = fetchCalls;
    assert.equal(call.url, "https://api.firecrawl.dev/v2/scrape");
    assert.equal(call.headers.Authorization, `Bearer ${API_KEY}`);
    assert.ok(call.hasSignal);
    assert.deepEqual(call.body, {
      url: "https://example.gov/a",
      formats: ["markdown", "summary"],
      onlyMainContent: true,
      timeout: 30_000,
    });
    assert.deepEqual(response, {
      results: [
        {
          url: "https://example.gov/a",
          title: "Page title",
          summary: "Short.",
          highlights: [markdown.slice(0, 2500)],
        },
      ],
    });
  });

  it("returns only the page text, cut to maxCharacters, for a deep read", async () => {
    const markdown = "b".repeat(5000);
    mockFetch((body) =>
      json(
        scrapeBody({
          url: String(body.url),
          markdown,
          title: "Federal Register\n   :: \n  Page title",
        }),
      ),
    );

    const response = await firecrawlGetContents(
      ["https://example.gov/b"],
      3000,
    );

    assert.deepEqual(fetchCalls[0].body.formats, ["markdown"]);
    assert.deepEqual(response, {
      results: [
        {
          url: "https://example.gov/b",
          title: "Federal Register :: Page title",
          text: markdown.slice(0, 3000),
        },
      ],
    });
  });

  it("keeps the requested URL, and falls back to it for a missing title", async () => {
    const requested = "https://example.gov/c#section";
    mockFetch((body) =>
      json(scrapeBody({ url: String(body.url), title: "  " })),
    );

    const response = await firecrawlGetContents([requested], 1000);

    assert.equal(response.results[0].url, requested);
    assert.equal(response.results[0].title, requested);
  });

  it("reads every URL in parallel and drops the pages that fail", async () => {
    const urls = [
      "https://example.gov/ok",
      "https://example.gov/missing",
      "https://example.gov/server-error",
      "https://example.gov/unsuccessful",
      "https://example.gov/throws",
    ];
    let inFlight = 0;
    let maxInFlight = 0;
    mockFetch(async (body) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      switch (body.url) {
        case "https://example.gov/ok":
          return json(scrapeBody({ url: String(body.url) }));
        case "https://example.gov/missing":
          return json(
            scrapeBody({
              url: String(body.url),
              statusCode: 404,
              error: "Not Found",
            }),
          );
        case "https://example.gov/server-error":
          return json({ success: false }, 500);
        case "https://example.gov/unsuccessful":
          return json({ success: false, error: "Could not scrape" });
        default:
          throw new Error("The operation was aborted due to timeout");
      }
    });

    const response = await firecrawlGetContents(urls);

    assert.equal(fetchCalls.length, urls.length);
    assert.equal(maxInFlight, urls.length);
    assert.deepEqual(
      response.results.map(({ url }) => url),
      ["https://example.gov/ok"],
    );
    assert.equal(response.warning, undefined);
    for (const url of urls.slice(1)) {
      assert.ok(
        logged.some((line) =>
          line.startsWith(`[Firecrawl] Error fetching ${url}:`),
        ),
        `no warning logged for ${url}`,
      );
    }
  });

  it("warns when no page could be read", async () => {
    mockFetch((body) =>
      json(scrapeBody({ url: String(body.url), statusCode: 404 })),
    );

    const response = await firecrawlGetContents([
      "https://example.gov/x",
      "https://example.gov/y",
    ]);

    assert.deepEqual(response, {
      results: [],
      warning: "None of the pages could be read.",
    });
  });

  it("explains a rate limit or missing credits when every read hit one", async () => {
    mockFetch(() => json({ success: false }, 429));
    const rateLimited = await firecrawlGetContents([
      "https://example.gov/x",
      "https://example.gov/y",
    ]);

    mockFetch(() => json({ success: false }, 402));
    const noCredits = await firecrawlGetContents(["https://example.gov/x"]);

    const statuses = [429, 402];
    mockFetch(() => json({ success: false }, statuses[fetchCalls.length % 2]));
    const mixed = await firecrawlGetContents([
      "https://example.gov/x",
      "https://example.gov/y",
    ]);

    assert.match(String(rateLimited.warning), /rate limiting/);
    assert.match(String(noCredits.warning), /no credits left/);
    assert.equal(mixed.warning, "None of the pages could be read.");
  });

  it("warns without calling Firecrawl when no key is configured", async () => {
    apiKey = undefined;
    mockFetch((body) => json(scrapeBody({ url: String(body.url) })));

    const response = await firecrawlGetContents(["https://example.gov/a"]);

    assert.deepEqual(response, {
      results: [],
      warning:
        "FIRECRAWL_API_KEY is not configured. Web search is unavailable.",
    });
    assert.equal(fetchCalls.length, 0);
  });
});
