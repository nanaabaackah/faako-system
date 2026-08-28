/* eslint-disable no-console, no-undef */
import { pathToFileURL } from "node:url";
import {
  buildBusinessUnitClassificationReport,
} from "./businessUnitClassifier.js";

const HELP = `REEBS business-unit classification report (read only)

Usage:
  pnpm run business-units:classify:dry -- --org=<organizationId>

Options:
  --org=<id>  Required positive organization id.
  --help      Print this help without connecting to a database.

The command runs all database reads inside a READ ONLY transaction and always
rolls it back. It classifies from table ownership, foreign-key relationships,
and explicit business-unit values only. Names and other free text are ignored.
It never updates, inserts, deletes, creates, or relinks records.`;

const parseArgs = (argv) => {
  const args = new Set(argv);
  if (args.has("--help") || args.has("-h")) return { help: true };

  const unknown = [...args].filter((arg) => !arg.startsWith("--org="));
  if (unknown.length > 0) {
    throw new Error(`Unknown option: ${unknown[0]}`);
  }

  const orgArgs = [...args].filter((arg) => arg.startsWith("--org="));
  if (orgArgs.length !== 1) {
    throw new Error("Exactly one --org=<organizationId> option is required.");
  }
  const organizationId = Number(orgArgs[0].slice("--org=".length));
  if (!Number.isSafeInteger(organizationId) || organizationId <= 0) {
    throw new Error("--org must be a positive integer.");
  }
  return { help: false, organizationId };
};

const REQUIRED_TABLES = Object.freeze([
  "booking",
  "bookingItem",
  "commercialConfiguration",
  "customer",
  "expense",
  "invoiceDocument",
  "journalEntry",
  "order",
  "orderItem",
  "product",
  "waterAdjustment",
  "waterExpense",
  "waterProductPrice",
  "waterRestock",
  "waterSale",
]);

