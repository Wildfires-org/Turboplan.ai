/** Why `readCapped` gave no bytes. */
export type CappedReadFailure = "too_large" | "timeout";

const concatChunks = (chunks: Uint8Array[], length: number): Uint8Array => {
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return data;
};

/**
 * Read a web stream to its end, keeping at most `maxBytes`: what arrives is
 * counted, whatever length the source declared, so the cap holds for a body
 * that understates or omits its length. Past the cap ("too_large"), or once
 * `signal` aborts ("timeout"), the stream is cancelled — the connection is
 * never left half-read and nothing more is buffered. A stream that errors
 * rejects with its error. Runs on Node and on Workers (web streams only).
 */
export const readCapped = async (
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<Uint8Array | CappedReadFailure> => {
  const reader = stream.getReader();
  const cancel = () => {
    reader.cancel().catch(() => {});
  };
  if (signal?.aborted) {
    cancel();
    return "timeout";
  }
  // A pending read resolves as done once the reader is cancelled.
  signal?.addEventListener("abort", cancel, { once: true });

  try {
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (signal?.aborted) {
        return "timeout";
      }
      if (done) {
        return concatChunks(chunks, length);
      }
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel().catch(() => {});
        return "too_large";
      }
      chunks.push(value);
    }
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
};
