import {
  createAttentionItem,
  sortAttentionItems,
} from "./dashboardPolicy.js";
import { fetchCoreCollectionSummary } from "../payments/collectionSummary.js";

const numberValue = (value) => Number(value || 0);
const textValue = (value, fallback = "") => String(value || fallback).trim();

const getTableColumns = async (client, tableNames) => {
  const result = await client.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [tableNames]
  );
  return result.rows.reduce((lookup, row) => {
    if (!lookup[row.table_name]) lookup[row.table_name] = new Set();
    lookup[row.table_name].add(row.column_name);
    return lookup;
  }, {});
};

const hasColumn = (columns, table, column) => Boolean(columns?.[table]?.has(column));

const buildCoreOrderFilter = (columns, alias = "o") => {
  const filters = [
    `UPPER(COALESCE(${alias}.source, '')) NOT LIKE '%WATER%'`,
    `NOT EXISTS (
       SELECT 1
       FROM "orderItem" core_scope_item
       JOIN "product" core_scope_product
         ON core_scope_product.id = core_scope_item."productId"
        AND core_scope_product."organizationId" = ${alias}."organizationId"
       LEFT JOIN "waterProductConfig" core_scope_water
         ON core_scope_water."organizationId" = ${alias}."organizationId"
        AND core_scope_water."inventoryProductId" = core_scope_item."productId"
        AND core_scope_water."isActive" = TRUE
       WHERE core_scope_item."orderId" = ${alias}.id
         AND (
           UPPER(COALESCE(core_scope_product."sourceCategoryCode", '')) = 'WATER'
           OR core_scope_water.id IS NOT NULL
         )
     )`,
  ];
  if (hasColumn(columns, "order", "businessUnit")) {
    filters.unshift(`UPPER(COALESCE(${alias}."businessUnit", 'REEBS_CORE')) = 'REEBS_CORE'`);
  }
  return filters.join(" AND ");
};

const buildCoreBookingFilter = (alias = "b") => `NOT EXISTS (
  SELECT 1
  FROM "bookingItem" core_booking_item
  JOIN "product" core_booking_product
    ON core_booking_product.id = core_booking_item."productId"
   AND core_booking_product."organizationId" = ${alias}."organizationId"
  LEFT JOIN "waterProductConfig" core_booking_water
    ON core_booking_water."organizationId" = ${alias}."organizationId"
   AND core_booking_water."inventoryProductId" = core_booking_item."productId"
   AND core_booking_water."isActive" = TRUE
  WHERE core_booking_item."bookingId" = ${alias}.id
    AND (
      UPPER(COALESCE(core_booking_product."sourceCategoryCode", '')) = 'WATER'
      OR core_booking_water.id IS NOT NULL
    )
)`;

const CORE_PRODUCT_FILTER = `
  p."organizationId" = $1
  AND p."isActive" = TRUE
  AND p."isArchived" = FALSE
  AND p."isDeleted" = FALSE
  AND UPPER(COALESCE(p."sourceCategoryCode", '')) <> 'WATER'
  AND NOT EXISTS (
    SELECT 1
    FROM "waterProductConfig" water_config
    WHERE water_config."organizationId" = p."organizationId"
      AND water_config."inventoryProductId" = p.id
      AND water_config."isActive" = TRUE
  )`;

