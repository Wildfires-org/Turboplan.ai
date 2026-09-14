import { getWebEnv } from "@wildfires-org/turboplan-env";

const EXA_BASE_URL = "https://api.exa.ai";

type ExaSearchOptions = {
  numResults?: number;
  searchType?: "auto" | "neural" | "keyword";
  category?: string;
  startPublishedDate?: string;
  endPublishedDate?: string;
};

type ExaSearchResult = {
  title: string;
  url: string;
  publishedDate?: string;
  highlights?: string[];
};

type ExaSearchResponse = {
  results: ExaSearchResult[];
  warning?: string;
};

type ExaContentResult = {
  url: string;
  title: string;
  text?: string;
  highlights?: string[];
  summary?: string;
};

type ExaGetContentsResponse = {
  results: ExaContentResult[];
  warning?: string;
  statuses?: Array<{ url: string; status: string; error?: string }>;
};

const getApiKey = (): string | undefined => {
  return getWebEnv().EXA_API_KEY;
};

const handleErrorResponse = (
  response: Response,
): { results: []; warning: string } | null => {
  if (response.status === 429) {
    return {
      results: [],
      warning:
        "Web search is temporarily unavailable due to rate limiting. Please try again in a moment.",
    };
  }

  if (!response.ok) {
    console.error(`[Exa] API error: ${response.status} ${response.statusText}`);
    return {
      results: [],
      warning: `Web search returned an error (${response.status}). Please try again.`,
    };
  }

  return null;
};

export const exaSearch = async (
  query: string,
  options?: ExaSearchOptions,
): Promise<ExaSearchResponse> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      results: [],
      warning: "EXA_API_KEY is not configured. Web search is unavailable.",
    };
  }

  const searchStart = Date.now();
  let response: Response;
  try {
    response = await fetch(`${EXA_BASE_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        query,
        numResults: options?.numResults ?? 5,
        type: options?.searchType ?? "auto",
        ...(options?.category && { category: options.category }),
        ...(options?.startPublishedDate && {
          startPublishedDate: options.startPublishedDate,
        }),
        ...(options?.endPublishedDate && {
          endPublishedDate: options.endPublishedDate,
        }),
        contents: {
          highlights: { maxCharacters: 1000 },
        },
      }),
    });
  } catch (error) {
    console.error(
      `[Exa] Search FAILED (${Date.now() - searchStart}ms):`,
      error,
    );
    return {
      results: [],
      warning: "Web search timed out or failed. Please try again.",
    };
  }

  const errorResult = handleErrorResponse(response);
  if (errorResult) {
    return errorResult;
  }

  return response.json();
};

export const exaGetContents = async (
  urls: string[],
  maxCharacters?: number,
): Promise<ExaGetContentsResponse> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      results: [],
      warning: "EXA_API_KEY is not configured. Web search is unavailable.",
    };
  }

  let response: Response;
  try {
    response = await fetch(`${EXA_BASE_URL}/contents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        urls,
        ...(maxCharacters && { text: { maxCharacters } }),
        highlights: { maxCharacters: 2500 },
        summary: true,
      }),
    });
  } catch (error) {
    console.error(`[Exa] GetContents fetch failed:`, error);
    return {
      results: [],
      warning: "Content fetch timed out or failed. Please try again.",
    };
  }

  const errorResult = handleErrorResponse(response);
  if (errorResult) {
    return errorResult;
  }

  const data: ExaGetContentsResponse = await response.json();

  if (data.statuses) {
    for (const status of data.statuses) {
      if (status.error) {
        console.warn(`[Exa] Error fetching ${status.url}: ${status.error}`);
      }
    }
  }

  return data;
};
