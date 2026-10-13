import { transaction } from "../db/database.js";
import { appendAudit } from "../audit.js";

export class PostgresAuthStore {
  constructor(pool, organisationId) { this.pool = pool; this.organisationId = organisationId; }

  async saveFlow(hash, flow) {
    await transaction(this.pool, async (client) => {
      await client.query("DELETE FROM twe.auth_flows WHERE expires_at <= now()");
      await client.query("INSERT INTO twe.auth_flows (token_hash, state, nonce, verifier, expires_at) VALUES ($1, $2, $3, $4, now() + interval '5 minutes')", [hash, flow.state, flow.nonce, flow.verifier]);
    });
  }

  async consumeFlow(hash) {
    const { rows } = await this.pool.query("DELETE FROM twe.auth_flows WHERE token_hash = $1 AND expires_at > now() RETURNING state, nonce, verifier", [hash]);
    return rows[0];
  }

  async createSession(identity, tokenHash, csrfHash, requestId) {
    return transaction(this.pool, async (client) => {
      const { rows } = await client.query("SELECT id, role FROM twe.staff_users WHERE organisation_id = $1 AND issuer = $2 AND subject = $3 AND active = true FOR UPDATE", [this.organisationId, identity.issuer, identity.subject]);
      const user = rows[0];
      if (!user) return null;
      await client.query("INSERT INTO twe.staff_sessions (token_hash, organisation_id, user_id, csrf_hash, expires_at) VALUES ($1, $2, $3, $4, now() + interval '1 hour')", [tokenHash, this.organisationId, user.id, csrfHash]);
      await this.audit(client, user.id, "auth.login", requestId);
      return user;
    });
  }

  async getSession(hash) {
    const { rows } = await this.pool.query(`SELECT s.user_id AS id, s.csrf_hash, u.role, s.expires_at
      FROM twe.staff_sessions s JOIN twe.staff_users u ON u.id = s.user_id AND u.organisation_id = s.organisation_id
      WHERE s.token_hash = $1 AND s.organisation_id = $2 AND s.expires_at > now()
        AND s.revoked_at IS NULL AND u.active = true`, [hash, this.organisationId]);
    return rows[0];
  }

  async revoke(hash, requestId) {
    await transaction(this.pool, async (client) => {
      const { rows } = await client.query("UPDATE twe.staff_sessions SET revoked_at = now() WHERE token_hash = $1 AND organisation_id = $2 AND revoked_at IS NULL RETURNING user_id", [hash, this.organisationId]);
      if (rows[0]) await this.audit(client, rows[0].user_id, "auth.logout", requestId);
    });
  }

  async audit(client, actorId, action, requestId) {
    await appendAudit(client, { organisationId: this.organisationId, actorId, action, requestId });
  }
}
