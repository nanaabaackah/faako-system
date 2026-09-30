import { createDatabaseClient } from "./_shared/databaseClient.js";
import { getEventHeader, getEventIpAddress, writeAuditLog } from "./_shared/auditLog.js";
import { createLogger } from "./_shared/logger.js";
import { hasPermission, requirePermission, respond } from "./_shared/internalApi.js";
import { ensureCrmContactTables } from "./_shared/crmContact.js";
import { getDeliveryFeeDetails } from "./_shared/deliveryFee.js";
import { buildCustomerInput, getCustomerIdentitySearchTerms } from "../modules/customers/customerIdentity.js";
import {
  CUSTOMER_ERROR_CODES,
  parseCustomerPage,
  parseCustomerScope,
  toCustomerValidationError,
} from "../modules/customers/customerPolicy.js";
import {
  archiveCustomer,
  createCustomer,
  findCustomerById,
  findCustomerDuplicates,
  listCompactCustomers,
  listCustomers,
  reactivateCustomer,
  updateCustomer,
} from "../modules/customers/customerRepository.js";

const METHODS = "GET,POST,PUT,DELETE,OPTIONS";
const CUSTOMER_SEGMENTS = new Set(["prospect", "active", "loyal", "risk"]);
const logger = createLogger("customers");

const json = (event, statusCode, body) => respond(event, statusCode, body, {
  methods: METHODS,
  allowHeaders: "Content-Type, Authorization, X-Organization-Id, X-CSRF-Token, X-Request-Id",
});

const parseBody = (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    return body && typeof body === "object" && !Array.isArray(body)
      ? { body }
      : { error: "Invalid JSON body." };
  } catch {
    return { error: "Invalid JSON body." };
  }
};

const parseId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const customerSummary = (customer = {}) => ({
  id: customer.id,
  reference: customer.reference,
  customerType: customer.customerType,
  name: customer.name,
  organizationName: customer.organizationName || null,
  contactPersonName: customer.contactPersonName || null,
  email: customer.email || null,
  phone: customer.phone || null,
});

const writeCustomerAudit = async (client, event, {
  authUser,
  organizationId,
  action,
  customer,
  metadata = {},
}) => {
  const verb = action === "CUSTOMER_CREATED"
    ? "Created"
    : action === "CUSTOMER_ARCHIVED"
      ? "Archived"
      : action === "CUSTOMER_REACTIVATED" ? "Reactivated" : "Updated";
  await writeAuditLog(client, {
    userId: authUser.id,
    organizationId,
    action,
    targetType: "customer",
    targetId: String(customer.reference || customer.id),
    source: "api",
    category: "customer",
    severity: "info",
    status: "ok",
    summary: `${verb} customer ${customer.reference || customer.id}.`,
    actorLabel: authUser.fullName || authUser.email || "User",
    requestId: getEventHeader(event, "x-request-id"),
    ipAddress: getEventIpAddress(event),
    metadata: { customerType: customer.customerType || null, ...metadata },
  });
};

