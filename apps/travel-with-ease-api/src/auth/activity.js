import { z } from "zod";
import { ContentError } from "../content/schema.js";
import { hasPermission } from "./permissions.js";

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
  );
const cursorSchema = z
  .object({ time: z.string().datetime(), id: z.string().uuid() })
  .strict();
export const activityQuery = z
  .object({
    category: z
      .enum([
        "all",
        "content",
        "media",
        "publication",
        "staff",
        "email_template",
        "auth",
        "support",
        "system",
      ])
      .default("all"),
    from: day.optional(),
    to: day.optional(),
    cursor: z.string().max(500).optional(),
  })
  .strict();
export function decodeActivityCursor(value) {
  if (!value) return null;
  try {
    return cursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    throw new ContentError(
      400,
      "validation_error",
      "Refresh the activity list; its page reference is invalid.",
    );
  }
}
export async function readActivity(service, actor, input, security = false) {
  const query = activityQuery.parse(input);
  const permission = security ? "security.read" : "audit.business.read";
  const current = await service.actor(service.pool, actor, permission);
  if (!hasPermission(current, permission, service.organisationId))
    throw new ContentError(403, "permission_error", "Activity access denied.");
  const categories = security
    ? ["auth", "staff", "support", "system"]
    : ["content", "media", "publication", "staff", "email_template"];
  if (query.category !== "all" && !categories.includes(query.category))
    throw new ContentError(
      400,
      "validation_error",
      "Choose an available activity category.",
    );
  if (query.from && query.to && query.from > query.to)
    throw new ContentError(
      400,
      "validation_error",
      "The end date must follow the start date.",
    );
  const cursor = decodeActivityCursor(query.cursor);
  const values = [service.organisationId];
  const bind = (v) => {
    values.push(v);
    return "$" + values.length;
  };
  const clauses = [
    "a.organisation_id=$1",
    `split_part(a.action,'.',1)=ANY(${bind(query.category === "all" ? categories : [query.category])}::text[])`,
  ];
  if (!security) clauses.push("a.action NOT LIKE 'staff.bootstrap.%'");
  if (query.from) clauses.push(`a.created_at>=${bind(query.from)}::date`);
  if (query.to)
    clauses.push(`a.created_at<${bind(query.to)}::date+interval '1 day'`);
  if (cursor)
    clauses.push(
      `(a.created_at,a.id)<(${bind(cursor.time)}::timestamptz,${bind(cursor.id)}::uuid)`,
    );
  const { rows } = await service.pool.query(
    `SELECT a.id,a.action,a.actor_id,a.record_id,a.request_id,a.created_at,
    to_char(a.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time,
    r.user_id,r.previous_role,r.next_role,r.approval_reference
    FROM twe.audit_records a LEFT JOIN twe.staff_role_changes r ON r.organisation_id=a.organisation_id AND r.id=a.record_id AND a.action='staff.role_changed'
    WHERE ${clauses.join(" AND ")} ORDER BY a.created_at DESC,a.id DESC LIMIT 51`,
    values,
  );
  const page = rows.slice(0, 50),
    last = page.at(-1);
  return {
    items: page.map(({ cursor_time: _cursorTime, ...row }) => row),
    nextCursor:
      rows.length > 50
        ? Buffer.from(
            JSON.stringify({ time: last.cursor_time, id: last.id }),
          ).toString("base64url")
        : null,
  };
}
