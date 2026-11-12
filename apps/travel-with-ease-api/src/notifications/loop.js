import { setTimeout as delay } from "node:timers/promises";

// One job at a time; the outbox remains authoritative for leases and retries.
export async function runNotificationLoop({
  tick,
  signal,
  wait = (ms, abortSignal) => delay(ms, undefined, { signal: abortSignal }),
}) {
  while (!signal.aborted) {
    const attempted = await tick();
    if (signal.aborted) break;
    try {
      // Avoid a tight loop and respect the provider's ordinary request budget.
      await wait(attempted ? 600 : 5000, signal);
    } catch (error) {
      if (!signal.aborted) throw error;
    }
  }
}
