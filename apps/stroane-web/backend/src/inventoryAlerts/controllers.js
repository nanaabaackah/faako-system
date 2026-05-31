import { sendOk } from "../apiResponse.js";
import { listInventoryAlertSummary, runInventoryAlertCheck } from "./services.js";

export const createInventoryAlertController = (prisma) => ({
  getSummary: async (_req, res) => {
    const summary = await listInventoryAlertSummary(prisma);
    return sendOk(res, { summary });
  },

  runManualCheck: async (_req, res) => {
    const result = await runInventoryAlertCheck(prisma, { trigger: "manual" });
    return sendOk(res, { result });
  },

  runScheduledCheck: async (_req, res) => {
    const result = await runInventoryAlertCheck(prisma, { trigger: "scheduled" });
    return sendOk(res, { result });
  },
});

