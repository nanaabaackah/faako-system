import pino from "pino";
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@faako/api-contracts";

export const LOG_LEVELS = Object.freeze([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
]);

export const REDACTED_LOG_VALUE = "[REDACTED]";

const SENSITIVE_KEY_PARTS = Object.freeze([
  "password",
  "passwd",
  "authorization",
  "cookie",
  "sessioncookie",
  "accesstoken",
  "refreshtoken",
  "authtoken",
  "bearertoken",
  "token",
  "secret",
  "apikey",
  "privatekey",
  "signingkey",
  "encryptionkey",
  "cardnumber",
  "creditcard",
  "cvv",
  "cvc",
  "paymentcredential",
  "mobilemoneypin",
  "email",
  "phone",
  "address",
  "firstname",
  "lastname",
  "fullname",
  "dateofbirth",
]);

const normalizeKey = (value) =>
  String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const redactSensitiveString = (value) =>
  String(value)
    .replace(
      /\b(bearer)\s+[a-z0-9._~+/=-]+/gi,
      `$1 ${REDACTED_LOG_VALUE}`,
    )
    .replace(
      /\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/gi,
      REDACTED_LOG_VALUE,
    )
    .replace(
      /\b(password|passwd|authorization|cookie|session|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|secret|api[_-]?key|private[_-]?key|signing[_-]?key|encryption[_-]?key|card[_-]?number|cvv|cvc|pin)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      (_match, key) => `${key}=${REDACTED_LOG_VALUE}`,
    )
    .replace(
      /\b([a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+):([^@\s/]+)@/gi,
      `$1${REDACTED_LOG_VALUE}@`,
    )
    .replace(
      /\b[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\b/gi,
      REDACTED_LOG_VALUE,
    )
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, REDACTED_LOG_VALUE)
    .replace(/\+\d[\d\s().-]{7,}\d/g, REDACTED_LOG_VALUE);

export const isSensitiveLogKey = (key) => {
  const normalized = normalizeKey(key);
  return Boolean(
    normalized &&
      SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part)),
  );
};

const serializeError = (error, { includeStack = false } = {}) => ({
  type: String(error?.name || "Error"),
  message: redactSensitiveString(error?.message || "Unknown error").slice(0, 500),
  ...(error?.code ? { code: String(error.code).slice(0, 120) } : {}),
  ...(includeStack && error?.stack
    ? { stack: redactSensitiveString(error.stack).slice(0, 4_000) }
    : {}),
});

export const redactLogValue = (
  value,
  { includeErrorStack = false, maxDepth = 8 } = {},
) => {
  const seen = new WeakSet();

  const visit = (candidate, depth) => {
    if (candidate instanceof Error) {
      return serializeError(candidate, { includeStack: includeErrorStack });
    }
    if (
      candidate === null ||
      candidate === undefined ||
      typeof candidate === "number" ||
      typeof candidate === "boolean"
    ) {
      return candidate;
    }
    if (typeof candidate === "string") return redactSensitiveString(candidate);
    if (typeof candidate === "bigint") return String(candidate);
    if (typeof candidate === "function" || typeof candidate === "symbol") {
      return undefined;
    }
    if (depth >= maxDepth) return "[TRUNCATED]";
    if (seen.has(candidate)) return "[CIRCULAR]";
    seen.add(candidate);

    if (Array.isArray(candidate)) {
      return candidate.map((entry) => visit(entry, depth + 1));
    }

    return Object.fromEntries(
      Object.entries(candidate)
        .map(([key, entry]) => [
          key,
          isSensitiveLogKey(key)
            ? REDACTED_LOG_VALUE
            : visit(entry, depth + 1),
        ])
        .filter(([, entry]) => entry !== undefined),
    );
  };

  return visit(value, 0);
};

export const buildLogContext = ({
  application,
  component,
  environment,
  eventName,
  requestId,
  organisationId,
  organizationId,
  userId,
  ...extra
} = {}) =>
  redactLogValue({
    ...(application ? { application: String(application) } : {}),
    ...(component ? { component: String(component) } : {}),
    ...(environment ? { environment: String(environment) } : {}),
    ...(eventName ? { eventName: String(eventName) } : {}),
    ...(requestId ? { requestId: String(requestId) } : {}),
    ...((organisationId ?? organizationId) != null
      ? { organisationId: String(organisationId ?? organizationId) }
      : {}),
    ...(userId != null ? { userId: String(userId) } : {}),
    ...extra,
  });

