const freeze = (value) => Object.freeze(value);

export const REEBS_API_AUDIENCES = freeze({
  PUBLIC: "public", CUSTOMER: "customer", ADMIN: "admin", SYSTEM: "system", WEBHOOK: "webhook",
});
export const REEBS_BUSINESS_SCOPES = freeze({
  REEBS_CORE: "reebs-core", WATER: "water", CONSOLIDATED: "consolidated", SHARED: "shared",
});
export const REEBS_BUSINESS_UNITS = freeze({
  REEBS_CORE: "REEBS_CORE", WATER: "WATER", CONSOLIDATED: "CONSOLIDATED", SHARED: "SHARED",
});
export const REEBS_ERROR_CODES = freeze({
  AUTH_REQUIRED: "AUTH_REQUIRED", PERMISSION_DENIED: "PERMISSION_DENIED",
  VALIDATION_FAILED: "VALIDATION_FAILED", RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  BOOKING_CONFLICT: "BOOKING_CONFLICT", INVENTORY_UNAVAILABLE: "INVENTORY_UNAVAILABLE",
  PAYMENT_FAILED: "PAYMENT_FAILED", PAYMENT_ALREADY_PROCESSED: "PAYMENT_ALREADY_PROCESSED",
  CUSTOMER_NOT_FOUND: "CUSTOMER_NOT_FOUND", WATER_ORDER_NOT_FOUND: "WATER_ORDER_NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
});
export const REEBS_API_V1_ROUTES = freeze({
  LOGIN: "/api/v1/auth/login", SESSION: "/api/v1/auth/session", LOGOUT: "/api/v1/auth/logout",
  FORGOT_PASSWORD: "/api/v1/auth/forgot-password", RESET_PASSWORD: "/api/v1/auth/reset-password",
  CATALOGUE: "/api/v1/catalogue", CATALOGUE_PRODUCTS: "/api/v1/catalogue/products",
  BOOKINGS: "/api/v1/bookings", BOOKING_AVAILABILITY: "/api/v1/bookings/availability",
  CUSTOMERS: "/api/v1/customers", CHECKOUT_QUOTE: "/api/v1/checkout/quote",
  CHECKOUT_ORDERS: "/api/v1/checkout/orders",
  PORTAL_SETTINGS: "/api/v1/portal-settings",
});
export const REEBS_SAFE_ROUTE_INVENTORY = freeze([
  { route: REEBS_API_V1_ROUTES.LOGIN, methods: ["POST"], audience: "public", scope: "shared" },
  { route: REEBS_API_V1_ROUTES.SESSION, methods: ["GET"], audience: "customer", scope: "shared" },
  { route: REEBS_API_V1_ROUTES.LOGOUT, methods: ["POST"], audience: "customer", scope: "shared" },
  { route: REEBS_API_V1_ROUTES.CATALOGUE, methods: ["GET"], audience: "public", scope: "reebs-core" },
  { route: REEBS_API_V1_ROUTES.BOOKINGS, methods: ["GET", "POST", "PUT"], audience: "public/admin", scope: "reebs-core" },
  { route: REEBS_API_V1_ROUTES.BOOKING_AVAILABILITY, methods: ["GET"], audience: "public", scope: "reebs-core" },
  { route: REEBS_API_V1_ROUTES.CUSTOMERS, methods: ["GET", "POST", "PUT"], audience: "public/admin", scope: "reebs-core" },
  { route: REEBS_API_V1_ROUTES.CHECKOUT_QUOTE, methods: ["POST"], audience: "public", scope: "reebs-core" },
  { route: REEBS_API_V1_ROUTES.CHECKOUT_ORDERS, methods: ["POST"], audience: "public", scope: "reebs-core" },
  { route: REEBS_API_V1_ROUTES.PORTAL_SETTINGS, methods: ["GET", "PUT"], audience: "admin", scope: "shared" },
]);

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const pick = (value, fields) => !isObject(value) ? {} : Object.fromEntries(
  fields.filter((field) => value[field] !== undefined).map((field) => [field, value[field]]),
);
export const toReebsSessionUserDto = (user) => pick(user, [
  "id", "firstName", "lastName", "fullName", "email", "personalEmail", "role", "organizationId",
]);
export const toReebsPublicProductDto = (product) => pick(product, [
  "id", "name", "slug", "sku", "shortDescription", "longDescription", "categoryId", "categorySlug",
  "price", "compareAtPrice", "currency", "stock", "isActive", "images", "variants", "attributes",
  "rentalPrice", "rentalPeriod", "securityDeposit",
]);
export const toReebsCustomerSelfDto = (customer) => pick(customer, [
  "id", "name", "email", "phone", "businessName", "preferredContactMethod",
  "defaultDeliveryAddress", "deliveryNotes", "createdAt", "updatedAt",
]);
export const toReebsAdminCustomerDto = (customer) => pick(customer, [
  "id", "name", "email", "phone", "businessName", "preferredContactMethod",
  "defaultDeliveryAddress", "deliveryNotes", "status", "segmentOverride", "organizationId",
  "createdAt", "updatedAt",
]);
export const toReebsPaymentInitializationDto = (payment) => pick(payment, [
  "reference", "paymentReference", "authorizationUrl", "status", "currency", "expiresAt",
]);
export const withReebsAnalyticsScope = (data = {}) => ({
  ...(isObject(data) ? data : {}), scope: "reebs-core", businessUnit: "REEBS_CORE",
});
export const withWaterBusinessContext = (data = {}) => ({
  ...(isObject(data) ? data : {}), scope: "water", businessUnit: "WATER",
});
export const withSharedBusinessContext = (data = {}) => ({
  ...(isObject(data) ? data : {}), scope: "shared", businessUnit: "SHARED",
});
export const createConsolidatedAnalyticsResponse = ({ reebsCore, water } = {}) => ({
  scope: "consolidated", businessUnit: "CONSOLIDATED",
  components: { reebsCore: withReebsAnalyticsScope(reebsCore), water: withWaterBusinessContext(water) },
});
export const createReebsPaginationMeta = ({ page = 1, pageSize = 25, total = 0 } = {}) => {
  const normalizedPage = Math.max(1, Number.parseInt(String(page), 10) || 1);
  const normalizedPageSize = Math.min(100, Math.max(1, Number.parseInt(String(pageSize), 10) || 25));
  const normalizedTotal = Math.max(0, Number.parseInt(String(total), 10) || 0);
  return { page: normalizedPage, pageSize: normalizedPageSize, total: normalizedTotal, totalPages: Math.ceil(normalizedTotal / normalizedPageSize) };
};
