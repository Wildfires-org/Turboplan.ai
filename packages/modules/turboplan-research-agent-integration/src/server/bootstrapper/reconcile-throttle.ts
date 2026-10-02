/**
 * Webhooks bump the run's `updatedAt` on every progress update, so an active
 * run that has been quiet this long may have finished without its final
 * webhook reaching us. Only then is the external agent worth asking.
 */
export const RECONCILE_STALE_AFTER_MS = 60_000;

/**
 * Whether the status poll should check the external agent for an active run.
 * Kept free of DB imports so it can be unit-tested in isolation.
 */
export const isExternalReconcileDue = (updatedAt: Date, now: Date): boolean => {
  return now.getTime() - updatedAt.getTime() >= RECONCILE_STALE_AFTER_MS;
};
