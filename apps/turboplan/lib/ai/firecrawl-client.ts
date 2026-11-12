import { getWebEnv } from "@wildfires-org/turboplan-env";

const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v2";
const FIRECRAWL_SEARCH_LIMIT = 5;
const FIRECRAWL_SEARCH_TIMEOUT_MS = 30_000;
/** How long Firecrawl itself may spend on one page. */
const FIRECRAWL_SCRAPE_TIMEOUT_MS = 30_000;
/** Our own cap per page: Firecrawl's timeout plus room for the response. */
const FIRECRAWL_SCRAPE_ABORT_MS = FIRECRAWL_SCRAPE_TIMEOUT_MS + 5_000;
/** Opening of the page returned as `highlights` in the default read mode. */
const PAGE_OPENING_CHARS = 2500;

/** Search categories the webSearch tool offers. */
export const WEB_SEARCH_CATEGORIES = ["government", "pdf", "research"] as const;

const NOT_CONFIGURED_WARNING =
  "FIRECRAWL_API_KEY is not configured. Web search is unavailable.";
const RATE_LIMITED_WARNING =
  "Web search is temporarily unavailable due to rate limiting. Please try again in a moment.";
const NO_CREDITS_WARNING =
  "Web search is unavailable because the search service has no credits left.";
const NO_PAGES_READ_WARNING = "None of the pages could be read.";

type FirecrawlSearchOptions = {
  /** "government", "pdf" or "research"; anything else is ignored. */
  category?: string;
  /** YYYY-MM-DD; an invalid date is ignored. */
  startPublishedDate?: string;
  /** YYYY-MM-DD; an invalid date is ignored. */
  endPublishedDate?: string;
};

type SearchResult = {
  title: string;
  url: string;
  highlights?: string[];
};

type SearchResponse = {
  results: SearchResult[];
  warning?: string;
};

type ContentResult = {
  url: string;
  title: string;
  text?: string;
  highlights?: string[];
  summary?: string;
};

type GetContentsResponse = {
  results: ContentResult[];
  warning?: string;
};

type FirecrawlSearchBody = {
  success?: boolean;
  error?: string;
  data?: {
    web?: Array<{ url?: string; title?: string; description?: string }>;
  };
};

type FirecrawlScrapeBody = {
  success?: boolean;
  error?: string;
  data?: {
    markdown?: string;
    summary?: string;
    metadata?: {
      title?: string | string[];
      statusCode?: number;
      error?: string;
    };
  };
};

const getApiKey = (): string | undefined => getWebEnv().FIRECRAWL_API_KEY;

