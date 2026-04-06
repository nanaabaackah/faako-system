import { createExpressSecurityHeadersMiddleware as createSharedSecurityHeadersMiddleware } from "@faako/security";

export const createSecurityHeadersMiddleware = () =>
  createSharedSecurityHeadersMiddleware({
    profileId: "api-serverless",
    extraHeaders: {
      "Referrer-Policy": "no-referrer",
      "X-DNS-Prefetch-Control": "off",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
