import pino from "pino";

/**
 * Creates a named logger. Uses Pino in Node.js server environments and
 * can fall back to structured console logging for lightweight API service
 * runtimes where Pino's transport layer is unavailable.
 *
 * Usage:
 *   import { createLogger } from "@faako/logger";
 *   const logger = createLogger("auth");
 *   logger.info({ userId: 1 }, "User logged in");
 *   logger.error({ err }, "Login failed");
 */

const shouldUseConsoleLogger = Boolean(
  typeof process !== "undefined" &&
    process.env.FAAKO_LOGGER_MODE === "console"
);

const createConsoleLogger = (name) => {
  const prefix = `[${name}]`;
  const serialize = (obj, msg) => {
    if (obj && typeof obj === "object") {
      const { err, error, ...rest } = obj;
      const errorMsg = (err || error)?.message || (err || error) || undefined;
      return { ...rest, ...(errorMsg ? { error: errorMsg } : {}), msg, logger: name };
    }
    return { msg: obj, logger: name };
  };

  return {
    info: (obj, msg) => console.log(JSON.stringify(serialize(obj, msg ?? obj))),
    warn: (obj, msg) => console.warn(JSON.stringify(serialize(obj, msg ?? obj))),
    error: (obj, msg) => console.error(JSON.stringify(serialize(obj, msg ?? obj))),
    debug: (obj, msg) => console.debug(JSON.stringify(serialize(obj, msg ?? obj))),
    child: (bindings) => createConsoleLogger(`${name}:${JSON.stringify(bindings)}`),
    silent: () => {},
  };
};

const rootLogger = !shouldUseConsoleLogger
  ? pino({
      level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
      base: { pid: process.pid },
      timestamp: pino.stdTimeFunctions.isoTime,
    })
  : null;

export const createLogger = (name) => {
  if (shouldUseConsoleLogger || !rootLogger) {
    return createConsoleLogger(name);
  }
  return rootLogger.child({ name });
};
