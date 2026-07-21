import { asyncHandler } from "../utils/asyncHandler.js";

export const registerSystemHealthAiRoutes = (
  app,
  { authMiddleware, systemHealthAiHandler }
) => {
  app.post(
    "/api/ai/system-health-diagnosis",
    authMiddleware,
    asyncHandler(systemHealthAiHandler)
  );
};