const loadCoreCustomerDetail = async (client, organizationId, customerId, {
  canReadFinancials,
  canReadInvoices,
}) => {
  const orderFinancialSelect = canReadFinancials
    ? `total_amount, "grandTotalCents", "deliveryFeeCents"`
    : `NULL::integer AS total_amount, NULL::integer AS "grandTotalCents", NULL::integer AS "deliveryFeeCents"`;
  const bookingFinancialSelect = canReadFinancials
    ? `"totalAmount"`
    : `NULL::integer AS "totalAmount"`;
  const queries = [
    client.query(
      `SELECT id, "orderNumber", status, "paymentStatus", "fulfillmentStatus", ${orderFinancialSelect},
              "orderDate", "deliveryMethod", "deliveryDetails"
       FROM "order"
       WHERE "customerId" = $1 AND "organizationId" = $2
         AND COALESCE("businessUnit", 'REEBS_CORE') = 'REEBS_CORE'
       ORDER BY "orderDate" DESC, id DESC LIMIT 10`,
      [customerId, organizationId]
    ),
    client.query(
      `SELECT id, reference, "eventDate", "eventEndDate", ${bookingFinancialSelect}, status,
              "venueAddress", "venueGhanaPostGps"
       FROM "booking"
       WHERE "customerId" = $1 AND "organizationId" = $2
       ORDER BY "eventDate" DESC, id DESC LIMIT 10`,
      [customerId, organizationId]
    ),
    client.query(
      `SELECT
         (SELECT COUNT(*) FROM "order" WHERE "customerId" = $1 AND "organizationId" = $2
            AND COALESCE("businessUnit", 'REEBS_CORE') = 'REEBS_CORE')::int AS orders,
         (SELECT COUNT(*) FROM "booking" WHERE "customerId" = $1 AND "organizationId" = $2)::int AS bookings,
         ${canReadFinancials ? `(SELECT COALESCE(SUM(COALESCE("grandTotalCents", total_amount + COALESCE("deliveryFeeCents", 0))), 0)
            FROM "order" WHERE "customerId" = $1 AND "organizationId" = $2
            AND COALESCE("businessUnit", 'REEBS_CORE') = 'REEBS_CORE')` : "NULL::bigint"} AS "totalSpent",
         ${canReadFinancials ? `(SELECT COALESCE(SUM("totalAmount"), 0) FROM "booking"
            WHERE "customerId" = $1 AND "organizationId" = $2)` : "NULL::bigint"} AS "totalRented"`,
      [customerId, organizationId]
    ),
    client.query(
      `SELECT id, source, status, priority, topic, "eventDate", location, message,
              "followUpDueAt", "createdAt", "updatedAt"
       FROM "contactRequest"
       WHERE "customerId" = $1 AND "organizationId" = $2
       ORDER BY "createdAt" DESC LIMIT 12`,
      [customerId, organizationId]
    ),
    client.query(
      `SELECT id, "contactRequestId", type, title, description, status,
              "dueAt", "completedAt", metadata, "createdAt", "updatedAt"
       FROM "customerActivity"
       WHERE "customerId" = $1 AND "organizationId" = $2
       ORDER BY COALESCE("dueAt", "createdAt") DESC, "createdAt" DESC LIMIT 16`,
      [customerId, organizationId]
    ),
  ];
  if (canReadFinancials) {
    queries.push(client.query(
      `SELECT id, "orderId", "amountCents", method, provider, status, "paidAt", "transactionReference"
       FROM "orderPayment"
       WHERE "customerId" = $1 AND "organizationId" = $2
       ORDER BY "paidAt" DESC, id DESC LIMIT 10`,
      [customerId, organizationId]
    ));
  }

  const [ordersResult, bookingsResult, totalsResult, requestsResult, activitiesResult, paymentsResult] = await Promise.all(queries);
  let invoices = [];
  if (canReadInvoices) {
    const tableResult = await client.query(`SELECT to_regclass('public."invoiceDocument"') AS table_name`);
    if (tableResult.rows?.[0]?.table_name) {
      const invoiceResult = await client.query(
        `SELECT d.id, d."sourceType", d."sourceId", d."documentType", d.title,
                d."invoiceNumber", d."issueDate", d."dueDate", d."paymentStatus", d."sentAt"
         FROM "invoiceDocument" d
         WHERE d."organizationId" = $2
           AND d."archivedAt" IS NULL
           AND (
             (d."sourceType" = 'orders' AND EXISTS (
               SELECT 1 FROM "order" o
               WHERE o.id = d."sourceId" AND o."customerId" = $1 AND o."organizationId" = $2
                 AND COALESCE(o."businessUnit", 'REEBS_CORE') = 'REEBS_CORE'
             ))
             OR (d."sourceType" = 'bookings' AND EXISTS (
               SELECT 1 FROM "booking" b
               WHERE b.id = d."sourceId" AND b."customerId" = $1 AND b."organizationId" = $2
             ))
           )
         ORDER BY COALESCE(d."issueDate"::timestamptz, d."createdAt") DESC, d.id DESC
         LIMIT 10`,
        [customerId, organizationId]
      );
      invoices = invoiceResult.rows || [];
    }
  }
  const orders = (ordersResult.rows || []).map((order) => {
    const { distanceKm, feeCents } = getDeliveryFeeDetails(order.deliveryMethod, order.deliveryDetails);
    const recordedFee = Number(order.deliveryFeeCents || feeCents || 0);
    return {
      ...order,
      total_with_delivery: canReadFinancials
        ? Number(order.grandTotalCents ?? Number(order.total_amount || 0) + recordedFee)
        : null,
      delivery_fee: canReadFinancials ? recordedFee : null,
      delivery_distance_km: distanceKm || 0,
    };
  });
  return {
    scope: "core",
    orders,
    bookings: bookingsResult.rows || [],
    payments: paymentsResult?.rows || [],
    invoices,
    totals: totalsResult.rows?.[0] || { orders: 0, bookings: 0, totalSpent: 0, totalRented: 0 },
    contactRequests: requestsResult.rows || [],
    activities: activitiesResult.rows || [],
    historyLimits: { orders: 10, bookings: 10, payments: 10, invoices: 10, contactRequests: 12, activities: 16 },
    permissions: { canViewFinancials: canReadFinancials, canViewInvoices: canReadInvoices },
  };
};

