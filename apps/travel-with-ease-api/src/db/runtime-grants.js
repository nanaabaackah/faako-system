// Static, reviewed grants only. No role creation, passwords, memberships or DDL
// authority are granted to the API. Future tables need an explicit review here.
export async function grantRuntimeAccess(client, role) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(role || "")) throw new Error("Runtime role must be a simple PostgreSQL role name.");
  const result = await client.query("SELECT oid, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication FROM pg_roles WHERE rolname = $1", [role]);
  const record = result.rows[0];
  if (!record || record.rolsuper || record.rolbypassrls || record.rolcreatedb || record.rolcreaterole || record.rolreplication) throw new Error("Runtime role is missing or privileged.");
  const memberships = await client.query("SELECT 1 FROM pg_auth_members WHERE member = $1", [record.oid]);
  if (memberships.rowCount) throw new Error("Runtime role must not inherit other roles.");
  const owns = await client.query("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'twe' AND c.relowner = $1 UNION ALL SELECT 1 FROM pg_namespace WHERE nspname = 'twe' AND nspowner = $1 UNION ALL SELECT 1 FROM pg_database WHERE datname = current_database() AND datdba = $1", [record.oid]);
  if (owns.rowCount) throw new Error("Runtime role must not own TWE schema or tables.");
  const canCreate = await client.query("SELECT has_schema_privilege($1, 'twe', 'CREATE') AS allowed", [role]);
  if (canCreate.rows[0].allowed) throw new Error("Runtime role must not have schema CREATE.");
  const identifier = `"${role}"`; // Strict allowlist above; never interpolate arbitrary input.
  await client.query(`GRANT USAGE ON SCHEMA twe TO ${identifier}`);
  await client.query(`GRANT SELECT ON twe.environment_identity, twe.schema_migrations, twe.organisations TO ${identifier}`);
  await client.query(`GRANT SELECT, INSERT, UPDATE ON twe.staff_users, twe.staff_sessions, twe.content_items, twe.media, twe.enquiries, twe.notification_outbox, twe.travel_activity, twe.publication_jobs, twe.support_grants TO ${identifier}`);
  await client.query(`GRANT SELECT, INSERT ON twe.content_revisions, twe.content_media, twe.audit_records TO ${identifier}`);
  await client.query(`GRANT SELECT, INSERT, DELETE ON twe.auth_flows TO ${identifier}`);
  await client.query(`GRANT SELECT, INSERT, UPDATE ON twe.tutorial_progress TO ${identifier}`);
  await client.query(`GRANT SELECT, INSERT, UPDATE ON twe.staff_invitations, twe.activation_attempts TO ${identifier}`);
  await client.query(`GRANT SELECT, INSERT, UPDATE ON twe.email_templates TO ${identifier}`);
}
