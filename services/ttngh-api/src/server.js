import { createServer } from "node:http";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
const server = createServer(createApp(loadConfig(process.env)));
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 5000;
server.listen(Number(process.env.PORT || 5180), "0.0.0.0");
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { server.close(); setTimeout(() => process.exit(0), 10000).unref(); });
