import { asyncHandler } from "../utils/asyncHandler.js";

export const registerAuthRoutes = (
  app,
  {
    authMiddleware,
    loginHandler,
    getSessionHandler,
    logoutHandler,
    forgotPasswordHandler,
    setupAccountVerifyHandler,
    setupAccountCompleteHandler,
  }
) => {
  app.post("/api/auth/login", asyncHandler(loginHandler));
  if (authMiddleware && getSessionHandler) {
    app.get("/api/auth/session", authMiddleware, asyncHandler(getSessionHandler));
  }
  app.post("/api/auth/logout", asyncHandler(logoutHandler));
  app.post("/api/auth/forgot-password", asyncHandler(forgotPasswordHandler));
  app.post("/api/auth/setup-account/verify", asyncHandler(setupAccountVerifyHandler));
  app.post("/api/auth/setup-account/complete", asyncHandler(setupAccountCompleteHandler));
};
