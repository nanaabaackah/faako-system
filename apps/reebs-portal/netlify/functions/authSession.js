/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { isCrossSiteBrowserRequest, json } from "./_shared/http.js";
import { requireUser } from "./_shared/userAuth.js";

const respond = (event, statusCode, body = {}) =>
  json(event, statusCode, body, { methods: "GET, OPTIONS" });

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return respond(event, 204);
  }

  if (event.httpMethod !== "GET") {
    return respond(event, 405, { error: "Method not allowed." });
  }

  if (isCrossSiteBrowserRequest(event)) {
    return respond(event, 403, { error: "Cross-site requests are not allowed." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();

    const authUser = await requireUser(client, event);
    if (!authUser) {
      return respond(event, 401, { error: "Unauthorized" });
    }

    const result = await client.query(
      `SELECT
        id,
        "organizationId",
        role,
        email,
        "firstName",
        "lastName",
        "fullName"
       FROM "user"
       WHERE id = $1
         AND "organizationId" = $2
       LIMIT 1`,
      [Number(authUser.id), Number(authUser.organizationId)],
    );

    if (result.rowCount === 0) {
      return respond(event, 401, { error: "Unauthorized" });
    }

    return respond(event, 200, result.rows[0]);
  } catch (error) {
    console.error("Auth session check failed:", error);
    return respond(event, 500, { error: "Failed to validate session." });
  } finally {
    await client.end().catch(() => {});
  }
}