const readTableAvailability = async (client) => {
  const result = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = current_schema()
       AND table_name = ANY($1::text[])
     ORDER BY table_name`,
    [REQUIRED_TABLES]
  );
  const available = new Set((result.rows || []).map((row) => row.table_name));
  return Object.fromEntries(REQUIRED_TABLES.map((table) => [table, available.has(table)]));
};

const loadCustomerRecords = async (client, organizationId, tables) => {
  if (!tables.customer) return [];
  const coreOrderEvidence = tables.order
    ? `EXISTS (
         SELECT 1 FROM "order" o
         WHERE o."organizationId" = c."organizationId" AND o."customerId" = c.id
       )`
    : "false";
  const coreBookingEvidence = tables.booking
    ? `EXISTS (
         SELECT 1 FROM "booking" b
         WHERE b."organizationId" = c."organizationId" AND b."customerId" = c.id
       )`
    : "false";
  const waterSaleEvidence = tables.waterSale
    ? `EXISTS (
         SELECT 1 FROM "waterSale" ws
         WHERE ws."organizationId" = c."organizationId" AND ws."customerId" = c.id
       )`
    : "false";
  const result = await client.query(
    `SELECT c.id,
            ${coreOrderEvidence} AS "hasCoreOrder",
            ${coreBookingEvidence} AS "hasCoreBooking",
            ${waterSaleEvidence} AS "hasWaterSale"
     FROM "customer" c
     WHERE c."organizationId" = $1
     ORDER BY c.id`,
    [organizationId]
  );

  return (result.rows || []).map((row) => ({
    entityType: "CUSTOMER",
    id: row.id,
    coreEvidence: [
      ...(row.hasCoreOrder ? ["relationship:order.customerId"] : []),
      ...(row.hasCoreBooking ? ["relationship:booking.customerId"] : []),
    ],
    waterEvidence: row.hasWaterSale ? ["relationship:waterSale.customerId"] : [],
  }));
};

const loadProductRecords = async (client, organizationId, tables) => {
  if (!tables.product) return [];
  const coreOrderEvidence = tables.orderItem
    ? `EXISTS (
         SELECT 1 FROM "orderItem" oi
         WHERE oi."organizationId" = p."organizationId" AND oi."productId" = p.id
       )`
    : "false";
  const coreBookingEvidence = tables.bookingItem
    ? `EXISTS (
         SELECT 1 FROM "bookingItem" bi
         WHERE bi."organizationId" = p."organizationId" AND bi."productId" = p.id
       )`
    : "false";
  const waterPriceEvidence = tables.waterProductPrice
    ? `EXISTS (
         SELECT 1 FROM "waterProductPrice" wpp
         WHERE wpp."organizationId" = p."organizationId" AND wpp."productId" = p.id
       )`
    : "false";
  const result = await client.query(
    `SELECT p.id, p.sku,
            ${coreOrderEvidence} AS "hasCoreOrderItem",
            ${coreBookingEvidence} AS "hasCoreBookingItem",
            ${waterPriceEvidence} AS "hasWaterPriceLink"
     FROM "product" p
     WHERE p."organizationId" = $1
     ORDER BY p.id`,
    [organizationId]
  );

  return (result.rows || []).map((row) => ({
    entityType: "PRODUCT",
    id: row.id,
    coreEvidence: [
      ...(row.hasCoreOrderItem ? ["relationship:orderItem.productId"] : []),
      ...(row.hasCoreBookingItem ? ["relationship:bookingItem.productId"] : []),
    ],
    waterEvidence: row.hasWaterPriceLink
      ? ["relationship:waterProductPrice.productId"]
      : [],
    metadata: { sku: row.sku || null },
  }));
};

const loadWaterPriceRecords = async (client, organizationId, tables) => {
  if (!tables.waterProductPrice) return [];
  const result = await client.query(
    `SELECT id, "productId", "productKey", "priceType"
     FROM "waterProductPrice"
     WHERE "organizationId" = $1
     ORDER BY id`,
    [organizationId]
  );
  return (result.rows || []).map((row) => ({
    entityType: "WATER_PRODUCT_PRICE",
    id: row.id,
    waterEvidence: ["table:waterProductPrice"],
    metadata: {
      productId: row.productId ? Number(row.productId) : null,
      productKey: row.productKey,
      priceType: row.priceType,
    },
  }));
};

const loadCommercialConfigurationRecords = async (client, organizationId, tables) => {
  if (!tables.commercialConfiguration) return [];
  const result = await client.query(
    `SELECT id, "businessUnit", key
     FROM "commercialConfiguration"
     WHERE "organizationId" = $1
     ORDER BY id`,
    [organizationId]
  );
  return (result.rows || []).map((row) => ({
    entityType: "COMMERCIAL_CONFIGURATION",
    id: row.id,
    coreEvidence: row.businessUnit === "REEBS_CORE"
      ? ["explicit:businessUnit=REEBS_CORE"]
      : [],
    waterEvidence: row.businessUnit === "WATER"
      ? ["explicit:businessUnit=WATER"]
      : [],
    sharedEvidence: row.businessUnit === "SHARED"
      ? ["explicit:businessUnit=SHARED"]
      : [],
    metadata: { key: row.key },
  }));
};

const loadInvoiceDocumentRecords = async (client, organizationId, tables) => {
  if (!tables.invoiceDocument) return [];
  const orderEvidence = tables.order
    ? `EXISTS (
         SELECT 1 FROM "order" o
         WHERE d."sourceType" = 'orders'
           AND o."organizationId" = d."organizationId"
           AND o.id = d."sourceId"
       )`
    : "false";
  const bookingEvidence = tables.booking
    ? `EXISTS (
         SELECT 1 FROM "booking" b
         WHERE d."sourceType" = 'bookings'
           AND b."organizationId" = d."organizationId"
           AND b.id = d."sourceId"
       )`
    : "false";
  const result = await client.query(
    `SELECT d.id, d."sourceType", d."sourceId",
            ${orderEvidence} AS "hasOrderSource",
            ${bookingEvidence} AS "hasBookingSource"
     FROM "invoiceDocument" d
     WHERE d."organizationId" = $1
     ORDER BY d.id`,
    [organizationId]
  );
  return (result.rows || []).map((row) => ({
    entityType: "INVOICE_DOCUMENT",
    id: row.id,
    coreEvidence: [
      ...(row.hasOrderSource ? ["relationship:invoiceDocument->order"] : []),
      ...(row.hasBookingSource ? ["relationship:invoiceDocument->booking"] : []),
    ],
    metadata: {
      sourceType: row.sourceType,
      sourceId: row.sourceId ? Number(row.sourceId) : null,
    },
  }));
};

const loadJournalRecords = async (client, organizationId, tables) => {
  if (!tables.journalEntry) return [];
  const result = await client.query(
    `SELECT id, "isPosted", "isReversed"
     FROM "journalEntry"
     WHERE "organizationId" = $1
     ORDER BY id`,
    [organizationId]
  );
  return (result.rows || []).map((row) => ({
    entityType: "JOURNAL_ENTRY",
    id: row.id,
    metadata: {
      isPosted: row.isPosted === true,
      isReversed: row.isReversed === true,
    },
  }));
};

const FACT_TABLES = Object.freeze([
  ["order", "coreOrders", "REEBS_CORE"],
  ["booking", "coreBookings", "REEBS_CORE"],
  ["expense", "coreExpenses", "REEBS_CORE"],
  ["waterSale", "waterSales", "WATER"],
  ["waterRestock", "waterRestocks", "WATER"],
  ["waterExpense", "waterExpenses", "WATER"],
  ["waterAdjustment", "waterAdjustments", "WATER"],
]);

const loadAuthoritativeFactCounts = async (client, organizationId, tables) => {
  const counts = { REEBS_CORE: {}, WATER: {} };
  for (const [table, key, businessUnit] of FACT_TABLES) {
    if (!tables[table]) {
      counts[businessUnit][key] = null;
      continue;
    }
    const result = await client.query(
      `SELECT COUNT(*)::integer AS count
       FROM "${table}"
       WHERE "organizationId" = $1`,
      [organizationId]
    );
    counts[businessUnit][key] = Number(result.rows?.[0]?.count || 0);
  }
  return counts;
};

const loadReport = async (client, organizationId) => {
  const tables = await readTableAvailability(client);
  const [
    customers,
    products,
    waterPrices,
    commercialConfiguration,
    invoiceDocuments,
    journals,
    authoritativeFactCounts,
  ] = await Promise.all([
    loadCustomerRecords(client, organizationId, tables),
    loadProductRecords(client, organizationId, tables),
    loadWaterPriceRecords(client, organizationId, tables),
    loadCommercialConfigurationRecords(client, organizationId, tables),
    loadInvoiceDocumentRecords(client, organizationId, tables),
    loadJournalRecords(client, organizationId, tables),
    loadAuthoritativeFactCounts(client, organizationId, tables),
  ]);
  const records = [
    ...customers,
    ...products,
    ...waterPrices,
    ...commercialConfiguration,
    ...invoiceDocuments,
    ...journals,
  ];
  const unlinkedWaterPrices = waterPrices.filter((record) => !record.metadata.productId).length;
  const warnings = [];
  if (!tables.waterProductPrice) {
    warnings.push(
      "waterProductPrice is unavailable; Product records cannot receive structural Water evidence."
    );
  } else if (unlinkedWaterPrices > 0) {
    warnings.push(
      `${unlinkedWaterPrices} Water price record(s) have no productId; review them without name-based relinking.`
    );
  }
  if (!tables.invoiceDocument) {
    warnings.push("invoiceDocument is unavailable; no document records were classified.");
  }
  if (journals.length > 0) {
    warnings.push(
      "Journal entries have no structural business-unit field and remain AMBIGUOUS; references are not parsed as evidence."
    );
  }
  if (records.some((record) => (
    !record.coreEvidence?.length
    && !record.waterEvidence?.length
    && !record.sharedEvidence?.length
  ))) {
    warnings.push("AMBIGUOUS records require manual review before any future backfill.");
  }

  return buildBusinessUnitClassificationReport({
    organizationId,
    records,
    authoritativeFactCounts,
    tableAvailability: tables,
    warnings,
  });
};

export const runBusinessUnitClassificationReport = async ({
  organizationId,
  connectionString,
  ssl,
}) => {
  const { Client } = await import("pg");
  const client = new Client({ connectionString, ssl });
  let transactionOpen = false;
  try {
    await client.connect();
    await client.query("BEGIN TRANSACTION READ ONLY");
    transactionOpen = true;
    await client.query(
      "SELECT set_config('app.current_organization_id', $1, true)",
      [String(organizationId)]
    );
    return await loadReport(client, organizationId);
  } finally {
    if (transactionOpen) {
      await client.query("ROLLBACK").catch(() => {});
    }
    await client.end().catch(() => {});
  }
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }
  const { DATABASE_URL, resolvePgSslConfig } = await import("../../runtimeEnv.js");
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required for the read-only classification report.");
  }
  const report = await runBusinessUnitClassificationReport({
    organizationId: options.organizationId,
    connectionString: DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });
  console.log(JSON.stringify(report, null, 2));
};

const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(`Business-unit classification failed: ${error?.message || error}`);
    process.exitCode = 1;
  });
}
