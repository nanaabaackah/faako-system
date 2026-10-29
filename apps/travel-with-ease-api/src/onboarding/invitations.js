import { createHash, randomBytes, randomUUID } from "node:crypto";
import { transaction } from "../db/database.js";
import { appendAudit } from "../audit.js";
import { ContentError } from "../content/schema.js";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const deny = () => {
  throw new ContentError(
    403,
    "permission_error",
    "This activation or invitation is not available. Ask the workspace owner or installer to review your access.",
  );
};
export class Invitations {
  constructor(
    pool,
    organisationId,
    settings,
    environment,
    installerSubject = "",
  ) {
    if (
      typeof installerSubject !== "string" ||
      installerSubject.length > 255 ||
      installerSubject !== installerSubject.trim()
    )
      throw new Error(
        "TWE_SETUP_OPERATOR_SUBJECT must be an exact verified subject or empty.",
      );
    Object.assign(this, {
      pool,
      organisationId,
      settings,
      environment,
      installerSubject,
    });
  }
  matches(identity) {
    return (
      identity.issuer === this.settings.issuer &&
      identity.audience === this.settings.audience
    );
  }
  installer(identity) {
    return (
      this.matches(identity) &&
      Boolean(this.installerSubject) &&
      identity.subject === this.installerSubject
    );
  }
  lock(client) {
    // Same lock as the reviewed bootstrap fallback. Does not grant the runtime
    // role UPDATE authority on the organisation registry.
    return client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('twe-invitations:' || $1, 0))",
      [this.organisationId],
    );
  }
  async ownerExists(client) {
    return (
      (
        await client.query(
          "SELECT 1 FROM twe.staff_users WHERE organisation_id=$1 AND role='owner'",
          [this.organisationId],
        )
      ).rowCount > 0
    );
  }
  async identityStatus(identity) {
    if (!this.matches(identity)) deny();
    const {
      rows: [user],
    } = await this.pool.query(
      "SELECT active,role FROM twe.staff_users WHERE organisation_id=$1 AND issuer=$2 AND subject=$3 AND access_audience=$4",
      [
        this.organisationId,
        identity.issuer,
        identity.subject,
        identity.audience,
      ],
    );
    const {
      rows: [org],
    } = await this.pool.query(
      "SELECT name FROM twe.organisations WHERE id=$1",
      [this.organisationId],
    );
    return {
      status: user
        ? user.active
          ? "active"
          : "disabled"
        : "invitation_required",
      subject: identity.subject,
      organisation: org?.name,
      role: user?.role,
      canIssueOwner:
        this.installer(identity) && !(await this.ownerExists(this.pool)),
    };
  }
  async checkOwner(client, actor) {
    if (actor?.organisationId !== this.organisationId) deny();
    const { rowCount } = await client.query(
      "SELECT 1 FROM twe.staff_users WHERE organisation_id=$1 AND id=$2 AND role='owner' AND active=true FOR SHARE",
      [this.organisationId, actor.id],
    );
    if (!rowCount) deny();
  }
  audit(client, actorId, action, recordId, requestId) {
    return appendAudit(client, {
      organisationId: this.organisationId,
      actorId,
      action,
      recordId,
      requestId,
    });
  }
  async issue({ actor, identity, subject, approvalReference, requestId }) {
    return transaction(this.pool, async (client) => {
      await this.lock(client);
      const role = actor ? "editor" : "owner";
      if (actor) await this.checkOwner(client, actor);
      else if (!this.installer(identity) || (await this.ownerExists(client)))
        deny();
      const existing = await client.query(
        "SELECT 1 FROM twe.staff_users WHERE organisation_id=$1 AND issuer=$2 AND subject=$3",
        [this.organisationId, this.settings.issuer, subject],
      );
      if (existing.rowCount) deny();
      await client.query(
        "UPDATE twe.staff_invitations SET revoked_at=now() WHERE organisation_id=$1 AND subject=$2 AND accepted_at IS NULL AND revoked_at IS NULL",
        [this.organisationId, subject],
      );
      const id = randomUUID(),
        code = randomBytes(32).toString("base64url");
      const expiresAt = new Date(
        Date.now() + (actor ? 24 : 1) * 3600000,
      ).toISOString();
      const issuerHash = digest(
        actor
          ? `staff:${actor.id}`
          : `${identity.issuer}\n${identity.subject}\n${identity.audience}`,
      );
      await client.query(
        "INSERT INTO twe.staff_invitations(id,organisation_id,environment,issuer,audience,subject,role,token_hash,approval_reference,created_by,expires_at,issued_by_identity_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [
          id,
          this.organisationId,
          this.environment,
          this.settings.issuer,
          this.settings.audience,
          subject,
          role,
          digest(code),
          approvalReference,
          actor?.id || null,
          expiresAt,
          issuerHash,
        ],
      );
      await this.audit(
        client,
        actor?.id || null,
        actor
          ? "staff.invitation_issued"
          : "staff.initial_owner_invitation_issued",
        id,
        requestId,
      );
      return { id, code, role, expiresAt };
    });
  }
  async list(actor) {
    return transaction(this.pool, async (client) => {
      await this.checkOwner(client, actor);
      return (
        await client.query(
          "SELECT id,role,created_at,expires_at,accepted_at,revoked_at FROM twe.staff_invitations WHERE organisation_id=$1 ORDER BY created_at DESC LIMIT 100",
          [this.organisationId],
        )
      ).rows;
    });
  }
  async revoke({ actor, identity, id, requestId }) {
    return transaction(this.pool, async (client) => {
      await this.lock(client);
      if (actor) await this.checkOwner(client, actor);
      else if (!this.installer(identity) || (await this.ownerExists(client)))
        deny();
      const result = await client.query(
        "UPDATE twe.staff_invitations SET revoked_at=now() WHERE organisation_id=$1 AND id=$2 AND role=$3 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id",
        [this.organisationId, id, actor ? "editor" : "owner"],
      );
      if (!result.rowCount) deny();
      await this.audit(
        client,
        actor?.id || null,
        "staff.invitation_revoked",
        id,
        requestId,
      );
      return { revoked: true };
    });
  }
  async limitAttempts(identity) {
    if (!this.matches(identity)) deny();
    // Intentionally committed separately: invalid claims must consume the limit.
    const {
      rows: [attempt],
    } = await this.pool.query(
      "INSERT INTO twe.activation_attempts(organisation_id,identity_hash) VALUES($1,$2) ON CONFLICT(organisation_id,identity_hash) DO UPDATE SET attempts=CASE WHEN twe.activation_attempts.window_start < now()-interval '15 minutes' THEN 1 ELSE twe.activation_attempts.attempts+1 END, window_start=CASE WHEN twe.activation_attempts.window_start < now()-interval '15 minutes' THEN now() ELSE twe.activation_attempts.window_start END RETURNING attempts",
      [
        this.organisationId,
        digest(`${identity.issuer}\n${identity.subject}\n${identity.audience}`),
      ],
    );
    if (attempt.attempts > 10)
      throw new ContentError(
        429,
        "rate_limited",
        "Too many activation attempts. Wait 15 minutes before trying again.",
      );
  }
  async preview(identity, code) {
    await this.limitAttempts(identity);
    return transaction(this.pool, async (client) => {
      const {
        rows: [invite],
      } = await client.query(
        "SELECT role,created_by,expires_at FROM twe.staff_invitations WHERE organisation_id=$1 AND environment=$2 AND issuer=$3 AND audience=$4 AND subject=$5 AND token_hash=$6 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()",
        [
          this.organisationId,
          this.environment,
          identity.issuer,
          identity.audience,
          identity.subject,
          digest(code),
        ],
      );
      if (!invite) deny();
      if (invite.role === "owner") {
        if (await this.ownerExists(client)) deny();
      } else
        await this.checkOwner(client, {
          id: invite.created_by,
          organisationId: this.organisationId,
        });
      return { role: invite.role, expiresAt: invite.expires_at };
    });
  }
  async claim(identity, code, requestId) {
    await this.limitAttempts(identity);
    try {
      return await transaction(this.pool, async (client) => {
        await this.lock(client);
        const {
          rows: [invite],
        } = await client.query(
          "SELECT * FROM twe.staff_invitations WHERE organisation_id=$1 AND token_hash=$2 FOR UPDATE",
          [this.organisationId, digest(code)],
        );
        if (
          !invite ||
          invite.environment !== this.environment ||
          invite.issuer !== identity.issuer ||
          invite.audience !== identity.audience ||
          invite.subject !== identity.subject ||
          invite.accepted_at ||
          invite.revoked_at ||
          new Date(invite.expires_at) <= new Date()
        )
          deny();
        if (invite.role === "owner") {
          if (await this.ownerExists(client)) deny();
        } else
          await this.checkOwner(client, {
            id: invite.created_by,
            organisationId: this.organisationId,
          });
        const existing = await client.query(
          "SELECT 1 FROM twe.staff_users WHERE issuer=$1 AND subject=$2",
          [identity.issuer, identity.subject],
        );
        if (existing.rowCount) deny();
        const id = randomUUID();
        await client.query(
          "INSERT INTO twe.staff_users(id,organisation_id,issuer,subject,access_audience,role,active) VALUES($1,$2,$3,$4,$5,$6,true)",
          [
            id,
            this.organisationId,
            identity.issuer,
            identity.subject,
            identity.audience,
            invite.role,
          ],
        );
        await client.query(
          "UPDATE twe.staff_invitations SET accepted_at=now() WHERE id=$1 AND organisation_id=$2",
          [invite.id, this.organisationId],
        );
        await client.query(
          "INSERT INTO twe.tutorial_progress(organisation_id,user_id) VALUES($1,$2)",
          [this.organisationId, id],
        );
        await this.audit(
          client,
          id,
          "staff.invitation_accepted",
          invite.id,
          requestId,
        );
        return { activated: true, role: invite.role };
      });
    } catch (error) {
      await this.audit(
        this.pool,
        null,
        "staff.activation_denied",
        null,
        requestId,
      );
      throw error;
    }
  }
}
