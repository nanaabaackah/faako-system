import { createServer } from "node:http";
import pg from "pg";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { EnquiryStore } from "./contact/store.js";
import { processPendingEnquiries } from "./contact/delivery.js";

const config = loadConfig(process.env);
const pool = config.enabled ? new pg.Pool({
  connectionString: config.databaseUrl, max: 3,
  connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000
}) : null;
const store = pool ? new EnquiryStore(pool) : undefined;

async function start() {
  // Fail closed if the private migration has not been applied. No messages
  // should be accepted into a partially configured runtime.
  if (pool) await pool.query("SELECT id FROM ttngh_contact.enquiries LIMIT 0");
  const server = createServer(createApp(config, { enquiryStore: store }));
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  let processing = false;
  let stopping = false;
  const dispatch = async () => {
    if (!store || processing || stopping) return;
    processing = true;
    try {
      const result = await processPendingEnquiries(store, config, { limit: 20 });
      if (result.failed) console.warn("TTNGH enquiry mail deferred for retry");
    } catch {
      console.warn("TTNGH enquiry outbox processing deferred");
    } finally { processing = false; }
  };
  const interval = setInterval(() => { void dispatch(); }, 15000);
  interval.unref();
  server.listen(Number(process.env.PORT || 5180), "0.0.0.0", () => { void dispatch(); });

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
  console.error("TTNGH API startup failed. Verify the dedicated database connection and enquiry migration.");
  if (pool) await pool.end().catch(() => {});
  process.exitCode = 1;
});
