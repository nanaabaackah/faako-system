const crypto = require("node:crypto");

const BASE_HEADERS = {
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "cache-control": "no-store",
  "content-security-policy":
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "content-type": "application/json; charset=utf-8",
  "permissions-policy": "camera=(), geolocation=(), microphone=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

const DEV_ALLOWED_ORIGINS = new Set([
  "http://localhost:5176",
  "http://127.0.0.1:5176",
  "http://localhost:8888",
  "http://127.0.0.1:8888",
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_REQUEST_BODY_BYTES = 8 * 1024;
const CHALLENGE_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_IP = 15;
const MAX_REQUESTS_PER_EMAIL = 5;
const MAX_VERIFY_ATTEMPTS_PER_IP = 40;
const RESEND_EMAILS_ENDPOINT = "https://api.resend.com/emails";
const requestRateLimitStore = global.__faakoErpDemoRequestRateLimitStore ?? new Map();
const verifyRateLimitStore = global.__faakoErpDemoVerifyRateLimitStore ?? new Map();

if (!global.__faakoErpDemoRequestRateLimitStore) {
  global.__faakoErpDemoRequestRateLimitStore = requestRateLimitStore;
}

if (!global.__faakoErpDemoVerifyRateLimitStore) {
  global.__faakoErpDemoVerifyRateLimitStore = verifyRateLimitStore;
}

const normalizeOrigin = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  try {
    return new URL(value.trim()).origin;
  } catch {
    return "";
  }
};

const getHeader = (event, name) => {
  if (!event?.headers) {
    return "";
  }

  return String(event.headers[name] || event.headers[name.toLowerCase()] || "").trim();
};

const getRequestOrigin = (event) => {
  const origin = normalizeOrigin(getHeader(event, "origin"));

  if (origin) {
    return origin;
  }

  const referer = getHeader(event, "referer");

  if (!referer) {
    return "";
  }

  try {
    return new URL(referer).origin;
  } catch {
    return "";
  }
};

const getSiteOrigin = (event) => {
  const forwardedProto = getHeader(event, "x-forwarded-proto") || "https";
  const forwardedHost = getHeader(event, "x-forwarded-host") || getHeader(event, "host");

  if (forwardedHost) {
    return normalizeOrigin(`${forwardedProto}://${forwardedHost}`);
  }

  const candidates = [
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.DEPLOY_URL,
    process.env.SITE_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeOrigin(candidate);

    if (normalized) {
      return normalized;
    }
  }

  return "";
};

const getAllowedOrigins = (event) => {
  const allowedOrigins = new Set(DEV_ALLOWED_ORIGINS);
  const configuredOrigins = String(
    process.env.FAAKO_ERP_DEMO_ACCESS_ALLOWED_ORIGINS || "",
  ).trim();

  if (configuredOrigins) {
    configuredOrigins
      .split(",")
      .map((value) => normalizeOrigin(value))
      .filter(Boolean)
      .forEach((value) => allowedOrigins.add(value));
  }

  const siteOrigin = getSiteOrigin(event);

  if (siteOrigin) {
    allowedOrigins.add(siteOrigin);
  }

  return allowedOrigins;
};

const buildHeaders = (event) => {
  const headers = { ...BASE_HEADERS };
  const requestOrigin = getRequestOrigin(event);
  const allowedOrigins = getAllowedOrigins(event);

  if (requestOrigin && allowedOrigins.has(requestOrigin)) {
    headers["access-control-allow-origin"] = requestOrigin;
    headers.vary = "origin";
  }

  return headers;
};

const jsonResponse = (event, statusCode, payload) => ({
  statusCode,
  headers: buildHeaders(event),
  body: JSON.stringify(payload),
});

const readRequestBody = (event) => {
  if (!event?.body) {
    return "";
  }

  return event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : String(event.body);
};

const normalizeEmail = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return EMAIL_PATTERN.test(normalized) ? normalized : "";
};

const getClientKey = (event) => {
  const candidates = [
    getHeader(event, "x-nf-client-connection-ip"),
    getHeader(event, "client-ip"),
    getHeader(event, "x-forwarded-for"),
    getHeader(event, "x-real-ip"),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const [first] = candidate.split(",");
    const normalized = first.trim();

    if (normalized) {
      return normalized;
    }
  }

  return "unknown";
};

const pruneExpiredBuckets = (store) => {
  const now = Date.now();

  for (const [key, bucket] of store.entries()) {
    if (!bucket || bucket.resetAt <= now) {
      store.delete(key);
    }
  }
};

const consumeRateLimit = (store, key, limit) => {
  pruneExpiredBuckets(store);

  const now = Date.now();
  const existingBucket = store.get(key);

  if (!existingBucket || existingBucket.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });

    return {
      limited: false,
      retryAfterSeconds: 0,
    };
  }

  if (existingBucket.count >= limit) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existingBucket.resetAt - now) / 1000),
      ),
    };
  }

  existingBucket.count += 1;
  store.set(key, existingBucket);

  return {
    limited: false,
    retryAfterSeconds: 0,
  };
};

