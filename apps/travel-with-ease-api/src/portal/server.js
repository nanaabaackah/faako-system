import { fileURLToPath } from "node:url";
import { access } from "node:fs/promises";
import { createLogger } from "@faako/logger";
import { validateEnvironment } from "../config.js";
import { readAccessConfig } from "../auth/access-config.js";
import { createAccessVerifier } from "../auth/access.js";
import { createPortalApp, readPortalUpstream } from "./proxy.js";

const environment = validateEnvironment(process.env.APP_ENV, process.env.NODE_ENV);
const settings = readAccessConfig();
if (!settings) throw new Error("The portal requires Cloudflare Access settings.");
const upstream = readPortalUpstream(process.env.TWE_PORTAL_API_ORIGIN, environment);
if (upstream === settings.portalOrigin) throw new Error("Portal and API origins must differ.");
const port = Number(process.env.PORT || 5188);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT.");
const distDirectory = fileURLToPath(new URL("../../../travel-with-ease-portal/dist/", import.meta.url));
await access(`${distDirectory}/index.html`);
const logger = createLogger("travel-with-ease-portal", { environment });
const app = createPortalApp({ settings, upstream, distDirectory, verifier: createAccessVerifier(settings), logger });
const server = app.listen(port, () => logger.info({ port, environment }, "Portal listening"));
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
});