const fetchOrderSummary = async ({ client, columns, organizationId, window }) => {
  const coreFilter = buildCoreOrderFilter(columns);
  const grandTotal = hasColumn(columns, "order", "grandTotalCents")
    ? `COALESCE(o."grandTotalCents", o.total_amount, 0)`
    : `COALESCE(o.total_amount, 0)`;
  const balanceDue = hasColumn(columns, "order", "balanceDueCents")
    ? `GREATEST(COALESCE(o."balanceDueCents", ${grandTotal} - COALESCE(o."amountPaidCents", 0)), 0)`
    : grandTotal;
  const paymentStatus = hasColumn(columns, "order", "paymentStatus")
    ? `LOWER(COALESCE(o."paymentStatus", 'unpaid'))`
    : `'unpaid'`;
  const fulfillmentStatus = hasColumn(columns, "order", "fulfillmentStatus")
    ? `LOWER(COALESCE(o."fulfillmentStatus", 'not_started'))`
    : `LOWER(COALESCE(o.status, 'pending'))`;
  const expectedDate = hasColumn(columns, "order", "expectedFulfillmentDate")
    ? `o."expectedFulfillmentDate"`
    : `o."deliveryDate"`;
  const subtotalDiscrepancy = hasColumn(columns, "order", "subtotalCents")
    ? `COUNT(*) FILTER (
         WHERE o."subtotalCents" IS NOT NULL
           AND o."subtotalCents" <> COALESCE((
             SELECT SUM(oi.total_amount)
             FROM "orderItem" oi
             WHERE oi."orderId" = o.id
           ), 0)
       )`
    : "0";

  const result = await client.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE LOWER(COALESCE(o.status, 'pending')) NOT IN ('completed', 'cancelled', 'canceled', 'refunded')
       ) AS open_orders,
       COUNT(*) FILTER (
         WHERE ${paymentStatus} IN ('unpaid', 'partially_paid')
           AND LOWER(COALESCE(o.status, 'pending')) NOT IN ('cancelled', 'canceled', 'refunded')
       ) AS awaiting_payment,
       COUNT(*) FILTER (
         WHERE ${fulfillmentStatus} IN ('ready_for_pickup', 'out_for_delivery')
       ) AS ready_or_out,
       COUNT(*) FILTER (
         WHERE ${expectedDate} IS NOT NULL
           AND ${expectedDate} < NOW()
           AND ${fulfillmentStatus} NOT IN ('delivered', 'picked_up', 'completed', 'cancelled')
       ) AS overdue_fulfillment,
       COALESCE(SUM(${balanceDue}) FILTER (
         WHERE ${paymentStatus} IN ('unpaid', 'partially_paid')
           AND LOWER(COALESCE(o.status, 'pending')) NOT IN ('cancelled', 'canceled', 'refunded')
       ), 0) AS outstanding_cents,
       COUNT(*) FILTER (
         WHERE o."orderDate" >= $2 AND o."orderDate" < $3
       ) AS orders_in_window,
       ${subtotalDiscrepancy} AS reconciliation_count
     FROM "order" o
     WHERE o."organizationId" = $1
       AND ${coreFilter}`,
    [organizationId, window.start.toISOString(), window.end.toISOString()]
  );
  const row = result.rows[0] || {};
  return {
    open: numberValue(row.open_orders),
    awaitingPayment: numberValue(row.awaiting_payment),
    readyOrOut: numberValue(row.ready_or_out),
    overdueFulfillment: numberValue(row.overdue_fulfillment),
    outstandingCents: numberValue(row.outstanding_cents),
    inWindow: numberValue(row.orders_in_window),
    reconciliationCount: numberValue(row.reconciliation_count),
  };
};

const fetchBookingSummary = async ({ client, organizationId, window }) => {
  const coreFilter = buildCoreBookingFilter();
  const result = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE LOWER(COALESCE(b.status, 'pending')) = 'pending') AS awaiting_confirmation,
       COUNT(*) FILTER (
         WHERE b."eventDate" >= date_trunc('day', NOW())
           AND b."eventDate" < date_trunc('day', NOW()) + INTERVAL '1 day'
           AND LOWER(COALESCE(b.status, 'pending')) IN ('pending', 'confirmed')
       ) AS today,
       COUNT(*) FILTER (
         WHERE b."eventDate" >= NOW()
           AND b."eventDate" < NOW() + INTERVAL '7 days'
           AND LOWER(COALESCE(b.status, 'pending')) IN ('pending', 'confirmed')
       ) AS upcoming,
       COUNT(*) FILTER (
         WHERE b."eventEndDate" < date_trunc('day', NOW())
           AND LOWER(COALESCE(b.status, 'pending')) = 'confirmed'
       ) AS completion_due,
       COUNT(*) FILTER (
         WHERE b."eventDate" >= $2 AND b."eventDate" < $3
           AND LOWER(COALESCE(b.status, 'pending')) NOT IN ('cancelled', 'canceled')
       ) AS bookings_in_window
     FROM "booking" b
     WHERE b."organizationId" = $1
       AND ${coreFilter}`,
    [organizationId, window.start.toISOString(), window.end.toISOString()]
  );
  const row = result.rows[0] || {};
  return {
    awaitingConfirmation: numberValue(row.awaiting_confirmation),
    today: numberValue(row.today),
    upcoming: numberValue(row.upcoming),
    completionDue: numberValue(row.completion_due),
    inWindow: numberValue(row.bookings_in_window),
  };
};

