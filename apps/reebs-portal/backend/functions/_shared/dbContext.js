/**
 * Call once per pg.Client connection, immediately after connect(), to pin
 * the session to a single organization.  All subsequent queries on that
 * client will be filtered by the org_isolation RLS policies.
 *
 * Usage:
 *   await client.connect();
 *   await setOrgContext(client, organizationId);
 *   // … all queries now scoped to organizationId
 */
export const setOrgContext = async (client, organizationId) => {
  const orgId = Number(organizationId);
  if (!Number.isFinite(orgId) || orgId <= 0) {
    throw new Error(`setOrgContext: invalid organizationId ${organizationId}`);
  }
  await client.query("SELECT set_org_context($1)", [orgId]);
};

/**
 * Clear the org context on the connection (e.g. before returning it to a pool).
 * After clearing, RLS denies all tenant rows.
 */
export const clearOrgContext = async (client) => {
  await client.query("SELECT set_config('app.current_organization_id', '', true)");
};
