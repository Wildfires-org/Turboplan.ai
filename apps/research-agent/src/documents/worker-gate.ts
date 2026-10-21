/**
 * One document worker thread at a time across the extraction and letterhead
 * loops: each loop already runs its documents one by one, and this gate keeps
 * the two loops from running theirs side by side on the 512MB machine. Tasks
 * run in the order they asked, each after the previous one settled (resolved
 * or rejected). A task only starts — and so only spawns its worker and starts
 * its timeout — once it holds the gate.
 */

export type WorkerGate = <T>(task: () => Promise<T>) => Promise<T>;

export const createWorkerGate = (): WorkerGate => {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  };
};

/** No gate: the task runs straight away (tests, scripts). */
export const runUngated: WorkerGate = (task) => task();
