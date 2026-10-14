import { Tools } from "@/types/Tools";

const QUICK_RESPONSES_PART_TYPE = `tool-${Tools.generateQuickResponses}`;

export type OrderedMessagePart<TPart> = {
  part: TPart;
  /** Position in the original parts array; keeps React keys stable. */
  index: number;
};

/**
 * Puts the quick-reply suggestions at the end of the message. The model can
 * call `generateQuickResponses` before writing its answer, or more than once;
 * only the last call is kept so the reply ends with a single row of chips.
 */
export const orderMessageParts = <TPart extends { type: string }>(
  parts: ReadonlyArray<TPart>,
): Array<OrderedMessagePart<TPart>> => {
  const entries = parts.map((part, index) => ({ part, index }));
  const quickResponses = entries.filter(
    ({ part }) => part.type === QUICK_RESPONSES_PART_TYPE,
  );
  const lastQuickResponses = quickResponses.at(-1);
  if (!lastQuickResponses) {
    return entries;
  }
  return [
    ...entries.filter(({ part }) => part.type !== QUICK_RESPONSES_PART_TYPE),
    lastQuickResponses,
  ];
};
