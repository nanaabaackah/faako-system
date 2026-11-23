const defaultSleep = (milliseconds, signal) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });

export async function runPublicationLoop({ runOnce, signal, intervalMs = 15_000,
  sleep = defaultSleep, logger = {} }) {
  if (typeof runOnce !== "function" || !Number.isInteger(intervalMs) || intervalMs < 1_000)
    throw new Error("Publication loop configuration is invalid.");
  while (!signal?.aborted) {
    const result = await runOnce();
    logger.info?.({ eventName: "publication.worker_cycle", status: result.status, jobId: result.id }, "Publication worker cycle completed.");
    // Uncertain deployments remain active in PostgreSQL, so no new job can be
    // claimed while this loop polls for an exact provider-marker reconciliation.
    // Stop only when provider evidence is missing and operator review is needed.
    if (result.status === "recovery_required") return result;
    if (!signal?.aborted) await sleep(intervalMs, signal);
  }
  return { status: "stopped" };
}