const shouldUseConsoleLogger = Boolean(
  typeof process !== "undefined" &&
    process.env.FAAKO_LOGGER_MODE === "console",
);

const environment =
  typeof process !== "undefined"
    ? process.env.APP_ENV || process.env.NODE_ENV || "development"
    : "browser";
const includeErrorStack = environment !== "production";

const normalizeLogArguments = (objectOrMessage, message) => {
  if (
    objectOrMessage &&
    typeof objectOrMessage === "object" &&
    !Array.isArray(objectOrMessage)
  ) {
    return {
      fields: redactLogValue(objectOrMessage, { includeErrorStack }),
      message: redactSensitiveString(message || "Application event"),
    };
  }
  return {
    fields: {},
    message: redactSensitiveString(
      message ?? objectOrMessage ?? "Application event",
    ),
  };
};

const createConsoleLogger = (bindings = {}) => {
  const write = (method, objectOrMessage, message) => {
    const normalized = normalizeLogArguments(objectOrMessage, message);
    const record = {
      level: method,
      time: new Date().toISOString(),
      ...redactLogValue(bindings),
      ...normalized.fields,
      msg: normalized.message,
    };
    const consoleMethod =
      method === "warn"
        ? console.warn
        : method === "error" || method === "fatal"
          ? console.error
          : method === "debug" || method === "trace"
            ? console.debug
            : console.log;
    consoleMethod(JSON.stringify(record));
  };

  return {
    fatal: (object, message) => write("fatal", object, message),
    error: (object, message) => write("error", object, message),
    warn: (object, message) => write("warn", object, message),
    info: (object, message) => write("info", object, message),
    debug: (object, message) => write("debug", object, message),
    trace: (object, message) => write("trace", object, message),
    child: (childBindings = {}) =>
      createConsoleLogger({
        ...bindings,
        ...redactLogValue(childBindings),
      }),
    silent: () => {},
  };
};

const rootLogger = !shouldUseConsoleLogger
  ? pino({
      level:
        process.env.LOG_LEVEL ||
        (environment === "production" ? "info" : "debug"),
      base: { pid: process.pid, environment },
      timestamp: pino.stdTimeFunctions.isoTime,
    })
  : null;

const createPinoFacade = (logger) => {
  const write = (method, objectOrMessage, message) => {
    const normalized = normalizeLogArguments(objectOrMessage, message);
    logger[method](normalized.fields, normalized.message);
  };
  return {
    fatal: (object, message) => write("fatal", object, message),
    error: (object, message) => write("error", object, message),
    warn: (object, message) => write("warn", object, message),
    info: (object, message) => write("info", object, message),
    debug: (object, message) => write("debug", object, message),
    trace: (object, message) => write("trace", object, message),
    child: (bindings = {}) =>
      createPinoFacade(logger.child(redactLogValue(bindings))),
    silent: () => {},
  };
};

export const createLogger = (
  application,
  { component, bindings = {}, environment: requestedEnvironment } = {},
) => {
  const baseBindings = buildLogContext({
    application,
    component,
    environment: requestedEnvironment || environment,
    ...bindings,
  });

  if (shouldUseConsoleLogger || !rootLogger) {
    return createConsoleLogger(baseBindings);
  }
  return createPinoFacade(rootLogger.child(baseBindings));
};

export const createRequestContextMiddleware =
  ({
    application,
    component = "http",
    environment: requestedEnvironment,
    requestIdFactory,
  } = {}) =>
  (req, res, next) => {
    const requestId = resolveRequestId(
      req?.headers?.["x-request-id"],
      requestIdFactory,
    );
    req.requestId = requestId;
    if (req?.headers) req.headers["x-request-id"] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const logger = createLogger(application || "application", {
      component,
      environment: requestedEnvironment,
    });
    req.log = logger.child({ requestId });
    next();
  };
