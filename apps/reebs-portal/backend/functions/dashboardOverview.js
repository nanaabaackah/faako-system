import { createDatabaseClient } from "./_shared/databaseClient.js";
import { createLogger } from "./_shared/logger.js";
import { getEventHeader } from "./_shared/auditLog.js";
import {
  hasPermission,
  requireInternalUser,
  respond,
} from "./_shared/internalApi.js";
import {
  buildDashboardPermissions,
  getDashboardWindow,
} from "../modules/dashboard/dashboardPolicy.js";
import { fetchDashboardOverview } from "../modules/dashboard/dashboardRepository.js";

const METHODS = "GET,OPTIONS";
const logger = createLogger("dashboard-overview");

const json = (event, statusCode, body) => respond(event, statusCode, body, {
  methods: METHODS,
  allowHeaders: "Content-Type, Authorization, X-Organization-Id, X-CSRF-Token, X-Request-Id",
});

export async function handler(event = {}) {
  const method = String(event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});
  if (method !== "GET") return json(event, 405, { error: "Method Not Allowed" });

  const requestedScope = String(event.queryStringParameters?.scope || "core").trim().toLowerCase();
  if (requestedScope !== "core") {
    return json(event, 400, {
      error: "This endpoint supports REEBS Core only. Open the Water dashboard for Water metrics.",
      code: "DASHBOARD_SCOPE_UNSUPPORTED",
    });
  }

  const client = createDatabaseClient({ component: "dashboard-overview-database" });
  const startedAt = Date.now();
  const requestLogger = logger.child({
    requestId: getEventHeader(event, "x-request-id") || undefined,
  });
  try {
    await client.connect();
    const authResult = await requireInternalUser(client, event, { methods: METHODS });
    if (authResult.errorResponse) return authResult.errorResponse;

    const permissions = buildDashboardPermissions(authResult.authUser, hasPermission);
    const hasDashboardData = [
      permissions.canReadOrders,
      permissions.canReadBookings,
      permissions.canReadInventory,
      permissions.canReadDelivery,
    ].some(Boolean);
    if (!hasDashboardData) {
      return json(event, 403, { error: "You do not have permission to view the Core dashboard." });
    }

    const window = getDashboardWindow(
      event.queryStringParameters?.window || event.queryStringParameters?.period
    );
    const overview = await fetchDashboardOverview({
      client,
      organizationId: Number(authResult.organizationId),
      window,
      permissions,
    });
    const generatedAt = new Date().toISOString();

    requestLogger.info({
      organizationId: Number(authResult.organizationId),
      durationMs: Date.now() - startedAt,
      window: window.key,
      attentionCount: overview.attention.length,
      eventName: "dashboard.overview.loaded",
    }, "Core dashboard overview loaded");

    return json(event, 200, {
      scope: {
        key: "REEBS_CORE",
        label: "REEBS Core",
        waterIncluded: false,
        consolidated: false,
      },
      period: {
        key: window.key,
        label: window.label,
        start: window.start.toISOString(),
        end: window.end.toISOString(),
      },
      generatedAt,
      freshness: {
        generatedAt,
        staleAfterSeconds: 300,
        refreshMode: "manual",
      },
      permissions,
      ...overview,
    });
  } catch (error) {
    requestLogger.error({
      err: error,
      code: error?.code || undefined,
      durationMs: Date.now() - startedAt,
      eventName: "dashboard.overview.failed",
    }, "Core dashboard overview failed");
    return json(event, 500, {
      error: "Dashboard data is temporarily unavailable.",
      code: "DASHBOARD_OVERVIEW_UNAVAILABLE",
    });
  } finally {
    await client.end().catch(() => {});
  }
}
