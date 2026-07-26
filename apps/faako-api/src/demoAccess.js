import crypto from "node:crypto";
import {
  API_ERROR_CODES,
  createCompatibleErrorResponse,
  createCompatibleSuccessResponse,
  errorCodeForStatus,
} from "@faako/api-contracts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,120}$/;
const CODE_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_EMAIL = 3;
const MAX_REQUESTS_PER_IP = 20;
const MAX_VERIFY_ATTEMPTS = 8;
const RESEND_EMAIL_URL = "https://api.resend.com/emails";
const LOCAL_EMAIL_FALLBACK = "dev@nanaabaackah.com";

const challenges = new Map();
const rateLimitBuckets = new Map();

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const sanitizeHeaderValue = (value, fallback = "") =>
  String(value || fallback)
    .replace(/[\r\n]/g, "")
    .trim();

const resolveRequestId = (value) => {
  const candidate = sanitizeHeaderValue(value);
  return REQUEST_ID_PATTERN.test(candidate) ? candidate : crypto.randomUUID();
};

const isProductionRuntime = () =>
  process.env.NODE_ENV === "production" ||
  process.env.APP_ENV === "production" ||
  process.env.APP_ENV === "prod";

const getLocalEmailRecipient = () =>
  EMAIL_PATTERN.test(normalizeEmail(process.env.EMAIL_FORCE_TO))
    ? normalizeEmail(process.env.EMAIL_FORCE_TO)
    : LOCAL_EMAIL_FALLBACK;

const resolveEmailDeliveryTarget = (email) => {
  const intendedEmail = normalizeEmail(email);
  if (isProductionRuntime()) {
    return {
      intendedEmail,
      deliveryEmail: intendedEmail,
      wasRerouted: false,
    };
  }

  const deliveryEmail = getLocalEmailRecipient();
  return {
    intendedEmail,
    deliveryEmail,
    wasRerouted: Boolean(intendedEmail) && deliveryEmail !== intendedEmail,
  };
};

const getClientIp = (req) =>
  String(req.headers["cf-connecting-ip"] || req.headers["x-real-ip"] || req.ip || "unknown")
    .split(",")[0]
    .trim();

const getDemoAccessSecret = () => {
  const secret = String(process.env.FAAKO_ERP_DEMO_ACCESS_SECRET || "").trim();
  if (secret.length >= 32) return secret;

  if (isProductionRuntime()) {
    return "";
  }

  return "development-only-faako-erp-demo-access-secret";
};

const createCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

const hashCode = ({ token, email, code }) =>
  crypto
    .createHmac("sha256", getDemoAccessSecret())
    .update(`${token}:${email}:${code}`)
    .digest("hex");

const pruneExpiredChallenges = () => {
  const now = Date.now();
  for (const [token, challenge] of challenges) {
    if (challenge.expiresAt <= now) {
      challenges.delete(token);
    }
  }
};

const consumeRateLimit = (key, maxAttempts) => {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }

  bucket.count += 1;

  if (bucket.count > maxAttempts) {
    return Math.ceil((bucket.resetAt - now) / 1000);
  }

  return null;
};

const jsonError = (
  res,
  status,
  message,
  {
    code = errorCodeForStatus(status),
    details,
    headers = {},
    issues,
    requestId,
    retryAfterSeconds,
  } = {},
) =>
  res
    .status(status)
    .set(headers)
    .json(
      createCompatibleErrorResponse(
        { code, message, details, issues },
        { requestId, retryAfterSeconds },
      ),
    );

const getConfiguredSender = () => {
  const email = sanitizeHeaderValue(process.env.RESEND_FROM_EMAIL);
  if (!email) return "";

  const name = sanitizeHeaderValue(process.env.RESEND_FROM_NAME || "Faako");
  return `${name} <${email}>`;
};

const sendDemoAccessEmail = async ({ email, code }) => {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = getConfiguredSender();
  const delivery = resolveEmailDeliveryTarget(email);

  if (!apiKey || !from || !delivery.deliveryEmail) {
    const error = new Error("Demo access email delivery is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const redirectText = delivery.wasRerouted
    ? [
        "",
        "Local email redirect active.",
        `Original recipient: ${delivery.intendedEmail || "none"}`,
        `Delivered to: ${delivery.deliveryEmail}`,
      ].join("\n")
    : "";
  const redirectHtml = delivery.wasRerouted
    ? [
        `<p><strong>Local email redirect active.</strong></p>`,
        `<p>Original recipient: ${delivery.intendedEmail || "none"}<br />`,
        `Delivered to: ${delivery.deliveryEmail}</p>`,
      ].join("")
    : "";

  const response = await fetch(RESEND_EMAIL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [delivery.deliveryEmail],
      subject: `${delivery.wasRerouted ? "[Local test] " : ""}Your Faako ERP demo access code`,
      text: `Your Faako ERP demo access code is ${code}. It expires in 15 minutes.${redirectText}`,
      html: `${redirectHtml}<p>Your Faako ERP demo access code is <strong>${code}</strong>.</p><p>It expires in 15 minutes.</p>`,
    }),
  });

  if (!response.ok) {
    const error = new Error("Unable to send the demo access email right now.");
    error.statusCode = 502;
    throw error;
  }
};

