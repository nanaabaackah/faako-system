import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../validation/validate.js";
import {
  forgotPasswordSchema,
  loginSchema,
  setupAccountCompleteSchema,
  setupAccountVerifySchema,
} from "../validation/schemas.js";

export const registerAuthRoutes = (
  app,
  {
    authMiddleware,
    loginHandler,
    getSessionHandler,
    logoutHandler,
    refreshHandler,
    forgotPasswordHandler,
    setupAccountVerifyHandler,
    setupAccountCompleteHandler,
  }
) => {
  app.post("/api/auth/login", validate(loginSchema), asyncHandler(loginHandler));
  if (authMiddleware && getSessionHandler) {
    app.get("/api/auth/session", authMiddleware, asyncHandler(getSessionHandler));
  }
  app.post("/api/auth/logout", asyncHandler(logoutHandler));
  if (refreshHandler) {
    app.post("/api/auth/refresh", asyncHandler(refreshHandler));
  }
  app.post("/api/auth/forgot-password", validate(forgotPasswordSchema), asyncHandler(forgotPasswordHandler));
  app.post("/api/auth/setup-account/verify", validate(setupAccountVerifySchema), asyncHandler(setupAccountVerifyHandler));
  app.post("/api/auth/setup-account/complete", validate(setupAccountCompleteSchema), asyncHandler(setupAccountCompleteHandler));
};
