import { buildResponseHeaders, isCrossSiteBrowserRequest } from "./_shared/http.js";
import { createDatabaseClient } from "./_shared/databaseClient.js";
import { getEventHeader } from "./_shared/auditLog.js";
import { createLogger } from "./_shared/logger.js";
import {
  applyRequestOrganizationContext,
  resolveConfiguredPublicOrganizationId,
} from "./_shared/organization.js";
import { loadBookingCommercialRules } from "../modules/bookings/commercialRules.js";

const logger = createLogger("booking-rules");

const json = (event, statusCode, payload) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    ...buildResponseHeaders(event, {
      methods: "GET,OPTIONS",
      cacheControl: "public, max-age=300, stale-while-revalidate=600",
    }),
  },
  body: statusCode === 204 ? "" : JSON.stringify(payload),
});

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") return json(event, 204, {});
  if (event.httpMethod !== "GET") return json(event, 405, { error: "Method not allowed." });
  if (isCrossSiteBrowserRequest(event)) {
    return json(event, 403, { error: "Cross-site requests are not allowed." });
  }

  const requestLogger = logger.child({
    requestId: getEventHeader(event, "x-request-id") || undefined,
  });
  const client = createDatabaseClient({ component: "booking-rules-database" });
  try {
    await client.connect();
    const organizationId = await resolveConfiguredPublicOrganizationId(client);
    await applyRequestOrganizationContext(client, organizationId);
    const rules = await loadBookingCommercialRules(client, organizationId);
    return json(event, 200, {
      currency: rules.currency,
      bundleMinItems: rules.bundleMinItems,
      bundleDiscountBps: rules.bundleDiscountBps,
      attendantUnitFeeCents: rules.attendantUnitFeeCents,
      serviceDepositBps: rules.serviceDepositBps,
    });
  } catch (error) {
    requestLogger.error({
      err: error,
      eventName: "booking.rules.failed",
    }, "Booking rules request failed");
    return json(event, 500, { error: "Booking rules are temporarily unavailable." });
  } finally {
    await client.end().catch(() => {});
  }
}
