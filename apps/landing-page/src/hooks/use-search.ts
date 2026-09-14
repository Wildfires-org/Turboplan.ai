import { parseAsString, useQueryState } from "nuqs";

export function useSearch() {
  return useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ shallow: false }),
  );
}
