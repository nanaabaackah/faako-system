import { createLogger as createSharedLogger } from "@faako/logger";

export const createLogger = (name) =>
  createSharedLogger("reebs-portal", {
    component: String(name || "backend").replace(/^reebs:/, ""),
  });