export const createDemoAccessHandler = ({ sendEmail = sendDemoAccessEmail } = {}) => {
  return async (req, res) => {
    const requestId = resolveRequestId(req.headers["x-request-id"]);
    res.set({ "X-Request-Id": requestId });

    let payload = req.body && typeof req.body === "object" ? req.body : {};
    if (typeof req.body === "string" && req.body.trim()) {
      try {
        payload = JSON.parse(req.body);
      } catch {
        return jsonError(res, 400, "Invalid demo access request.", {
          code: API_ERROR_CODES.BAD_REQUEST,
          requestId,
        });
      }
    }
    const action = String(payload.action || "").trim();
    const email = normalizeEmail(payload.email);
    const ip = getClientIp(req);

    if (!getDemoAccessSecret()) {
      return jsonError(res, 503, "Demo access email delivery is not configured.", {
        requestId,
      });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return jsonError(res, 400, "Enter a valid email address to receive the access code.", {
        issues: [
          {
            field: "email",
            code: "invalid_email",
            message: "Enter a valid email address to receive the access code.",
          },
        ],
        requestId,
      });
    }

    pruneExpiredChallenges();

    if (action === "request") {
      const emailRetryAfter = consumeRateLimit(`demo-access:request:email:${email}`, MAX_REQUESTS_PER_EMAIL);
      const ipRetryAfter = consumeRateLimit(`demo-access:request:ip:${ip}`, MAX_REQUESTS_PER_IP);
      const retryAfter = emailRetryAfter || ipRetryAfter;

      if (retryAfter) {
        return jsonError(res, 429, "Too many access-code requests. Please wait and try again.", {
          headers: {
            "Retry-After": String(retryAfter),
          },
          requestId,
          retryAfterSeconds: retryAfter,
        });
      }

      const code = createCode();
      const challengeToken = crypto.randomUUID();
      const expiresAt = Date.now() + CODE_TTL_MS;

      challenges.set(challengeToken, {
        email,
        codeHash: hashCode({ token: challengeToken, email, code }),
        attempts: 0,
        expiresAt,
      });

      try {
        await sendEmail({ email, code });
      } catch (error) {
        challenges.delete(challengeToken);
        return jsonError(
          res,
          error.statusCode || 502,
          error.statusCode === 503
            ? "Demo access email delivery is not configured."
            : "Unable to send the demo access email right now.",
          { requestId },
        );
      }

      const responseData = {
        challengeToken,
        deliveryMode: "email",
        message: `A 6-digit access code has been sent to ${email}.`,
      };
      return res.json(
        createCompatibleSuccessResponse(responseData, { requestId }),
      );
    }

    if (action === "verify") {
      const challengeToken = String(payload.challengeToken || "").trim();
      const code = String(payload.code || "").trim();
      const challenge = challenges.get(challengeToken);

      if (!/^\d{6}$/.test(code)) {
        return jsonError(res, 400, "Enter the 6-digit access code from your email.", {
          issues: [
            {
              field: "code",
              code: "invalid_code",
              message: "Enter the 6-digit access code from your email.",
            },
          ],
          requestId,
        });
      }

      if (!challenge || challenge.email !== email || challenge.expiresAt <= Date.now()) {
        return jsonError(res, 400, "The access code is invalid or expired. Request a fresh code.", {
          requestId,
        });
      }

      challenge.attempts += 1;
      if (challenge.attempts > MAX_VERIFY_ATTEMPTS) {
        challenges.delete(challengeToken);
        return jsonError(res, 429, "Too many verification attempts. Request a fresh code.", {
          requestId,
        });
      }

      const expectedHash = challenge.codeHash;
      const submittedHash = hashCode({ token: challengeToken, email, code });
      const valid = crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(submittedHash));

      if (!valid) {
        return jsonError(res, 400, "The access code is invalid or expired. Request a fresh code.", {
          requestId,
        });
      }

      challenges.delete(challengeToken);

      const responseData = {
        session: {
          email,
          grantedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        },
      };
      return res.json(
        createCompatibleSuccessResponse(responseData, { requestId }),
      );
    }

    return jsonError(res, 400, "Unsupported demo access action.", {
      code: API_ERROR_CODES.BAD_REQUEST,
      requestId,
    });
  };
};

export const resetDemoAccessStateForTests = () => {
  challenges.clear();
  rateLimitBuckets.clear();
};
