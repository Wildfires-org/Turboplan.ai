/**
 * An office or organization row (or a column set of one) without its default
 * letterhead grid. The grid's logo cells are storage keys, which never leave
 * the server raw (see `toPublicGridLetterhead`), so every payload that sends
 * one of these rows goes through this; the server reads the grid from the row
 * itself (letterhead resolution).
 */
export const withoutLetterheadGrid = <
  T extends { documentLetterheadGrid: unknown },
>(
  row: T,
): Omit<T, "documentLetterheadGrid"> => {
  const { documentLetterheadGrid: _grid, ...rest } = row;
  return rest;
};
