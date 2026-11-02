import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@faako/api-contracts";
import { transaction } from "../db/database.js";

const uuid = z.string().uuid();
const statuses = z.enum(["new", "contacted", "closed"]);
const kinds = z.enum(["personalised", "package", "legacy_estimator"]);
const update = z.object({
  status: statuses,
  expectedVersion: z.number().int().min(0).max(4294967295),
}).strict();

function publicRecord(row, detailed = false) {
  const record = {
    id: row.id, kind: row.kind, status: row.status,
    demo: row.source === "staging_demo" || row.details?.source === "staging_demo",
    contact: row.contact, created_at: row.created_at,
    ...(row.version !== undefined ? { version: Number(row.version) } : {}),
  };
  if (detailed) {
    record.details = row.details;
    record.updated_at = row.updated_at;
  }
  return record;
}

// No generated data or artificial enquiry counts. All reads are tenant-scoped.
export function enquiriesRoutes({ pool, organisationId, auth }) {
  if (!pool || !organisationId || !auth) throw new Error("Enquiry inbox requires database and staff authentication.");
  const router = Router();
  const send = (req, res, data, status = 200) =>
    res.status(status).json(createSuccessResponse(data, { requestId: req.requestId }));
  const error = (req, res, status, code, message) =>
    res.status(status).json(createErrorResponse({ code, message }, { requestId: req.requestId }));
  router.use(auth.requirePermission("enquiries.read"));

  router.get("/", async (req, res, next) => {
    try {
      const schema = z.object({
        status: statuses.optional(),
        kind: kinds.optional(),
        offset: z.coerce.number().int().min(0).max(10000).default(0),
      }).strict();
      const filters = schema.safeParse(req.query);
      if (!filters.success) return error(req, res, 400, "validation_error", "Check the enquiry filters.");
      const { status, kind, offset } = filters.data;
      const values = [organisationId];
      const conditions = ["organisation_id = $1"];
      if (status) { values.push(status); conditions.push(`status = $${values.length}`); }
      if (kind) { values.push(kind); conditions.push(`kind = $${values.length}`); }
      values.push(offset);
      const result = await pool.query(
        `SELECT id, kind, status, contact, created_at, details->>'source' AS source
          FROM twe.enquiries WHERE ${conditions.join(" AND ")}
          ORDER BY created_at DESC, id DESC LIMIT 26 OFFSET $${values.length}`, values);
      const hasMore = result.rows.length > 25;
      return send(req, res, {
        items: result.rows.slice(0, 25).map(row => publicRecord(row)),
        nextOffset: hasMore ? offset + 25 : null,
      });
    } catch (cause) { return next(cause); }
  });

  router.get("/:id", async (req, res, next) => {
    const id = uuid.safeParse(req.params.id);
    if (!id.success) return error(req, res, 400, "validation_error", "Invalid enquiry reference.");
    try {
      const result = await pool.query(
        "SELECT id, kind, status, contact, details, created_at, updated_at, xmin::text AS version FROM twe.enquiries WHERE organisation_id = $1 AND id = $2",
        [organisationId, id.data]);
      if (!result.rows.length) return error(req, res, 404, "not_found", "Enquiry not found.");
      return send(req, res, publicRecord(result.rows[0], true));
    } catch (cause) { return next(cause); }
  });

  router.post("/:id/status", auth.requireMutation, auth.requirePermission("enquiries.write"), async (req, res, next) => {
    const id = uuid.safeParse(req.params.id);
    const payload = update.safeParse(req.body);
    if (!id.success || !payload.success) return error(req, res, 400, "validation_error", "Check the enquiry status and revision.");
    try {
      const record = await transaction(pool, async client => {
        const changed = await client.query(
          `UPDATE twe.enquiries SET status = $3, updated_at = now()
           WHERE organisation_id = $1 AND id = $2 AND xmin::text = $4
           RETURNING id, kind, status, contact, details, created_at, updated_at, xmin::text AS version`,
          [organisationId, id.data, payload.data.status, String(payload.data.expectedVersion)]);
        if (!changed.rows.length) return null;
        await client.query(
          `INSERT INTO twe.audit_records (id, organisation_id, actor_id, action, record_id, request_id)
           VALUES ($1, $2, $3, 'enquiries.status_changed', $4, $5)`,
          [randomUUID(), organisationId, req.staff.id, id.data, req.requestId]);
        return changed.rows[0];
      });
      if (!record) return error(req, res, 409, "conflict", "Enquiry changed or is unavailable. Refresh before retrying.");
      return send(req, res, publicRecord(record, true));
    } catch (cause) { return next(cause); }
  });
  return router;
}
