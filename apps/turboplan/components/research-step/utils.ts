import type { ResearchToolName, SearchResult } from "./types";

export const expandTransition = {
  duration: 0.25,
  ease: [0.32, 0.72, 0, 1],
};

export const getResultsArray = (
  result?: Record<string, unknown>,
): SearchResult[] => {
  if (!result?.results || !Array.isArray(result.results)) {
    return [];
  }
  return result.results as SearchResult[];
};

const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
};

export const getLabel = (
  toolName: ResearchToolName,
  isComplete: boolean,
  args?: Record<string, unknown>,
): string => {
  if (toolName === "webSearch") {
    const query = typeof args?.query === "string" ? args.query : "";
    if (!query) {
      return isComplete ? "Search complete" : "Searching the web...";
    }
    return isComplete ? `Searched "${query}"` : `Searching "${query}"...`;
  }

  if (toolName === "getContents") {
    const urls = Array.isArray(args?.urls) ? (args.urls as string[]) : [];
    const count = urls.length;
    const domains = urls.slice(0, 3).map(getDomain);
    const suffix = urls.length > 3 ? ` +${urls.length - 3} more` : "";
    const domainsLabel = domains.join(", ") + suffix;
    if (!domainsLabel) {
      return isComplete ? "Reading complete" : "Reading page contents...";
    }
    return isComplete
      ? `Read ${count} ${count === 1 ? "page" : "pages"} from ${domainsLabel}`
      : `Reading pages from ${domainsLabel}...`;
  }

  // researchNotes
  const title = typeof args?.title === "string" ? args.title : "";
  if (!title) {
    return isComplete ? "Analysis complete" : "Analyzing findings...";
  }
  return isComplete ? title : `${title}...`;
};

export const getExcerpt = (item: SearchResult): string | undefined => {
  if (item.summary) {
    return cleanExcerpt(item.summary);
  }
  if (Array.isArray(item.highlights) && item.highlights.length > 0) {
    return cleanExcerpt(item.highlights.join(" ... "));
  }
  return undefined;
};

export const cleanExcerpt = (text: string): string => {
  return text
    .replace(/#{1,6}\s*/g, "") // strip markdown headers
    .replace(/\n{2,}/g, "\n") // collapse multiple newlines
    .replace(/^\s+/gm, "") // strip leading whitespace per line
    .trim();
};
