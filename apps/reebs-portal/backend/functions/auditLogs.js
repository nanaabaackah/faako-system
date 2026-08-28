// Compatibility entry point. The API adapter continues to resolve the historic
// function name while implementation ownership moves into the audit domain.
export { handler } from "../modules/audit/auditLogs.js";
