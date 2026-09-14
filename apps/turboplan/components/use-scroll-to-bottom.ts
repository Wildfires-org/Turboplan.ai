import { type RefObject, useCallback, useEffect, useRef } from "react";

/**
 * Data attributes used to mark UI elements that should NOT trigger auto-scroll.
 * These are used throughout the chat UI to prevent unwanted scrolling during
 * user interactions like hovering tooltips or editing messages.
 */
const IGNORED_SELECTORS = {
  /** Radix UI tooltip/popover elements */
  TOOLTIP: '[role="tooltip"]',
  RADIX_POPPER: "[data-radix-popper-content-wrapper]",
  RADIX_STATE: "[data-state]",
  /** Message edit mode container - see message-editor.tsx */
  MESSAGE_EDITOR: "[data-message-editor]",
  /** Message part container (wraps both view and edit modes) - see message.tsx */
  MESSAGE_PART: "[data-message-part]",
} as const;

/**
 * Checks if a DOM node is a transient UI element (tooltip, popover, etc.)
 * that shouldn't trigger scroll behavior.
 */
const isTransientUIElement = (node: Node): boolean => {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;

  const el = node as Element;
  return (
    el.matches(IGNORED_SELECTORS.TOOLTIP) ||
    el.matches(IGNORED_SELECTORS.RADIX_POPPER) ||
    el.matches(IGNORED_SELECTORS.RADIX_STATE) ||
    el.matches(IGNORED_SELECTORS.MESSAGE_EDITOR)
  );
};

/**
 * Checks if a mutation originated from within a message part container.
 * This catches view↔edit mode transitions within messages.
 */
const isMutationWithinMessagePart = (mutation: MutationRecord): boolean => {
  const target = mutation.target as Element;
  return (
    target.matches?.(IGNORED_SELECTORS.MESSAGE_PART) ||
    target.closest?.(IGNORED_SELECTORS.MESSAGE_PART) !== null
  );
};

/**
 * Determines if a mutation should trigger auto-scroll.
 * We only want to scroll for meaningful content changes (new messages, streaming text),
 * NOT for transient UI interactions (tooltips, edit mode transitions).
 */
const shouldTriggerScroll = (mutation: MutationRecord): boolean => {
  // Non-childList mutations (characterData) are meaningful - likely streaming text
  if (mutation.type !== "childList") return true;

  // Mutations within message parts are view↔edit transitions - ignore
  if (isMutationWithinMessagePart(mutation)) return false;

  // Check if all changed nodes are transient UI elements
  const addedNodes = Array.from(mutation.addedNodes);
  const removedNodes = Array.from(mutation.removedNodes);

  const allAddedAreTransient =
    addedNodes.length > 0 && addedNodes.every(isTransientUIElement);
  const allRemovedAreTransient =
    removedNodes.length > 0 && removedNodes.every(isTransientUIElement);

  // If only transient UI elements changed, don't scroll
  if (
    (addedNodes.length === 0 || allAddedAreTransient) &&
    (removedNodes.length === 0 || allRemovedAreTransient)
  ) {
    return false;
  }

  return true;
};

/**
 * Hook that auto-scrolls a container to the bottom when meaningful content changes.
 *
 * Returns two refs:
 * - containerRef: Attach to the scrollable container
 * - endRef: Attach to an element at the bottom of the content
 *
 * The hook filters out transient UI changes (tooltips, message editing) to prevent
 * unwanted scrolling during user interactions.
 *
 * @example
 * ```tsx
 * const [containerRef, endRef] = useScrollToBottom<HTMLDivElement>();
 *
 * return (
 *   <div ref={containerRef} className="overflow-y-auto">
 *     {messages.map(msg => <Message key={msg.id} />)}
 *     <div ref={endRef} />
 *   </div>
 * );
 * ```
 */
const NEAR_BOTTOM_THRESHOLD = 150;

export function useScrollToBottom<T extends HTMLElement>(): [
  RefObject<T | null>,
  RefObject<T | null>,
  () => void,
] {
  const containerRef = useRef<T>(null);
  const endRef = useRef<T>(null);
  const autoScrollRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    autoScrollRef.current = true;
    isProgrammaticScrollRef.current = true;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    const onScrollEnd = () => {
      isProgrammaticScrollRef.current = false;
      container.removeEventListener("scrollend", onScrollEnd);
    };
    container.addEventListener("scrollend", onScrollEnd, { once: true });
    // Fallback for browsers without scrollend support
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      container.removeEventListener("scrollend", onScrollEnd);
    }, 1000);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const end = endRef.current;

    if (!container || !end) return;

    const scrollToEnd = () => {
      isProgrammaticScrollRef.current = true;
      container.scrollTop = container.scrollHeight;
      // Instant scroll completes synchronously, but scroll event fires async
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false;
        });
      });
    };

    scrollToEnd();

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) {
        return;
      }
      const distance =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      autoScrollRef.current = distance < NEAR_BOTTOM_THRESHOLD;
    };
    container.addEventListener("scroll", handleScroll, { passive: true });

    // Track recent mutations so ResizeObserver only auto-scrolls when
    // content is actively changing (streaming), not on unrelated resizes.
    let recentMutation = false;
    let mutationTimer: ReturnType<typeof setTimeout>;

    const mutationObserver = new MutationObserver((mutations) => {
      if (autoScrollRef.current && mutations.some(shouldTriggerScroll)) {
        recentMutation = true;
        clearTimeout(mutationTimer);
        mutationTimer = setTimeout(() => {
          recentMutation = false;
        }, 500);
        scrollToEnd();
      }
    });

    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const resizeObserver = new ResizeObserver(() => {
      if (autoScrollRef.current && recentMutation) {
        scrollToEnd();
      }
    });
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      clearTimeout(mutationTimer);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, []);

  return [containerRef, endRef, scrollToBottom];
}
