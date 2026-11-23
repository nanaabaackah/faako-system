const defaultSleep = (milliseconds, signal) =>
  new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    let timer;
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    timer = setTimeout(finish, milliseconds);
    signal?.addEventListener("abort", finish, { once: true });
  });

const MIN_RECONCILIATION_INTERVAL_MS = 60_000;

export async function runPublicationLoop({ runOnce, signal, intervalMs = 15_000,
  sleep = defaultSleep, logger = {} }) {
  if (typeof runOnce !== "function" || !Number.isInteger(intervalMs) || intervalMs < 1_000)
    throw new Error("Publication loop configuration is invalid.");
  let blockedJobId = null;
  while (!signal?.aborted) {
    const result = await runOnce();
    if (result.status === "recovery_required") {
      // The database still holds the original deploying/verifying job. Leave it
      // untouched and never claim another job until its exact Pages marker can
      // be reconciled. Missing evidence is not a reason to crash/redeploy the
      // continuous Railway service.
      if (blockedJobId !== result.id) {
        logger.warn?.({
          eventName: "publication.reconciliation_waiting",
          jobId: result.id,
        }, "Publication requires provider verification; worker remains available without starting another deployment.");
      }
      blockedJobId = result.id;
      if (!signal?.aborted) await sleep(Math.max(intervalMs, MIN_RECONCILIATION_INTERVAL_MS), signal);
      continue;
    }
    if (blockedJobId) {
      logger.info?.({ eventName: "publication.reconciliation_resumed", jobId: blockedJobId, status: result.status },
        "Publication reconciliation is no longer blocked.");
      blockedJobId = null;
    }
    logger.info?.({ eventName: "publication.worker_cycle", status: result.status, jobId: result.id }, "Publication worker cycle completed.");
    if (!signal?.aborted) await sleep(intervalMs, signal);
  }
  return { status: "stopped" };
}
