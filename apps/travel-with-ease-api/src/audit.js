import { randomUUID } from "node:crypto";
import { createAuditEvent } from "@faako/audit";

// The shared helper owns event normalisation, not persistence. Persist only
// references; never raw claims, contact fields, tokens or arbitrary metadata.
export async function appendAudit(client, { organisationId, actorId = null, action, recordId = null, requestId }) {
  const event = createAuditEvent({ id: randomUUID(), application: "travel-with-ease-api", action, requestId, entityId: recordId, actor: { id: actorId }, org: { id: organisationId } });
  await client.query("INSERT INTO twe.audit_records (id, organisation_id, actor_id, action, record_id, request_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)", [event.id, organisationId, actorId, event.action, recordId, event.requestId, event.occurredAt]);
}
