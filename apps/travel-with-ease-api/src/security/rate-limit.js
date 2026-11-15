import { createHmac } from "node:crypto";
import { isIP } from "node:net";

const RAILWAY_PROXY_MODE = "railway";

export function readRateLimitConfig(env = process.env, deployed = ["staging", "production"].includes(env.APP_ENV)) {
  const proxyMode = env.TWE_PROXY_MODE || (deployed ? "" : "direct");
  if (!new Set(["direct", RAILWAY_PROXY_MODE]).has(proxyMode)) {
    throw new Error("TWE_PROXY_MODE must be direct or railway.");
  }
  if (deployed && proxyMode !== RAILWAY_PROXY_MODE) {
    throw new Error("Hosted TWE requires the reviewed Railway ingress mode.");
  }
  const secret = env.TWE_RATE_LIMIT_SECRET || "";
  if (deployed) {
    if (!/^[A-Za-z0-9_-]+$/.test(secret) || Buffer.from(secret, "base64url").length < 32) {
      throw new Error("TWE_RATE_LIMIT_SECRET must be at least 32 random base64url bytes in hosted environments.");
    }
  }
  return Object.freeze({ proxyMode, secret });
}

// Railway is the sole HTTP hop in the reviewed API topology. Trust only the
// socket peer; never trust an arbitrary-length X-Forwarded-For chain.
export const createProxyTrust = (proxyMode) => proxyMode === RAILWAY_PROXY_MODE
  ? (_address, hop) => hop === 0
  : false;

export function resolveClientAddress(req, proxyMode) {
  if (proxyMode === "direct") return req.socket?.remoteAddress || req.ip || "unknown";
  const value = req.headers?.["x-real-ip"];
  if (typeof value !== "string" || value.includes(",") || !isIP(value.trim())) {
    const error = new Error("The trusted Railway client address header is missing or invalid.");
    error.code = "trusted_client_address_unavailable";
    throw error;
  }
  return value.trim();
}

export function resolveRateLimitIdentity(req, proxyMode) {
  if (typeof req.trustedAccessIdentity === "string" && req.trustedAccessIdentity) {
    return `access:${req.trustedAccessIdentity}`;
  }
  return `ip:${resolveClientAddress(req, proxyMode)}`;
}

export function createRateLimitKey(secret, scope, clientAddress) {
  if (!secret) return clientAddress;
  return createHmac("sha256", secret).update(scope).update("\0").update(clientAddress).digest("hex");
}

export class MemoryRateLimitStore {
  constructor({ maxClients = 10_000, clock = Date.now } = {}) {
    this.maxClients = maxClients;
    this.clock = clock;
    this.clients = new Map();
    this.nextSweep = 0;
  }

  async consume({ scope, key, limit, windowMs }) {
    const now = this.clock();
    if (now >= this.nextSweep) {
      for (const [client, state] of this.clients) if (state.resetAt <= now) this.clients.delete(client);
      this.nextSweep = now + Math.min(windowMs, 60_000);
    }
    const bucket = `${scope}\0${key}`;
    if (!this.clients.has(bucket) && this.clients.size >= this.maxClients) {
      return { allowed: false, retryAfterSeconds: 60 };
    }
    const current = this.clients.get(bucket);
    const state = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    state.count += 1;
    this.clients.set(bucket, state);
    return {
      allowed: state.count <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - now) / 1000)),
    };
  }
}

export class PostgresRateLimitStore {
  constructor(pool) {
    if (!pool?.query) throw new Error("Distributed rate limiting requires PostgreSQL.");
    this.pool = pool;
  }

  async consume({ scope, key, limit, windowMs }) {
    const result = await this.pool.query(`
      WITH expired AS (
        DELETE FROM twe.rate_limit_buckets
        WHERE (scope, key_hash) IN (
          SELECT scope, key_hash FROM twe.rate_limit_buckets
          WHERE expires_at <= clock_timestamp()
          ORDER BY expires_at
          LIMIT 100
        )
      )
      INSERT INTO twe.rate_limit_buckets (scope, key_hash, request_count, expires_at)
      VALUES ($1, $2, 1, clock_timestamp() + ($3 * interval '1 millisecond'))
      ON CONFLICT (scope, key_hash) DO UPDATE SET
        request_count = CASE
          WHEN twe.rate_limit_buckets.expires_at <= clock_timestamp() THEN 1
          ELSE twe.rate_limit_buckets.request_count + 1
        END,
        expires_at = CASE
          WHEN twe.rate_limit_buckets.expires_at <= clock_timestamp()
            THEN clock_timestamp() + ($3 * interval '1 millisecond')
          ELSE twe.rate_limit_buckets.expires_at
        END
      RETURNING request_count,
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - clock_timestamp()))))::integer AS retry_after_seconds
    `, [scope, key, windowMs]);
    const row = result.rows[0];
    return { allowed: row.request_count <= limit, retryAfterSeconds: row.retry_after_seconds };
  }
}