const loadWaterCustomerDetail = async (client, organizationId, customerId) => {
  const [salesResult, totalsResult] = await Promise.all([
    client.query(
      `SELECT id, "productName", quantity, "saleChannel", "paymentMethod", "paymentStatus",
              "unitPrice", "totalAmount", date
       FROM "waterSale"
       WHERE "customerId" = $1 AND "organizationId" = $2
       ORDER BY date DESC, id DESC LIMIT 10`,
      [customerId, organizationId]
    ),
    client.query(
      `SELECT COUNT(*)::int AS sales, COALESCE(SUM("totalAmount"), 0) AS revenue,
              COALESCE(SUM(quantity), 0)::int AS quantity
       FROM "waterSale" WHERE "customerId" = $1 AND "organizationId" = $2`,
      [customerId, organizationId]
    ),
  ]);
  return {
    scope: "water",
    waterSales: salesResult.rows || [],
    waterTotals: totalsResult.rows?.[0] || { sales: 0, revenue: 0, quantity: 0 },
    historyLimits: { waterSales: 10 },
  };
};

export async function handler(event = {}) {
  const method = String(event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});

  const query = event.queryStringParameters || {};
  const scope = parseCustomerScope(query.scope);
  const client = createDatabaseClient({ component: "customers-database" });
  const requestLogger = logger.child({ requestId: getEventHeader(event, "x-request-id") || undefined });

  try {
    await client.connect();
    await ensureCrmContactTables(client);
    const permission = method === "GET"
      ? scope === "water" ? "water:read" : "customers:read"
      : "customers:write";
    const authResult = await requirePermission(client, event, permission, {
      methods: METHODS,
      permissionError: "You do not have permission to access customer records.",
    });
    if (authResult.errorResponse) return authResult.errorResponse;
    const { authUser, organizationId } = authResult;

    if (method === "GET") {
      const customerId = parseId(query.id);
      if (query.id && !customerId) {
        return json(event, 400, { code: CUSTOMER_ERROR_CODES.NOT_FOUND, error: "Enter a valid customer id." });
      }
      if (customerId) {
        const customer = await findCustomerById(client, organizationId, customerId, {
          includeInternalNotes: scope === "core" && hasPermission(authUser, "customers:write"),
        });
        if (!customer) {
          return json(event, 404, { code: CUSTOMER_ERROR_CODES.NOT_FOUND, error: "Customer not found." });
        }
        const detail = scope === "water"
          ? await loadWaterCustomerDetail(client, organizationId, customerId)
          : await loadCoreCustomerDetail(client, organizationId, customerId, {
            canReadFinancials: hasPermission(authUser, "financials:read"),
            canReadInvoices: hasPermission(authUser, "invoices:read"),
          });
        return json(event, 200, { customer, ...detail });
      }

      const search = getCustomerIdentitySearchTerms(query.q || query.email || query.phone || query.name);
      if (String(query.compact || "") === "1") {
        return json(event, 200, await listCompactCustomers(client, organizationId, {
          query: search.query,
          normalizedEmail: search.normalizedEmail,
          normalizedPhone: search.normalizedPhone,
          limit: query.limit,
        }));
      }

      const wantsPagedContract = query.format === "page" || query.page || query.pageSize
        || query.q || query.customerType || query.status;
      const pagination = parseCustomerPage(query);
      if (!wantsPagedContract) pagination.pageSize = 100;
      const result = await listCustomers(client, organizationId, {
        query: search.query,
        normalizedEmail: search.normalizedEmail,
        normalizedPhone: search.normalizedPhone,
        customerType: String(query.customerType || "").toLowerCase(),
        status: String(query.status || "active").toLowerCase(),
        scope,
        includeFinancials: scope === "core" && hasPermission(authUser, "financials:read"),
        ...pagination,
      });
      const payload = {
        items: result.rows,
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: result.total,
          pageCount: Math.max(1, Math.ceil(result.total / pagination.pageSize)),
        },
        scope,
        permissions: {
          canViewFinancials: scope === "core" && hasPermission(authUser, "financials:read"),
        },
      };
      return json(event, 200, wantsPagedContract ? payload : result.rows);
    }

    const parsed = parseBody(event);
    if (parsed.error) return json(event, 400, { error: parsed.error });
    const body = parsed.body;

    if (method === "POST") {
      const input = buildCustomerInput(body);
      if (input.errors.length) return json(event, 400, toCustomerValidationError(input.errors));
      const duplicates = await findCustomerDuplicates(client, organizationId, input.value, { includeArchived: true });
      const exact = duplicates.find((candidate) => candidate.matchReason.startsWith("exact_"));
      if (exact) {
        if (exact.deletedAt) {
          return json(event, 409, {
            code: CUSTOMER_ERROR_CODES.ALREADY_EXISTS,
            error: "An archived customer already uses that phone number or email. Reactivate the existing record instead.",
            candidate: customerSummary(exact),
          });
        }
        return json(event, 200, {
          ...customerSummary(exact),
          duplicateMatch: { level: "exact", reason: exact.matchReason },
        });
      }
      if (duplicates.length && !body.confirmPossibleDuplicate) {
        return json(event, 409, {
          code: CUSTOMER_ERROR_CODES.DUPLICATE_WARNING,
          error: "A similar organization already exists. Review it before creating another record.",
          candidates: duplicates.map(customerSummary),
        });
      }

      await client.query("BEGIN");
      try {
        const customer = await createCustomer(client, organizationId, input.value);
        await writeCustomerAudit(client, event, { authUser, organizationId, action: "CUSTOMER_CREATED", customer });
        await client.query("COMMIT");
        return json(event, 201, customer);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      }
    }

    if (method === "PUT") {
      const customerId = parseId(body.id);
      if (!customerId) return json(event, 400, { error: "Customer id is required." });
      const current = await findCustomerById(client, organizationId, customerId, {
        includeInternalNotes: true,
        includeArchived: Boolean(body.reactivate),
      });
      if (!current) return json(event, 404, { code: CUSTOMER_ERROR_CODES.NOT_FOUND, error: "Customer not found." });
      if (body.reactivate) {
        const customer = await reactivateCustomer(client, organizationId, customerId);
        if (!customer) return json(event, 409, { error: "Customer is already active." });
        await writeCustomerAudit(client, event, {
          authUser,
          organizationId,
          action: "CUSTOMER_REACTIVATED",
          customer,
        });
        return json(event, 200, customer);
      }
      const input = buildCustomerInput({ ...current, ...body });
      if (input.errors.length) return json(event, 400, toCustomerValidationError(input.errors));
      const duplicates = await findCustomerDuplicates(client, organizationId, input.value, { excludeId: customerId });
      const exact = duplicates.find((candidate) => candidate.matchReason.startsWith("exact_"));
      if (exact) {
        return json(event, 409, {
          code: CUSTOMER_ERROR_CODES.ALREADY_EXISTS,
          error: "That phone number or email already belongs to another customer.",
          candidate: customerSummary(exact),
        });
      }

      let segmentOverride;
      if (Object.prototype.hasOwnProperty.call(body, "segmentOverride")) {
        segmentOverride = body.segmentOverride ? String(body.segmentOverride).trim().toLowerCase() : null;
        if (segmentOverride && !CUSTOMER_SEGMENTS.has(segmentOverride)) {
          return json(event, 400, { error: "Invalid customer segment." });
        }
      }
      const customer = await updateCustomer(client, organizationId, customerId, input.value, { segmentOverride });
      if (!customer) return json(event, 404, { code: CUSTOMER_ERROR_CODES.NOT_FOUND, error: "Customer not found." });
      await writeCustomerAudit(client, event, {
        authUser,
        organizationId,
        action: "CUSTOMER_UPDATED",
        customer,
        metadata: { fields: Object.keys(body).filter((key) => key !== "id") },
      });
      return json(event, 200, customer);
    }

    if (method === "DELETE") {
      const customerId = parseId(body.id);
      if (!customerId) return json(event, 400, { error: "Customer id is required." });
      const customer = await archiveCustomer(client, organizationId, customerId, authUser.id);
      if (!customer) return json(event, 404, { code: CUSTOMER_ERROR_CODES.NOT_FOUND, error: "Customer not found." });
      await writeCustomerAudit(client, event, { authUser, organizationId, action: "CUSTOMER_ARCHIVED", customer });
      return json(event, 200, customer);
    }

    return json(event, 405, { error: "Method Not Allowed" });
  } catch (error) {
    requestLogger.error({ err: error, eventName: "customers.request.failed", method, scope }, "Customer request failed");
    return json(event, 500, { error: "Customer records are temporarily unavailable." });
  } finally {
    await client.end().catch(() => {});
  }
}
