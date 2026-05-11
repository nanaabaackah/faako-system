const toIso = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

export const createRetryMetadata = (options = {}) => ({
  attempts: Number.isFinite(Number(options.attempts)) ? Number(options.attempts) : 0,
  maxAttempts: Number.isFinite(Number(options.maxAttempts)) ? Number(options.maxAttempts) : 5,
  firstAttemptAt: options.firstAttemptAt || "",
  lastAttemptAt: options.lastAttemptAt || "",
  nextAttemptAt: options.nextAttemptAt || "",
  lastError: options.lastError || "",
});

export const getRetryDelayMs = (attempts = 0, options = {}) => {
  const baseDelayMs = Number.isFinite(Number(options.baseDelayMs)) ? Number(options.baseDelayMs) : 30_000;
  const maxDelayMs = Number.isFinite(Number(options.maxDelayMs)) ? Number(options.maxDelayMs) : 15 * 60_000;
  const exponent = Math.max(Number(attempts) || 0, 0);
  return Math.min(baseDelayMs * 2 ** exponent, maxDelayMs);
};

export const incrementRetryMetadata = (retry = {}, options = {}) => {
  const now = options.now instanceof Date ? options.now : new Date();
  const current = createRetryMetadata(retry);
  const attempts = current.attempts + 1;
  const delayMs = getRetryDelayMs(attempts, options);
  const nextAttemptAt = new Date(now.getTime() + delayMs).toISOString();

  return {
    ...current,
    attempts,
    firstAttemptAt: current.firstAttemptAt || toIso(now),
    lastAttemptAt: toIso(now),
    nextAttemptAt,
    lastError: options.lastError || current.lastError,
  };
};

export const shouldRetryQueueItem = (item = {}, options = {}) => {
  const retry = createRetryMetadata(item.retry);
  if (retry.attempts >= retry.maxAttempts) return false;
  if (!retry.nextAttemptAt) return true;
  const now = options.now instanceof Date ? options.now : new Date();
  return new Date(retry.nextAttemptAt).getTime() <= now.getTime();
};