const isNonProduction = () => {
  const context = String(process.env.CONTEXT || process.env.NODE_ENV || "")
    .trim()
    .toLowerCase();

  return !context || context === "dev" || context === "development" || context === "preview";
};

const getSecret = () => {
  const explicitSecret = String(process.env.FAAKO_ERP_DEMO_ACCESS_SECRET || "").trim();

  if (explicitSecret) {
    return explicitSecret;
  }

  if (isNonProduction()) {
    return "faako-erp-demo-access-dev-secret";
  }

  return "";
};

const encodeBase64Url = (value) => Buffer.from(value).toString("base64url");
const decodeBase64Url = (value) => Buffer.from(value, "base64url").toString("utf8");

const signToken = (payload, secret) => {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
};

const signaturesMatch = (provided, expected) => {
  try {
    const providedBuffer = Buffer.from(provided, "base64url");
    const expectedBuffer = Buffer.from(expected, "base64url");

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  } catch {
    return false;
  }
};

const verifyToken = (token, secret) => {
  const [encodedPayload, signature] = String(token || "").split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  if (!signaturesMatch(signature, expectedSignature)) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(encodedPayload));
  } catch {
    return null;
  }
};

const buildCodeHash = ({ email, code, secret }) =>
  crypto.createHash("sha256").update(`${email}:${code}:${secret}`).digest("hex");

const createAccessCode = () =>
  String(crypto.randomInt(0, 1000000)).padStart(6, "0");

const formatExpiry = (expiresAt) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(expiresAt));

const buildEmailText = ({ email, code, expiresAt }) =>
  [
    "Your Faako ERP demo access code is ready.",
    "",
    `Email: ${email}`,
    `Access code: ${code}`,
    `Expires: ${formatExpiry(expiresAt)}`,
    "",
    "Enter this 6-digit code in the Faako ERP demo popup to unlock the walkthrough.",
  ].join("\n");

const buildEmailHtml = ({ email, code, expiresAt }) => `
  <div style="font-family:Arial,sans-serif;background:#f6fbf8;padding:24px;color:#1f2d27;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid rgba(35,88,66,0.14);border-radius:22px;overflow:hidden;">
      <div style="padding:28px 30px;background:linear-gradient(135deg,#235842 0%,#388364 100%);color:#ffffff;">
        <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.78;">Faako ERP</div>
        <h1 style="margin:12px 0 0;font-size:28px;line-height:1.15;">Your demo access code</h1>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.6;opacity:0.92;">Use this one-time code to unlock the live Faako ERP walkthrough.</p>
      </div>
      <div style="padding:28px 30px;">
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#466457;">Requested for ${email}</p>
        <div style="margin:0 0 16px;padding:18px 20px;border-radius:18px;border:1px solid rgba(35,88,66,0.14);background:#f6fbf8;text-align:center;">
          <div style="font-size:32px;letter-spacing:0.3em;font-weight:700;color:#235842;">${code}</div>
        </div>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#466457;">This code expires at ${formatExpiry(expiresAt)}.</p>
      </div>
    </div>
  </div>
`;

const getEmailConfig = () => ({
  apiKey: String(process.env.RESEND_API_KEY || "").trim(),
  from: String(process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM || "").trim(),
  fromName: String(process.env.RESEND_FROM_NAME || "Faako").trim(),
});