const requestHeaders = (apiKey: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${apiKey}`,
});

const errorMessage = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

/** YYYY-MM-DD as M/D/YYYY (the `tbs` date format), or null if not a real date. */
const toTbsDate = (date: string | undefined): string | null => {
  const match = date?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return `${month}/${day}/${year}`;
};

/** Custom date range for the search, or undefined when neither date is valid. */
const dateRangeTbs = (
  startDate: string | undefined,
  endDate: string | undefined,
): string | undefined => {
  const min = toTbsDate(startDate);
  const max = toTbsDate(endDate);
  if (!min && !max) {
    return undefined;
  }
  return [
    "cdr:1",
    ...(min ? [`cd_min:${min}`] : []),
    ...(max ? [`cd_max:${max}`] : []),
  ].join(",");
};

/** Warning for a failed search; `status` only for a non-OK HTTP response. */
const searchErrorWarning = (status?: number): string => {
  if (status === 429) {
    return RATE_LIMITED_WARNING;
  }
  if (status === 402) {
    return NO_CREDITS_WARNING;
  }
  return status
    ? `Web search returned an error (${status}). Please try again.`
    : "Web search returned an error. Please try again.";
};

export const firecrawlSearch = async (
  query: string,
  options?: FirecrawlSearchOptions,
): Promise<SearchResponse> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    return { results: [], warning: NOT_CONFIGURED_WARNING };
  }

  // Firecrawl's `site:` operator takes a top-level domain without the dot:
  // `site:.gov` returns no results, `site:gov` covers every .gov site.
  const searchQuery =
    options?.category === "government" ? `${query} site:gov` : query;
  const categories =
    options?.category === "pdf" || options?.category === "research"
      ? [options.category]
      : undefined;
  const tbs = dateRangeTbs(
    options?.startPublishedDate,
    options?.endPublishedDate,
  );

  const searchStart = Date.now();
  let response: Response;
  try {
    response = await fetch(`${FIRECRAWL_BASE_URL}/search`, {
      method: "POST",
      headers: requestHeaders(apiKey),
      signal: AbortSignal.timeout(FIRECRAWL_SEARCH_TIMEOUT_MS),
      body: JSON.stringify({
        query: searchQuery,
        limit: FIRECRAWL_SEARCH_LIMIT,
        ...(categories && { categories }),
        ...(tbs && { tbs }),
      }),
    });
  } catch (error) {
    console.error(
      `[Firecrawl] Search FAILED (${Date.now() - searchStart}ms): ${errorMessage(error)}`,
    );
    return {
      results: [],
      warning: "Web search timed out or failed. Please try again.",
    };
  }

  if (!response.ok) {
    console.error(
      `[Firecrawl] Search API error: ${response.status} ${response.statusText}`,
    );
    return { results: [], warning: searchErrorWarning(response.status) };
  }

  let body: FirecrawlSearchBody;
  try {
    body = await response.json();
  } catch (error) {
    console.error(
      `[Firecrawl] Search response unreadable: ${errorMessage(error)}`,
    );
    return { results: [], warning: searchErrorWarning() };
  }

  if (!body.success) {
    console.error(
      `[Firecrawl] Search unsuccessful: ${body.error ?? "no error given"}`,
    );
    return { results: [], warning: searchErrorWarning() };
  }

  const results = (body.data?.web ?? []).flatMap(
    ({ url, title, description }): SearchResult[] => {
      if (!url) {
        return [];
      }
      const snippet = description?.trim();
      return [
        {
          title: title?.trim() || url,
          url,
          ...(snippet && { highlights: [snippet] }),
        },
      ];
    },
  );

  return { results };
};

type ScrapeOutcome =
  | { ok: true; result: ContentResult }
  | { ok: false; status?: number };

/** The page's title on one line (some sites break it), else its URL. */
const pageTitle = (title: string | string[] | undefined, url: string) =>
  (Array.isArray(title) ? title[0] : title)?.replace(/\s+/g, " ").trim() || url;

/**
 * Read one page. The result keeps the requested URL (not the one Firecrawl
 * landed on after redirects), since callers key their caches on it.
 */
const scrapePage = async (
  url: string,
  apiKey: string,
  maxCharacters: number | undefined,
): Promise<ScrapeOutcome> => {
  const deepRead = maxCharacters !== undefined;
  const failed = (reason: string, status?: number): ScrapeOutcome => {
    console.warn(`[Firecrawl] Error fetching ${url}: ${reason}`);
    return { ok: false, status };
  };

  try {
    const response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
      method: "POST",
      headers: requestHeaders(apiKey),
      signal: AbortSignal.timeout(FIRECRAWL_SCRAPE_ABORT_MS),
      body: JSON.stringify({
        url,
        // The summary costs an extra model pass on Firecrawl's side; a deep
        // read only needs the text (and the reference loader has 10s).
        formats: deepRead ? ["markdown"] : ["markdown", "summary"],
        onlyMainContent: true,
        timeout: FIRECRAWL_SCRAPE_TIMEOUT_MS,
      }),
    });

    if (!response.ok) {
      return failed(
        `${response.status} ${response.statusText}`.trim(),
        response.status,
      );
    }

    const body: FirecrawlScrapeBody = await response.json();
    if (!body.success || !body.data) {
      return failed(body.error ?? "unsuccessful response");
    }

    const { markdown = "", summary, metadata } = body.data;
    // Firecrawl reports the page's own HTTP status here; a 404 page is still
    // a successful scrape of an error page.
    if (metadata?.statusCode !== undefined && metadata.statusCode >= 400) {
      return failed(
        `page returned ${metadata.statusCode}${metadata.error ? ` (${metadata.error})` : ""}`,
      );
    }

    const title = pageTitle(metadata?.title, url);
    if (deepRead) {
      return {
        ok: true,
        result: { url, title, text: markdown.slice(0, maxCharacters) },
      };
    }
    const opening = markdown.slice(0, PAGE_OPENING_CHARS).trim();
    return {
      ok: true,
      result: {
        url,
        title,
        ...(summary?.trim() && { summary: summary.trim() }),
        ...(opening && { highlights: [opening] }),
      },
    };
  } catch (error) {
    return failed(errorMessage(error));
  }
};

/**
 * Read up to a handful of pages in parallel. Default mode returns each page's
 * summary and its opening (as `highlights`); with `maxCharacters`, only the
 * page text, cut to that length. Pages that cannot be read are left out; a
 * warning comes back only when none could be read.
 */
export const firecrawlGetContents = async (
  urls: string[],
  maxCharacters?: number,
): Promise<GetContentsResponse> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    return { results: [], warning: NOT_CONFIGURED_WARNING };
  }

  const outcomes = await Promise.all(
    urls.map((url) => scrapePage(url, apiKey, maxCharacters)),
  );
  const results = outcomes.flatMap((outcome) =>
    outcome.ok ? [outcome.result] : [],
  );

  if (results.length > 0 || urls.length === 0) {
    return { results };
  }

  const statuses = outcomes.map((outcome) =>
    outcome.ok ? undefined : outcome.status,
  );
  if (statuses.every((status) => status === 429)) {
    return { results: [], warning: RATE_LIMITED_WARNING };
  }
  if (statuses.every((status) => status === 402)) {
    return { results: [], warning: NO_CREDITS_WARNING };
  }
  return { results: [], warning: NO_PAGES_READ_WARNING };
};
