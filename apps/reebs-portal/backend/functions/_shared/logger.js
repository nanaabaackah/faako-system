// Self-contained structured logger for API handlers.
// Matches the @faako/logger interface so imports can be swapped freely.
// No external dependencies; safe for lightweight API handler bundling.

const serialize = (name, obj, msg) => {
  if (obj && typeof obj === "object") {
    const { err, error, ...rest } = obj;
    const errorDetail = err || error;
    const errorMsg = errorDetail?.message || (typeof errorDetail === "string" ? errorDetail : undefined);
    return JSON.stringify({ ...rest, ...(errorMsg ? { error: errorMsg } : {}), msg, logger: name });
  }
  return JSON.stringify({ msg: obj, logger: name });
};

export const createLogger = (name) => ({
  info:  (obj, msg) => console.log(serialize(name, obj, msg ?? obj)),
  warn:  (obj, msg) => console.warn(serialize(name, obj, msg ?? obj)),
  error: (obj, msg) => console.error(serialize(name, obj, msg ?? obj)),
  debug: (obj, msg) => console.debug(serialize(name, obj, msg ?? obj)),
  child: (bindings) => createLogger(`${name}:${JSON.stringify(bindings)}`),
  silent: () => {},
});
