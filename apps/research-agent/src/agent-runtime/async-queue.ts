/**
 * Async queue enabling producer-consumer communication via the async-iterator protocol.
 * Acts as a bridge between stdin (where messages arrive from the run manager) and
 * Claude Agent SDK (which consumes them via `streamInput`).
 *
 * How it works:
 * - Producer pushes values via `push()`.
 * - Consumer reads them via `for await...of` (async iterator).
 * - If the consumer is waiting and no values are available — it's suspended (Promise)
 *   until the producer calls `push()`.
 * - If the producer pushes a value and no one is waiting — the value is buffered.
 * - `close()` terminates the queue and resolves all pending consumers with a `done` signal.
 */
export class AsyncQueue<T> implements AsyncIterable<T> {
  /** Buffer of values waiting to be consumed */
  private values: T[] = [];
  /** List of resolve callbacks from consumers waiting for the next value */
  private waiting: ((value: IteratorResult<T>) => void)[] = [];
  private closed = false;

  /** Enqueues a value. If a consumer is already waiting, it receives the value immediately without buffering. */
  push(value: T): void {
    if (this.closed) return;
    const waiter = this.waiting.shift();
    if (waiter) {
      waiter({ done: false, value });
      return;
    }
    this.values.push(value);
  }

  /** Closes the queue — no new values will be accepted and all pending consumers receive a termination signal. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    while (this.waiting.length > 0) {
      const waiter = this.waiting.shift();
      waiter?.({ done: true, value: undefined as never });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        // If buffer has values — return immediately
        if (this.values.length > 0) {
          const value = this.values.shift() as T;
          return Promise.resolve({ done: false, value });
        }
        // Queue is closed and empty — end of iteration
        if (this.closed) {
          return Promise.resolve({ done: true, value: undefined as never });
        }
        // No values available — suspend the consumer until the producer calls push()
        return new Promise<IteratorResult<T>>((resolve) => {
          this.waiting.push(resolve);
        });
      },
    };
  }
}
