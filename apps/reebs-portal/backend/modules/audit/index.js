export const auditModule = Object.freeze({
  domain: "audit",
  handlers: ["auditLogs", "railwayEvents"],
  migratedHandlers: ["auditLogs"],
});

export { handler as auditLogsHandler } from "./auditLogs.js";
