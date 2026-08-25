/**
 * Compatibility aliases for the first stable REEBS API surface. The target
 * handlers remain canonical during incremental migration.
 */
export const REEBS_V1_HANDLER_ALIASES = Object.freeze({
  "/api/v1/auth/login": "login",
  "/api/v1/auth/session": "authSession",
  "/api/v1/auth/logout": "logout",
  "/api/v1/auth/forgot-password": "forgotPassword",
  "/api/v1/auth/reset-password": "resetPassword",
  "/api/v1/catalogue": "inventory",
  "/api/v1/catalogue/products": "inventory",
  "/api/v1/bookings": "bookings",
  "/api/v1/bookings/availability": "bookingAvailability",
  "/api/v1/customers": "customers",
  "/api/v1/checkout/quote": "checkoutQuote",
  "/api/v1/checkout/orders": "createOrder",
  "/api/v1/commercial-config/public": "publicCommercialConfig",
  "/api/v1/commercial-config": "commercial-config",
  "/api/v1/portal-settings": "portal-settings",
});

export const resolveReebsV1Handler = (path) =>
  REEBS_V1_HANDLER_ALIASES[String(path || "")] || null;
