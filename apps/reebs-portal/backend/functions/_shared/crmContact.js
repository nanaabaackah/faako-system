import { buildCustomerInput } from "../../modules/customers/customerIdentity.js";
import {
  createCustomer,
  findCustomerDuplicates,
} from "../../modules/customers/customerRepository.js";

const CUSTOMER_SEGMENTS = new Set(["prospect", "active", "loyal", "risk"]);

const crmTableStatements = [
  `ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ`,
  `ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "deletedByUserId" INTEGER`,
  `ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "segmentOverride" TEXT`,
  `CREATE TABLE IF NOT EXISTS "contactRequest" (
    id SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL,
    "customerId" INTEGER,
    source TEXT NOT NULL DEFAULT 'contact_form',
    status TEXT NOT NULL DEFAULT 'new',
    priority TEXT NOT NULL DEFAULT 'normal',
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    topic TEXT,
    "eventDate" TEXT,
    location TEXT,
    message TEXT NOT NULL,
    "followUpDueAt" TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "contactRequest_org_status_created_idx"
   ON "contactRequest" ("organizationId", status, "createdAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS "contactRequest_customer_created_idx"
   ON "contactRequest" ("customerId", "createdAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS "contactRequest_followUpDueAt_idx"
   ON "contactRequest" ("followUpDueAt")`,
  `CREATE TABLE IF NOT EXISTS "customerActivity" (
    id SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "contactRequestId" INTEGER,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    "dueAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "customerActivity_customer_created_idx"
   ON "customerActivity" ("customerId", "createdAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS "customerActivity_org_status_due_idx"
   ON "customerActivity" ("organizationId", status, "dueAt")`,
];

let crmTablesEnsured = false;
let crmTablesPromise = null;

const addBusinessDays = (date, days) => {
  const next = new Date(date);
  let remaining = Math.max(0, Number(days) || 0);
  while (remaining > 0) {
    next.setUTCDate(next.getUTCDate() + 1);
    const day = next.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  next.setUTCHours(17, 0, 0, 0);
  return next;
};

export const ensureCrmContactTables = async (client) => {
  if (crmTablesEnsured) return;
  if (!crmTablesPromise) {
    crmTablesPromise = (async () => {
      for (const statement of crmTableStatements) {
        await client.query(statement);
      }
      crmTablesEnsured = true;
    })().finally(() => {
      crmTablesPromise = null;
    });
  }
  await crmTablesPromise;
};

export const getDefaultFollowUpDueAt = (now = new Date()) => addBusinessDays(now, 1).toISOString();

export const upsertCrmCustomerFromContact = async (
  client,
  organizationId,
  {
    name,
    email,
    phone,
    segmentOverride = "prospect",
  } = {}
) => {
  const input = buildCustomerInput({ name, email, phone });
  if (input.errors.length) {
    const error = new Error("Valid customer identity details are required.");
    error.code = input.errors[0].code;
    throw error;
  }

  const duplicates = await findCustomerDuplicates(client, organizationId, input.value, { includeArchived: true });
  const existing = duplicates.find((candidate) => candidate.matchReason.startsWith("exact_"));
  if (existing) {
    if (!existing.deletedAt) return existing;
    const restored = await client.query(
      `UPDATE "customer"
       SET "deletedAt" = NULL, "deletedByUserId" = NULL, "segmentOverride" = 'prospect', "updatedAt" = NOW()
       WHERE id = $1 AND "organizationId" = $2
       RETURNING id, reference, "customerType", name, email, phone, "segmentOverride", "createdAt", "updatedAt"`,
      [existing.id, organizationId]
    );
    return restored.rows[0];
  }

  const customer = await createCustomer(client, organizationId, input.value);
  const safeSegment = CUSTOMER_SEGMENTS.has(segmentOverride) ? segmentOverride : "prospect";
  const result = await client.query(
    `UPDATE "customer" SET "segmentOverride" = $1, "updatedAt" = NOW()
     WHERE id = $2 AND "organizationId" = $3
     RETURNING id, reference, "customerType", name, email, phone, "segmentOverride", "createdAt", "updatedAt"`,
    [safeSegment, customer.id, organizationId]
  );
  return result.rows[0] || customer;
};

export const createCrmContactRequest = async (
  client,
  organizationId,
  {
    name,
    email,
    phone,
    topic,
    eventDate,
    location,
    message,
    source = "contact_form",
    metadata = {},
  } = {}
) => {
  await ensureCrmContactTables(client);
  const followUpDueAt = getDefaultFollowUpDueAt();

  await client.query("BEGIN");
  try {
    const customer = await upsertCrmCustomerFromContact(client, organizationId, {
      name,
      email,
      phone,
      segmentOverride: "prospect",
    });

    const requestRes = await client.query(
      `INSERT INTO "contactRequest" (
        "organizationId",
        "customerId",
        source,
        status,
        priority,
        name,
        email,
        phone,
        topic,
        "eventDate",
        location,
        message,
        "followUpDueAt",
        metadata,
        "createdAt",
        "updatedAt"
      ) VALUES ($1, $2, $3, 'new', 'normal', $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, NOW(), NOW())
      RETURNING id, "customerId", source, status, priority, topic, "eventDate", location, message, "followUpDueAt", "createdAt"`,
      [
        organizationId,
        customer.id,
        source,
        name,
        email,
        phone,
        topic || null,
        eventDate || null,
        location || null,
        message,
        followUpDueAt,
        JSON.stringify(metadata || {}),
      ]
    );
    const request = requestRes.rows[0];

    const activityRes = await client.query(
      `INSERT INTO "customerActivity" (
        "organizationId",
        "customerId",
        "contactRequestId",
        type,
        title,
        description,
        status,
        metadata,
        "createdAt",
        "updatedAt"
      ) VALUES ($1, $2, $3, 'contact_request', $4, $5, 'done', $6::jsonb, NOW(), NOW())
      RETURNING id, type, title, description, status, "createdAt"`,
      [
        organizationId,
        customer.id,
        request.id,
        topic ? `Planning brief: ${topic}` : "Planning brief received",
        message,
        JSON.stringify({
          source,
          eventDate: eventDate || null,
          location: location || null,
        }),
      ]
    );

    const taskRes = await client.query(
      `INSERT INTO "customerActivity" (
        "organizationId",
        "customerId",
        "contactRequestId",
        type,
        title,
        description,
        status,
        "dueAt",
        metadata,
        "createdAt",
        "updatedAt"
      ) VALUES ($1, $2, $3, 'follow_up_task', 'Follow up on planning brief', $4, 'open', $5, $6::jsonb, NOW(), NOW())
      RETURNING id, type, title, description, status, "dueAt", "createdAt"`,
      [
        organizationId,
        customer.id,
        request.id,
        topic ? `Reply with availability and options for ${topic}.` : "Reply with availability and options.",
        followUpDueAt,
        JSON.stringify({ source, requestStatus: "new" }),
      ]
    );

    await client.query("COMMIT");
    return {
      customer,
      request,
      activity: activityRes.rows[0],
      task: taskRes.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
};