const fetchInventorySummary = async ({ client, organizationId }) => {
  const result = await client.query(
    `SELECT
       COUNT(*) AS active_products,
       COUNT(*) FILTER (WHERE COALESCE(p.stock, 0) <= 0) AS unavailable,
       COUNT(*) FILTER (
         WHERE COALESCE(p.stock, 0) > 0
           AND COALESCE(p.stock, 0) <= GREATEST(COALESCE(p."reorderLevel", 2), 0)
       ) AS low_stock,
       COUNT(*) FILTER (WHERE COALESCE(p.price, 0) <= 0) AS missing_price
     FROM "product" p
     WHERE ${CORE_PRODUCT_FILTER}`,
    [organizationId]
  );
  const row = result.rows[0] || {};
  return {
    activeProducts: numberValue(row.active_products),
    unavailable: numberValue(row.unavailable),
    lowStock: numberValue(row.low_stock),
    missingPrice: numberValue(row.missing_price),
  };
};

const fetchDeliverySummary = async ({ client, organizationId }) => {
  const result = await client.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE b."eventDate" >= date_trunc('day', NOW())
           AND b."eventDate" < date_trunc('day', NOW()) + INTERVAL '1 day'
           AND LOWER(COALESCE(d.status, 'scheduled')) NOT IN ('completed', 'cancelled', 'canceled')
       ) AS today,
       COUNT(*) FILTER (
         WHERE LOWER(COALESCE(d.status, 'scheduled')) IN ('scheduled', 'pending')
       ) AS pending,
       COUNT(*) FILTER (
         WHERE b."eventDate" >= date_trunc('day', NOW())
           AND b."eventDate" < date_trunc('day', NOW()) + INTERVAL '1 day'
           AND COALESCE(NULLIF(BTRIM(d."driverName"), ''), '') = ''
           AND LOWER(COALESCE(d.status, 'scheduled')) NOT IN ('completed', 'cancelled', 'canceled')
       ) AS unassigned_today
     FROM "delivery" d
     JOIN "booking" b ON b.id = d."bookingId"
     WHERE b."organizationId" = $1
       AND ${buildCoreBookingFilter("b")}`,
    [organizationId]
  );
  const row = result.rows[0] || {};
  return {
    today: numberValue(row.today),
    pending: numberValue(row.pending),
    unassignedToday: numberValue(row.unassigned_today),
  };
};

const fetchOrderActivity = async ({ client, columns, organizationId, window }) => {
  const result = await client.query(
    `SELECT
       CONCAT('order-', oe.id) AS id,
       o.id AS "orderId",
       COALESCE(NULLIF(BTRIM(oe.summary), ''), 'Order activity') AS summary,
       o."orderNumber" AS reference,
       oe.type,
       oe."createdAt"
     FROM "orderEvent" oe
     JOIN "order" o
       ON o.id = oe."orderId"
      AND o."organizationId" = oe."organizationId"
     WHERE oe."organizationId" = $1
       AND oe."createdAt" >= $2 AND oe."createdAt" < $3
       AND ${buildCoreOrderFilter(columns)}
     ORDER BY oe."createdAt" DESC
     LIMIT 8`,
    [organizationId, window.start.toISOString(), window.end.toISOString()]
  );
  return result.rows.map((row) => ({
    id: row.id,
    kind: "order",
    summary: textValue(row.summary, "Order activity"),
    reference: textValue(row.reference),
    status: textValue(row.type, "updated").toLowerCase(),
    createdAt: row.createdAt,
    href: `/admin/orders/${encodeURIComponent(row.orderId)}`,
  }));
};

const fetchBookingActivity = async ({ client, organizationId, window }) => {
  const result = await client.query(
    `SELECT
       CONCAT('booking-', b.id) AS id,
       b.id AS "bookingId",
       'Booking updated' AS summary,
       b.reference,
       b.status,
       b."updatedAt" AS "createdAt"
     FROM "booking" b
     WHERE b."organizationId" = $1
       AND b."updatedAt" >= $2 AND b."updatedAt" < $3
       AND ${buildCoreBookingFilter("b")}
     ORDER BY b."updatedAt" DESC
     LIMIT 8`,
    [organizationId, window.start.toISOString(), window.end.toISOString()]
  );
  return result.rows.map((row) => ({
    id: row.id,
    kind: "booking",
    summary: textValue(row.summary, "Booking updated"),
    reference: textValue(row.reference),
    status: textValue(row.status, "updated").toLowerCase(),
    createdAt: row.createdAt,
    href: `/admin/bookings?id=${encodeURIComponent(row.bookingId)}`,
  }));
};

const fetchInventoryActivity = async ({ client, organizationId, window }) => {
  const result = await client.query(
    `SELECT
       CONCAT('stock-', sm.id) AS id,
       CONCAT(COALESCE(p.name, 'Inventory item'), ' stock ', LOWER(COALESCE(sm.type, 'updated'))) AS summary,
       COALESCE(NULLIF(BTRIM(sm.reference), ''), p.sku) AS reference,
       sm.type AS status,
       COALESCE(sm.date, sm."createdAt") AS "createdAt"
     FROM "stockMovement" sm
     JOIN "product" p
       ON p.id = sm."productId"
      AND p."organizationId" = sm."organizationId"
     WHERE sm."organizationId" = $1
       AND COALESCE(sm.date, sm."createdAt") >= $2 AND COALESCE(sm.date, sm."createdAt") < $3
       AND ${CORE_PRODUCT_FILTER}
     ORDER BY COALESCE(sm.date, sm."createdAt") DESC
     LIMIT 8`,
    [organizationId, window.start.toISOString(), window.end.toISOString()]
  );
  return result.rows.map((row) => ({
    id: row.id,
    kind: "inventory",
    summary: textValue(row.summary, "Inventory updated"),
    reference: textValue(row.reference),
    status: textValue(row.status, "updated").toLowerCase(),
    createdAt: row.createdAt,
    href: "/admin/inventory?view=activity",
  }));
};

const buildAttention = ({ orders, bookings, inventory, delivery, permissions }) => sortAttentionItems([
  permissions.canReadOrders && createAttentionItem({
    id: "overdue-fulfillment",
    severity: "critical",
    count: orders?.overdueFulfillment,
    label: "Orders past fulfilment date",
    detail: "These orders are still open after their expected handover date.",
    href: "/admin/orders",
    actionLabel: "Open orders",
  }),
  permissions.canReadDelivery && createAttentionItem({
    id: "unassigned-delivery",
    severity: "critical",
    count: delivery?.unassignedToday,
    label: "Today's deliveries need a driver",
    detail: "Assign a driver before the scheduled event handoff.",
    href: "/admin/delivery",
    actionLabel: "Assign delivery",
  }),
  permissions.canReadBookings && createAttentionItem({
    id: "booking-completion-due",
    severity: "warning",
    count: bookings?.completionDue,
    label: "Bookings need completion review",
    detail: "The event end date has passed but the booking is still confirmed.",
    href: "/admin/bookings?timing=overdue",
    actionLabel: "Review bookings",
  }),
  permissions.canReadOrders && createAttentionItem({
    id: "awaiting-payment",
    severity: "warning",
    count: orders?.awaitingPayment,
    label: "Orders have outstanding payment",
    detail: "Follow up before fulfilment or record a confirmed payment.",
    href: "/admin/orders?paymentStatus=unpaid",
    actionLabel: "Review payments",
  }),
  permissions.canReadBookings && createAttentionItem({
    id: "pending-bookings",
    severity: "warning",
    count: bookings?.awaitingConfirmation,
    label: "Bookings await confirmation",
    detail: "Check availability and confirm the customer arrangement.",
    href: "/admin/bookings?status=pending",
    actionLabel: "Review bookings",
  }),
  permissions.canReadInventory && createAttentionItem({
    id: "low-stock",
    severity: "warning",
    count: Number(inventory?.lowStock || 0) + Number(inventory?.unavailable || 0),
    label: "Core inventory needs attention",
    detail: "Items are at their reorder level or unavailable. Water stock is excluded.",
    href: "/admin/inventory?stock=low&reorder=1",
    actionLabel: "Review stock",
  }),
  permissions.canConfigureInventory && createAttentionItem({
    id: "missing-price",
    severity: "warning",
    count: inventory?.missingPrice,
    label: "Pricing configuration needs attention",
    detail: "Active Core products do not have a positive selling price.",
    href: "/admin/inventory",
    actionLabel: "Configure prices",
  }),
  permissions.canReadFinancials && createAttentionItem({
    id: "reconciliation",
    severity: "warning",
    count: orders?.reconciliationCount,
    label: "Financial reconciliation needed",
    detail: "Historical Core order subtotals differ from their saved line totals.",
    href: "/admin/orders?reconciliation=1",
    actionLabel: "Review records",
  }),
].filter(Boolean));

const fetchDashboardOverview = async ({ client, organizationId, window, permissions, onWidgetError = () => {} }) => {
  const columns = await getTableColumns(client, ["order"]);
  const unavailable = [];
  const readWidget = async (name, read) => {
    try { return await read(); }
    catch (error) {
      unavailable.push(name);
      onWidgetError(name, error);
      return null;
    }
  };
  // A pg Client supports one active query. Keep the tenant-scoped connection safe and
  // explicit instead of starting concurrent promises that the driver merely queues.
  const orders = permissions.canReadOrders
    ? await readWidget("orders", () => fetchOrderSummary({ client, columns, organizationId, window }))
    : null;
  const bookings = permissions.canReadBookings
    ? await readWidget("bookings", () => fetchBookingSummary({ client, organizationId, window }))
    : null;
  const inventory = permissions.canReadInventory
    ? await readWidget("inventory", () => fetchInventorySummary({ client, organizationId }))
    : null;
  const delivery = permissions.canReadDelivery
    ? await readWidget("delivery", () => fetchDeliverySummary({ client, organizationId }))
    : null;
  const payments = permissions.canReadFinancials && permissions.canReadOrders
    ? await readWidget("payments", () => fetchCoreCollectionSummary({ client, organizationId, window, coreOrderFilter: buildCoreOrderFilter(columns) }))
    : null;
  const activityGroups = [];
  if (permissions.canReadOrders) {
    activityGroups.push(await readWidget("order activity", () => fetchOrderActivity({ client, columns, organizationId, window })) || []);
  }
  if (permissions.canReadBookings) {
    activityGroups.push(await readWidget("booking activity", () => fetchBookingActivity({ client, organizationId, window })) || []);
  }
  if (permissions.canReadInventory) {
    activityGroups.push(await readWidget("inventory activity", () => fetchInventoryActivity({ client, organizationId, window })) || []);
  }
  const activity = activityGroups
    .flat()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 8);

  // A hidden finance card is not authorization. Operational roles may receive
  // order counts, but must not receive balances or reconciliation data in JSON.
  let visibleOrders = orders;
  if (orders && !permissions.canReadFinancials) {
    const { outstandingCents: _balance, reconciliationCount: _reconciliation, ...operationalOrders } = orders;
    visibleOrders = operationalOrders;
  }

  return {
    unavailable,
    attention: buildAttention({ orders, bookings, inventory, delivery, permissions }),
    summary: { orders: visibleOrders, bookings, inventory, delivery, payments },
    activity,
  };
};

export {
  CORE_PRODUCT_FILTER,
  buildCoreBookingFilter,
  buildCoreOrderFilter,
  fetchDashboardOverview,
};
