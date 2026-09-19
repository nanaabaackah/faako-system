// Self-contained structured logger for lightweight API handler bundling.
// It mirrors the shared logger surface and redacts secrets before serialization.

const SENSITIVE_KEY = /authorization|bearer|cookie|password|secret|token|api[-_]?key|database[-_]?url|connection[-_]?string|costprice|unitcost/i;
const SENSITIVE_TEXT = /(postgres(?:ql)?:\/\/)[^\s"']+|((?:bearer|basic)\s+)[^\s"']+/gi;
const APP_ENV = String(process.env.APP_ENV || process.env.NODE_ENV || "development");

const scrubText = (value) => String(value).replace(SENSITIVE_TEXT, (_match, databasePrefix, authPrefix) =>
  databasePrefix ? `${databasePrefix}[REDACTED]` : `${authPrefix}[REDACTED]`
);

const sanitize = (value, seen = new WeakSet()) => {
  if (typeof value === "string") return scrubText(value);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubText(value.message || "Error"),
      ...(value.code ? { code: scrubText(value.code) } : {}),
    };
  }
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) return value.map((entry) => sanitize(entry, seen));

  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitize(entry, seen);
  }
  return output;
};

const serialize = (level, name, bindings, obj, msg) => {
  const safeObject = obj && typeof obj === "object" ? sanitize(obj) : {};
  const errorDetail = safeObject.err || safeObject.error;
  const errorMessage = errorDetail?.message
    || (typeof errorDetail === "string" ? errorDetail : undefined);
  const rest = { ...safeObject };
  delete rest.err;
  delete rest.error;

  return JSON.stringify({
    level,
    time: new Date().toISOString(),
    application: "reebs-portal",
    component: name,
    environment: APP_ENV,
    ...sanitize(bindings),
    ...rest,
    ...(errorMessage ? { error: scrubText(errorMessage) } : {}),
    msg: scrubText(msg ?? (typeof obj === "string" ? obj : "")),
  });
};

const write = (method, level, name, bindings, obj, msg) =>
  console[method](serialize(level, name, bindings, obj, msg));

export const createLogger = (name, bindings = {}) => ({
  info: (obj, msg) => write("log", 30, name, bindings, obj, msg),
  warn: (obj, msg) => write("warn", 40, name, bindings, obj, msg),
  error: (obj, msg) => write("error", 50, name, bindings, obj, msg),
  debug: (obj, msg) => write("debug", 20, name, bindings, obj, msg),
  child: (childBindings) => createLogger(name, { ...bindings, ...sanitize(childBindings) }),
  silent: () => {},
});
