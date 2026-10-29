/**
 * Yields one parsed JSON value per line of a newline-delimited JSON stream.
 * Lines may arrive split across chunks, blank lines are skipped and a last
 * line without a trailing newline is still read. A malformed line throws.
 * Stopping early (break, return, throw) cancels the stream.
 */
export const readNdjson = async function* <T = unknown>(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<T> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      // The last piece may be a partial line; keep it until more arrives.
      buffer = done ? "" : (lines.pop() ?? "");

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          yield JSON.parse(trimmed) as T;
        }
      }

      if (done) {
        return;
      }
    }
  } finally {
    // Frees the connection when the consumer stops early; a no-op once the
    // stream has ended.
    await reader.cancel().catch(() => undefined);
  }
};
