import { cn } from "@/lib/utils";

const DOT_DELAY_CLASSES = [
  "[animation-delay:0ms]",
  "[animation-delay:150ms]",
  "[animation-delay:300ms]",
];

/** Typing indicator (CSS keyframes in app/globals.css: `chat-typing-dot`).
 * Same 32px row height as a text line + avatar, so swapping it for streamed
 * text doesn't shift the list. */
export const ThinkingDots = () => {
  return (
    <div
      role="status"
      aria-label="Assistant is typing"
      className="flex h-8 items-center gap-1.5"
    >
      {DOT_DELAY_CLASSES.map((delayClass) => (
        <span
          key={delayClass}
          aria-hidden
          className={cn(
            "chat-typing-dot size-1.5 rounded-full bg-brand-700",
            delayClass,
          )}
        />
      ))}
    </div>
  );
};