const sendAccessCodeEmail = async ({ email, code, expiresAt }) => {
  const emailConfig = getEmailConfig();

  if (!emailConfig.apiKey || !emailConfig.from) {
    return {
      mode: "preview",
      previewCode: code,
      message: `Preview mode: use the 6-digit code prepared for ${email}.`,
    };
  }

  const response = await fetch(RESEND_EMAILS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${emailConfig.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${emailConfig.fromName} <${emailConfig.from}>`,
      to: [email],
      subject: "Your Faako ERP demo access code",
      text: buildEmailText({ email, code, expiresAt }),
      html: buildEmailHtml({ email, code, expiresAt }),
    }),
  });

  if (!response.ok) {
    return {
      mode: "preview",
      previewCode: code,
      message:
        "Email delivery failed, so the access code is shown here directly.",
    };
  }

  return {
    mode: "email",
    previewCode: "",
    message: `We sent a 6-digit access code to ${email}.`,
  };
};

const ensureAllowedOrigin = (event) => {
  const origin = getRequestOrigin(event);

  if (!origin) {
    return true;
  }

  return getAllowedOrigins(event).has(origin);
};

const handleRequestAction = async (event, payload) => {
  const secret = getSecret();

  if (!secret) {
    return jsonResponse(event, 503, {
      ok: false,
      error:
        "Demo access signing is not configured. Add FAAKO_ERP_DEMO_ACCESS_SECRET to this site.",
    });
  }

  const email = normalizeEmail(payload.email);

  if (!email) {
    return jsonResponse(event, 400, {
      ok: false,
      error: "A valid email address is required.",
    });
  }

  const clientKey = getClientKey(event);
  const ipRateLimit = consumeRateLimit(
    requestRateLimitStore,
    `ip:${clientKey}`,
    MAX_REQUESTS_PER_IP,
  );

  if (ipRateLimit.limited) {
    return jsonResponse(event, 429, {
      ok: false,
      error: `Too many requests. Try again in ${ipRateLimit.retryAfterSeconds} seconds.`,
    });
  }

  const emailRateLimit = consumeRateLimit(
    requestRateLimitStore,
    `email:${email}`,
    MAX_REQUESTS_PER_EMAIL,
  );

  if (emailRateLimit.limited) {
    return jsonResponse(event, 429, {
      ok: false,
      error: `Too many codes were requested for this email. Try again in ${emailRateLimit.retryAfterSeconds} seconds.`,
    });
  }

  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const code = createAccessCode();
  const challengeToken = signToken(
    {
      type: "faako-demo-access-challenge",
      email,
      issuedAt,
      expiresAt,
      codeHash: buildCodeHash({ email, code, secret }),
    },
    secret,
  );

  const deliveryResult = await sendAccessCodeEmail({
    email,
    code,
    expiresAt,
  });

  return jsonResponse(event, 200, {
    ok: true,
    challengeToken,
    expiresAt,
    deliveryMode: deliveryResult.mode,
    previewCode: deliveryResult.previewCode || undefined,
    message: deliveryResult.message,
  });
};

const handleVerifyAction = async (event, payload) => {
  const secret = getSecret();

  if (!secret) {
    return jsonResponse(event, 503, {
      ok: false,
      error:
        "Demo access signing is not configured. Add FAAKO_ERP_DEMO_ACCESS_SECRET to this site.",
    });
  }

  const email = normalizeEmail(payload.email);
  const code = String(payload.code || "").trim();
  const challengeToken = String(payload.challengeToken || "").trim();

  if (!email || !/^\d{6}$/.test(code) || !challengeToken) {
    return jsonResponse(event, 400, {
      ok: false,
      error: "Email, challenge token, and a valid 6-digit code are required.",
    });
  }

  const clientKey = getClientKey(event);
  const verifyRateLimit = consumeRateLimit(
    verifyRateLimitStore,
    `verify:${clientKey}`,
    MAX_VERIFY_ATTEMPTS_PER_IP,
  );

  if (verifyRateLimit.limited) {
    return jsonResponse(event, 429, {
      ok: false,
      error: `Too many verification attempts. Try again in ${verifyRateLimit.retryAfterSeconds} seconds.`,
    });
  }

  const challenge = verifyToken(challengeToken, secret);

  if (!challenge || challenge.type !== "faako-demo-access-challenge") {
    return jsonResponse(event, 401, {
      ok: false,
      error: "This access request is no longer valid. Request a new code.",
    });
  }

  if (challenge.email !== email) {
    return jsonResponse(event, 401, {
      ok: false,
      error: "The access code email does not match this request.",
    });
  }

  if (Date.parse(challenge.expiresAt) <= Date.now()) {
    return jsonResponse(event, 401, {
      ok: false,
      error: "This access code has expired. Request a new one to continue.",
    });
  }

  const codeHash = buildCodeHash({ email, code, secret });

  const codeHashMatches = (() => {
    try {
      const a = Buffer.from(codeHash, "hex");
      const b = Buffer.from(challenge.codeHash, "hex");
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  })();

  if (!codeHashMatches) {
    return jsonResponse(event, 401, {
      ok: false,
      error: "The access code is incorrect. Check the email and try again.",
    });
  }

  const grantedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const accessToken = signToken(
    {
      type: "faako-demo-access-session",
      email,
      grantedAt,
      expiresAt,
    },
    secret,
  );

  return jsonResponse(event, 200, {
    ok: true,
    message: "Demo access granted.",
    session: {
      email,
      grantedAt,
      expiresAt,
      accessToken,
    },
  });
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: buildHeaders(event),
      body: "",
    };
  }

  if (!ensureAllowedOrigin(event)) {
    return jsonResponse(event, 403, {
      ok: false,
      error: "This origin is not allowed to request demo access.",
    });
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(event, 405, {
      ok: false,
      error: "Method not allowed.",
    });
  }

  try {
    const rawBody = readRequestBody(event);

    if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BODY_BYTES) {
      return jsonResponse(event, 413, {
        ok: false,
        error: "Request body is too large.",
      });
    }

    let payload = {};

    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return jsonResponse(event, 400, {
          ok: false,
          error: "Request body must be valid JSON.",
        });
      }
    }

    if (payload.action === "request") {
      return handleRequestAction(event, payload);
    }

    if (payload.action === "verify") {
      return handleVerifyAction(event, payload);
    }

    return jsonResponse(event, 400, {
      ok: false,
      error: "Unsupported action.",
    });
  } catch (error) {
    console.error("faako-erp demo-access error:", error);

    return jsonResponse(event, 500, {
      ok: false,
      error: "The demo access flow is temporarily unavailable.",
    });
  }
};
