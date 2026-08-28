/* eslint-disable no-undef */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import {
  applyRequestOrganizationContext,
  resolveConfiguredPublicOrganizationId,
} from "./_shared/organization.js";
import {
  applyWindowRateLimit,
  getRequestClientIp,
} from "./_shared/requestRateLimit.js";
import {
  buildResponseHeaders,
  isAllowedAppOrigin,
  isCrossSiteBrowserRequest,
} from "./_shared/http.js";
import { getHeaderValue } from "./_shared/shopOrders.js";
import {
  COMMERCIAL_BUSINESS_UNITS,
  COMMERCIAL_CONFIG_KEYS,
  resolveCommercialConfiguration,
} from "./_shared/commercialConfig.js";

const PUBLIC_COMMERCIAL_CONFIG_METHODS = "GET,OPTIONS";

const json = (event, statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    ...buildResponseHeaders(event, {
      methods: PUBLIC_COMMERCIAL_CONFIG_METHODS,
      headers: "Content-Type,X-Request-Id",
    }),
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...extraHeaders,
  },
  body: statusCode === 204 ? "" : JSON.stringify(body),
});

export const buildPublicCommercialTerms = ({ records = [], effectiveAt = new Date() } = {}) => {
  const byKey = new Map(records.map((record) => [record.key, record]));
  const required = (key) => {
    const record = byKey.get(key);
    if (!record) {
      const error = new Error(`Required public commercial configuration ${key} is missing.`);
      error.statusCode = 503;
      error.code = "MISSING_COMMERCIAL_CONFIGURATION";
      throw error;
    }
    return record;
  };

  const bundleMinimum = required(COMMERCIAL_CONFIG_KEYS.BOOKING_BUNDLE_MIN_ITEMS);
  const bundleDiscount = required(COMMERCIAL_CONFIG_KEYS.BOOKING_BUNDLE_DISCOUNT_BPS);
  const attendantFee = required(COMMERCIAL_CONFIG_KEYS.BOOKING_ATTENDANT_UNIT_FEE_CENTS);
  const serviceDeposit = required(COMMERCIAL_CONFIG_KEYS.SERVICE_DEPOSIT_BPS);
  const serviceDepositDue = required(COMMERCIAL_CONFIG_KEYS.SERVICE_DEPOSIT_DUE_DAYS);

  return {
    scope: "reebs-core",
    businessUnit: COMMERCIAL_BUSINESS_UNITS.REEBS_CORE,
    currency: "GHS",
    effectiveAt: new Date(effectiveAt).toISOString(),
    booking: {
      bundleMinimumItems: bundleMinimum.value,
      bundleDiscountBps: bundleDiscount.value,
      attendantUnitFeeCents: attendantFee.value,
    },
    paymentTerms: {
      serviceDepositBps: serviceDeposit.value,
      serviceDepositDueDays: serviceDepositDue.value,
    },
    configurationIds: {
      bundleMinimumItems: bundleMinimum.id,
      bundleDiscount: bundleDiscount.id,
      attendantFee: attendantFee.id,
      serviceDeposit: serviceDeposit.id,
      serviceDepositDue: serviceDepositDue.id,
    },
  };
};

export const buildPublicCommercialErrorResponse = (error = {}) => {
  const suppliedStatusCode = Number(error?.statusCode);
  const statusCode = Number.isInteger(suppliedStatusCode)
    && suppliedStatusCode >= 400
    && suppliedStatusCode <= 599
    ? suppliedStatusCode
    : 500;

  if (statusCode >= 500) {
    return {
      statusCode,
      payload: {
        error: "Current booking terms are unavailable.",
        ...(statusCode === 503 ? { code: "COMMERCIAL_CONFIGURATION_UNAVAILABLE" } : {}),
      },
    };
  }

  return {
    statusCode,
    payload: {
      error: error?.message || "Commercial configuration request failed.",
      ...(error?.code ? { code: error.code } : {}),
    },
  };
};

export async function handler(event = {}) {
  const method = String(event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});
  if (method !== "GET") return json(event, 405, { error: "Method Not Allowed" });

  const requestOrigin = getHeaderValue(event, "origin");
  if (requestOrigin && !isAllowedAppOrigin(requestOrigin)) {
    return json(event, 403, { error: "Untrusted commercial configuration origin." });
  }
  if (isCrossSiteBrowserRequest(event) && requestOrigin && !isAllowedAppOrigin(requestOrigin)) {
    return json(event, 403, { error: "Cross-site configuration access is not allowed." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const organizationId = await resolveConfiguredPublicOrganizationId(client);
    await applyRequestOrganizationContext(client, organizationId);
    const rateLimit = await applyWindowRateLimit(client, {
      scope: `public-commercial-config:${organizationId}:ip`,
      identifier: getRequestClientIp(event),
      limit: 60,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return json(
        event,
        429,
        { error: "Too many pricing requests. Try again later." },
        { "Retry-After": String(rateLimit.retryAfterSeconds) }
      );
    }

    const effectiveAt = new Date();
    const keys = [
      COMMERCIAL_CONFIG_KEYS.BOOKING_BUNDLE_MIN_ITEMS,
      COMMERCIAL_CONFIG_KEYS.BOOKING_BUNDLE_DISCOUNT_BPS,
      COMMERCIAL_CONFIG_KEYS.BOOKING_ATTENDANT_UNIT_FEE_CENTS,
      COMMERCIAL_CONFIG_KEYS.SERVICE_DEPOSIT_BPS,
      COMMERCIAL_CONFIG_KEYS.SERVICE_DEPOSIT_DUE_DAYS,
    ];
    const records = await Promise.all(keys.map((key) =>
      resolveCommercialConfiguration(client, {
        organizationId,
        businessUnit: COMMERCIAL_BUSINESS_UNITS.REEBS_CORE,
        key,
        at: effectiveAt,
      })
    ));

    return json(event, 200, buildPublicCommercialTerms({ records, effectiveAt }));
  } catch (error) {
    console.error("Public commercial configuration failed:", error?.message || error);
    const publicError = buildPublicCommercialErrorResponse(error);
    return json(event, publicError.statusCode, publicError.payload);
  } finally {
    await client.end().catch(() => {});
  }
}
