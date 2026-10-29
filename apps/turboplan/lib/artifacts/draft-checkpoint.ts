type DraftCheckpointerOptions = {
  intervalMs: number;
  save: (content: string) => Promise<void>;
  onError: (error: unknown) => void;
  now?: () => number;
};

/**
 * Throttled saves of a draft while it streams, so a run cut off mid-document
 * keeps what was written. offer() is called on every delta and starts a save
 * only when intervalMs has passed since the last one, the content changed and
 * no save is in flight. It never throws: a failed save goes to onError and the
 * stream carries on. settle() waits for the save in flight, so the final save
 * is never overtaken by an older checkpoint.
 */
export const createDraftCheckpointer = ({
  intervalMs,
  save,
  onError,
  now = () => Date.now(),
}: DraftCheckpointerOptions) => {
  let lastStartedAt = now();
  let lastSavedContent: string | undefined;
  let inFlight: Promise<void> | undefined;

  const offer = (content: string) => {
    if (
      inFlight ||
      content === lastSavedContent ||
      now() - lastStartedAt < intervalMs
    ) {
      return;
    }

    lastStartedAt = now();
    const run = async () => {
      try {
        await save(content);
        lastSavedContent = content;
      } catch (error) {
        onError(error);
      }
    };
    // .finally runs asynchronously, so it always clears after the assignment.
    inFlight = run().finally(() => {
      inFlight = undefined;
    });
  };

  const settle = async () => {
    await inFlight;
  };

  return { offer, settle };
};
