import { randomUUID } from "node:crypto";
import { transaction } from "../db/database.js";
import { appendAudit } from "../audit.js";
import { ContentError } from "../content/schema.js";
import { hasPermission, validSupportGrant } from "./permissions.js";

const denied = () => { throw new ContentError(403, "permission_error", "Administrative permission denied."); };

export class Administration {
  constructor(pool, organisationId, settings, environment) {
    this.pool = pool; this.organisationId = organisationId; this.settings = settings; this.environment = environment;
  }
  async actor(client, actor, permission) {
    if (actor.organisationId !== this.organisationId) denied();
    const { rows } = await client.query("SELECT id, role FROM twe.staff_users WHERE organisation_id=$1 AND id=$2 AND active=true FOR SHARE", [this.organisationId, actor.id]);
    const current = rows[0] && { ...rows[0], organisationId: this.organisationId };
    if (!hasPermission(current, permission, this.organisationId)) denied();
    return current;
  }
  audit(client, actor, action, recordId, requestId) {
    return appendAudit(client, { organisationId: this.organisationId, actorId: actor.id, action, recordId, requestId });
  }
  async provision(actor, input, requestId) {
    return transaction(this.pool, async client => {
      // Platform operators can stage identities, but cannot activate business
      // access and then use a new Owner identity to approve their own elevation.
      const current = await this.actor(client, actor, actor.role === "platform_admin" ? "staff.stage" : "staff.manage");
      const active = current.role === "owner";
      const id = randomUUID();
      await client.query("INSERT INTO twe.staff_users(id,organisation_id,issuer,subject,access_audience,role,active) VALUES($1,$2,$3,$4,$5,'editor',$6)", [id,this.organisationId,this.settings.issuer,input.subject,this.settings.audience,active]);
      await this.audit(client, current, active ? "staff.provisioned" : "staff.staged", id, requestId);
      return { id, role: "editor", active };
    });
  }
  async changeStaff(actor, id, active, requestId) {
    return transaction(this.pool, async client => {
      const current = await this.actor(client, actor, actor.role === "platform_admin" ? "staff.revoke" : "staff.manage");
      if (current.role === "platform_admin" && active) denied();
      // Owner/Platform Admin bootstrap and role changes are offline reviewed
      // operations. Normal management may only activate/revoke Editors.
      const result = await client.query("UPDATE twe.staff_users SET active=$3 WHERE organisation_id=$1 AND id=$2 AND role='editor' RETURNING id,role,active", [this.organisationId,id,active]);
      if (!result.rowCount) denied();
      await client.query("UPDATE twe.staff_sessions SET revoked_at=now() WHERE organisation_id=$1 AND user_id=$2 AND revoked_at IS NULL", [this.organisationId,id]);
      await this.audit(client,current,active ? "staff.activated" : "staff.revoked",id,requestId);
      return result.rows[0];
    });
  }
  async grantSupport(actor, input, requestId) {
    return transaction(this.pool, async client => {
      const current = await this.actor(client,actor,"support.approve");
      const target = await client.query("SELECT id FROM twe.staff_users WHERE organisation_id=$1 AND id=$2 AND role='platform_admin' AND active=true FOR SHARE", [this.organisationId,input.userId]);
      if (!target.rowCount || input.userId === current.id) denied();
      const id=randomUUID();
      await client.query("INSERT INTO twe.support_grants(id,organisation_id,user_id,approved_by,permission,reason_reference,expires_at) VALUES($1,$2,$3,$4,'enquiries.read',$5,now()+$6*interval '1 minute')", [id,this.organisationId,input.userId,current.id,input.reasonReference,input.minutes]);
      await this.audit(client,current,"support.approved",id,requestId);
      return { id };
    });
  }
  async revokeSupport(actor, id, requestId) {
    return transaction(this.pool, async client => {
      const current = await this.actor(client,actor,"support.approve");
      const result = await client.query("UPDATE twe.support_grants SET revoked_at=now() WHERE organisation_id=$1 AND id=$2 AND revoked_at IS NULL RETURNING id",[this.organisationId,id]);
      if (!result.rowCount) denied();
      await this.audit(client,current,"support.revoked",id,requestId);
    });
  }
  async supportGrant(userId) {
    const { rows }=await this.pool.query(`SELECT g.* FROM twe.support_grants g JOIN twe.staff_users a ON a.organisation_id=g.organisation_id AND a.id=g.approved_by
      WHERE g.organisation_id=$1 AND g.user_id=$2 AND g.revoked_at IS NULL AND g.expires_at>now() AND a.active=true AND a.role='owner' ORDER BY g.expires_at DESC LIMIT 1`,[this.organisationId,userId]);
    return rows[0];
  }
  async auditSupportUse(actor, grant, requestId) {
    if (!validSupportGrant(grant,actor,"enquiries.read",this.organisationId)) denied();
    await this.audit(this.pool,actor,"support.enquiries_read",grant.id,requestId);
  }
  async staff(actor) {
    await this.actor(this.pool,actor,actor.role === "platform_admin" ? "staff.stage" : "staff.manage");
    const {rows}=await this.pool.query("SELECT id,role,active,created_at FROM twe.staff_users WHERE organisation_id=$1 ORDER BY created_at DESC LIMIT 100",[this.organisationId]);
    return rows;
  }
  async diagnostics(actor, requestId) {
    await this.actor(this.pool,actor,"system.read");
    const jobs=await this.pool.query("SELECT status,count(*)::int AS count FROM twe.publication_jobs WHERE organisation_id=$1 AND environment=$2 GROUP BY status",[this.organisationId,this.environment]);
    const notifications=await this.pool.query("SELECT status,count(*)::int AS count FROM twe.notification_outbox WHERE organisation_id=$1 GROUP BY status",[this.organisationId]);
    await this.audit(this.pool,actor,"system.diagnostics_read",null,requestId);
    return { environment:this.environment, database:"reachable", authentication:"cloudflare_access", hostedAcceptance:"pending", publication:jobs.rows, notifications:notifications.rows };
  }
  async revokeSessions(actor, userId, requestId) {
    return transaction(this.pool, async client => {
      const current=await this.actor(client,actor,actor.role === "owner" ? "staff.manage" : "maintenance.revoke_sessions");
      const target=await client.query("SELECT id,role FROM twe.staff_users WHERE organisation_id=$1 AND id=$2 FOR UPDATE",[this.organisationId,userId]);
      if (!target.rowCount || (current.role === "owner" && target.rows[0].role !== "editor")) denied();
      await client.query("UPDATE twe.staff_sessions SET revoked_at=now() WHERE organisation_id=$1 AND user_id=$2 AND revoked_at IS NULL",[this.organisationId,userId]);
      await client.query("UPDATE twe.support_grants SET revoked_at=now() WHERE organisation_id=$1 AND user_id=$2 AND revoked_at IS NULL",[this.organisationId,userId]);
      await this.audit(client,current,current.role === "owner" ? "staff.sessions_revoked" : "system.sessions_revoked",userId,requestId);
    });
  }
  async securityEvents(actor, requestId) {
    await this.actor(this.pool,actor,"security.read");
    const {rows}=await this.pool.query("SELECT id,action,actor_id,record_id,request_id,created_at FROM twe.audit_records WHERE organisation_id=$1 AND (action LIKE 'auth.%' OR action LIKE 'staff.%' OR action LIKE 'support.%' OR action LIKE 'system.%') ORDER BY created_at DESC LIMIT 100",[this.organisationId]);
    await this.audit(this.pool,actor,"system.security_read",null,requestId);
    return rows;
  }
  async staffEvents(actor) {
    await this.actor(this.pool,actor,"staff.manage");
    return (await this.pool.query("SELECT id,action,record_id,created_at FROM twe.audit_records WHERE organisation_id=$1 AND action LIKE 'staff.%' ORDER BY created_at DESC LIMIT 100",[this.organisationId])).rows;
  }
}
