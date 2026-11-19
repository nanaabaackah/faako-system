import { createServer } from "node:http";
import pg from "pg";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { EnquiryStore } from "./contact/store.js";
import { processPendingEnquiries } from "./contact/delivery.js";
import { createEnquiryReadiness } from "./contact/readiness.js";

const config = loadConfig(process.env);
const pool = config.enabled && config.databaseUrl ? new pg.Pool({
  connectionString: config.databaseUrl, max: 3,
  connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000
}) : null;
const store = pool ? new EnquiryStore(pool) : undefined;
const readiness = createEnquiryReadiness(pool);

async function start() {
  // Bring up /health, the calendar and CMS webhooks independently of enquiry
  // storage. The contact endpoint stays closed until both private tables exist.
  const server = createServer(createApp(config, {
    enquiryStore: store, contactReady: readiness.isReady
  }));
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  let processing = false;
  let stopping = false;
  const dispatch = async () => {
    if (!store || !readiness.isReady() || processing || stopping) return;
    processing = true;
    try {
      const result = await processPendingEnquiries(store, config, { limit: 20 });
      if (result.failed) console.warn("TTNGH enquiry mail deferred for retry");
    } catch {
      console.warn("TTNGH enquiry outbox processing deferred");
    } finally { processing = false; }
  };
  let checking = false;
  const checkAndDispatch = async () => {
    if (checking || stopping || !store) return;
    checking = true;
    try {
      if (await readiness.refresh()) await dispatch();
    } finally { checking = false; }
  };
  if (pool) {
    pool.on("error", () => {
      // pg pools emit idle-client errors independently of request handlers.
      // Never log connection strings or private database details.
      console.warn("TTNGH enquiry database pool connection lost");
      void readiness.refresh();
    });
  } else if (config.enabled) {
    console.warn("TTNGH enquiry storage unavailable: DATABASE_URL is not configured");
  }
  const interval = setInterval(() => { void checkAndDispatch(); }, 15000);
  interval.unref();
  server.listen(Number(process.env.PORT || 5180), "0.0.0.0", () => {
    void checkAndDispatch();
  });

  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(interval);
    server.close(async () => { if (pool) await pool.end(); });
    setTimeout(() => process.exit(0), 10000).unref();
  };
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, shutdown);
}
start().catch(async () => {
  console.error("TTNGH API startup failed. Verify runtime configuration.");
  if (pool) await pool.end().catch(() => {});
  process.exitCode = 1;
});
