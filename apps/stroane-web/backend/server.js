import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prismaPkg from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  createApiRateLimitMiddleware,
  createCorsOriginValidator,
  createSecurityHeadersMiddleware,
  createUnsafeApiDefaultDenyMiddleware,
  resolveAllowedOrigins,
  resolveTrustProxySetting,
} from "./security.js";
import {
  createCatalogueInquiry,
  getBusinessProfile,
  getCatalogueProductBySlug,
  getPersistedCatalogueProductBySlug,
  listCatalogueCategories,
  listCatalogueProducts,
  listPersistedCatalogueCategories,
  listPersistedCatalogueProducts,
  toCatalogueInquiryRecord,
} from "./src/catalogue.js";
import {
  buildPaystackPreparation,
  prepareCommerceOrder,
  toPublicCommerceOrder,
  validateCommerceOrderPaymentReadiness,
} from "./src/orders.js";
import {
  PAYMENT_STATUSES,
  buildOrderPaymentAmount,
  buildPaystackReference,
  initializePaystackTransaction,
  mapPaystackStatus,
  mapPaystackWebhookPaymentStatus,
  toSafePaystackMetadata,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from "./src/paystack.js";
import {
  ORDER_NOTIFICATION_STATUSES,
  ORDER_NOTIFICATION_TYPES,
  sendCustomerOrderEmail,
} from "./src/orderNotifications.js";
import { createAdminOrdersRouter } from "./src/adminOrders.js";
import { createAdminInventoryRouter } from "./src/inventory/routes.js";
import {
  createAdminInventoryAlertRouter,
  createInternalInventoryAlertRouter,
} from "./src/inventoryAlerts/routes.js";
import { createAdminProductRouter } from "./src/products/routes.js";
import { createAuthRouter } from "./src/routes/auth.js";

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config({ path: path.join(appDirectory, ".env") });
if (process.env.APP_ENV === "development") {
  dotenv.config({ path: path.join(appDirectory, ".env.development"), override: true });
}

const { PrismaClient } = prismaPkg;

const normalizeEnvironmentName = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "dev") return "development";
  if (normalized === "prod") return "production";
  return normalized;
};

const runtimeEnvironment = normalizeEnvironmentName(
  process.env.APP_ENV || process.env.NODE_ENV || "development"
);

// Initialize Prisma Client with PostgreSQL adapter. Prefer environment-specific
// database URLs, then fall back to DATABASE_URL for Railway-style deploys.
const connectionString =
  runtimeEnvironment === "production"
    ? process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL
    : process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Stroane API configuration error: DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 3000;
const trustProxySetting = resolveTrustProxySetting(process.env);
const PAYSTACK_WEBHOOK_PATH = "/api/paystack/webhook";
const authRateLimit = createApiRateLimitMiddleware({
  keyPrefix: "auth",
  limit: 20,
  windowMs: 10 * 60_000,
});
const inquiryRateLimit = createApiRateLimitMiddleware({
  keyPrefix: "inquiry",
  limit: 12,
  windowMs: 10 * 60_000,
});
const checkoutRateLimit = createApiRateLimitMiddleware({
  keyPrefix: "checkout",
  limit: 20,
  windowMs: 10 * 60_000,
});
const paymentInitRateLimit = createApiRateLimitMiddleware({
  keyPrefix: "paystack-init",
  limit: 12,
  windowMs: 10 * 60_000,
});
const paymentVerifyRateLimit = createApiRateLimitMiddleware({
  keyPrefix: "paystack-verify",
  limit: 30,
  windowMs: 10 * 60_000,
});
const webhookRateLimit = createApiRateLimitMiddleware({
  keyPrefix: "paystack-webhook",
  limit: 300,
  windowMs: 60_000,
});
const adminRateLimit = createApiRateLimitMiddleware({
  keyPrefix: "admin",
  limit: 120,
  windowMs: 10 * 60_000,
});
const inventoryAlertRateLimit = createApiRateLimitMiddleware({
  keyPrefix: "inventory-alert",
  limit: 20,
  windowMs: 10 * 60_000,
});

const getCatalogueCategoriesForResponse = async () => {
  try {
    const [categories, products] = await Promise.all([
      listPersistedCatalogueCategories(prisma),
      listPersistedCatalogueProducts(prisma),
    ]);
    if (categories.length && products.length) {
      return { categories, source: "stroane-catalogue-db" };
    }
  } catch (error) {
    console.warn("Falling back to catalogue seed categories:", toSafeErrorLog(error));
  }

  return { categories: listCatalogueCategories(), source: "stroane-catalogue-seed" };
};

const getCatalogueProductsForResponse = async (filters = {}) => {
  try {
    const hasPersistedCatalogue = (await listPersistedCatalogueProducts(prisma)).length > 0;
    if (hasPersistedCatalogue) {
      const products = await listPersistedCatalogueProducts(prisma, filters);
      const categoryResult = await getCatalogueCategoriesForResponse();
      return {
        products,
        categories: categoryResult.categories,
        source: "stroane-catalogue-db",
      };
    }
  } catch (error) {
    console.warn("Falling back to catalogue seed products:", toSafeErrorLog(error));
  }

  return {
    products: listCatalogueProducts(filters),
    categories: listCatalogueCategories(),
    source: "stroane-catalogue-seed",
  };
};

const sanitizeNotificationError = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 240);

const toSafeErrorLog = (error) => ({
  message: sanitizeNotificationError(error?.message || "Unknown error"),
  code: error?.code || undefined,
  statusCode: error?.statusCode || undefined,
});

const isDatabaseSchemaReadinessError = (error) =>
  ["P2021", "P2022"].includes(String(error?.code || ""));

const updateOrderNotificationMetadata = async (orderId, data) => {
  if (!prisma.commerceOrder?.update) return null;
  return prisma.commerceOrder.update({
    where: { id: orderId },
    data,
  });
};

const sendPaymentConfirmedNotification = async (order) => {
  if (!order || order.customerNotificationSentAt) {
    return {
      status: order?.customerNotificationSentAt
        ? ORDER_NOTIFICATION_STATUSES.SENT
        : ORDER_NOTIFICATION_STATUSES.SKIPPED,
      reason: order?.customerNotificationSentAt ? "already_sent" : "missing_order",
    };
  }

  try {
    const result = await sendCustomerOrderEmail({
      order,
      type: ORDER_NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
    });

    if (result.sent) {
      await updateOrderNotificationMetadata(order.id, {
        customerNotificationStatus: ORDER_NOTIFICATION_STATUSES.SENT,
        customerNotificationType: ORDER_NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
        customerNotificationSentAt: new Date(),
        customerNotificationProviderId: result.providerId,
        customerNotificationError: null,
      });
    } else {
      await updateOrderNotificationMetadata(order.id, {
        customerNotificationStatus: ORDER_NOTIFICATION_STATUSES.SKIPPED,
        customerNotificationType: ORDER_NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
        customerNotificationError: result.reason || "notification_skipped",
      });
    }

    return result;
  } catch (error) {
    const message = sanitizeNotificationError(
      error?.message || "Unable to send order confirmation email."
    );
    console.warn("Stroane order confirmation email failed", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      error: message,
    });

    try {
      await updateOrderNotificationMetadata(order.id, {
        customerNotificationStatus: ORDER_NOTIFICATION_STATUSES.FAILED,
        customerNotificationType: ORDER_NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
        customerNotificationError: message,
      });
    } catch (metadataError) {
      console.warn(
        "Unable to update Stroane order notification metadata",
        metadataError?.message || metadataError
      );
    }

    return {
      status: ORDER_NOTIFICATION_STATUSES.FAILED,
      reason: message,
      sent: false,
    };
  }
};

const resolvePaidOrderStatus = (status) =>
  ["PAID", "PROCESSING", "COMPLETED"].includes(String(status || "").toUpperCase())
    ? status
    : "PAID";

const isOrderEligibleForPaidFinalization = (order = {}) => {
  const status = String(order.status || "").toUpperCase();
  return ["PENDING", "PAYMENT_PENDING"].includes(status);
};

const getWebhookProviderAmount = (data = {}) => Number(data.amount) || 0;

const getWebhookProviderCurrency = (data = {}) => String(data.currency || "");

const getVerifiedProviderAmount = (transaction = {}) => Number(transaction.amount) || 0;

const getVerifiedProviderCurrency = (transaction = {}) => String(transaction.currency || "");

const normalizeCurrencyCode = (value = "") => String(value || "").trim().toUpperCase();

const buildWebhookVerificationMetadata = ({ event, webhookData, transaction, receivedAt }) => ({
  ...toSafePaystackMetadata(transaction || {}),
  confirmationSource: "webhook",
  webhookEvent: String(event || "").trim().slice(0, 80),
  webhookReference: String(webhookData?.reference || "").trim().slice(0, 120),
  webhookPayloadStatus: String(webhookData?.status || "").trim().slice(0, 40),
  webhookPayloadAmount: getWebhookProviderAmount(webhookData),
  webhookPayloadCurrency: getWebhookProviderCurrency(webhookData).slice(0, 12),
  webhookReceivedAt: receivedAt.toISOString(),
  transactionVerifiedAt: new Date().toISOString(),
});

app.disable("x-powered-by");
if (trustProxySetting) {
  app.set("trust proxy", trustProxySetting);
}

// CORS — only allow explicitly configured origins; fail closed in production.
const allowedOrigins = resolveAllowedOrigins(process.env);
app.use(
  cors({
    origin: createCorsOriginValidator({ allowedOrigins }),
    credentials: true,
  })
);
app.use(createSecurityHeadersMiddleware());
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buffer) => {
      if (req.originalUrl?.startsWith(PAYSTACK_WEBHOOK_PATH)) {
        req.rawBody = Buffer.from(buffer);
      }
    },
  })
);
app.use("/api", createApiRateLimitMiddleware({ keyPrefix: "api" }));

// Auth routes — registered before the default-deny middleware so POST/PATCH are allowed
app.use("/api/auth", authRateLimit, createAuthRouter(prisma));
app.use("/api/admin/orders", adminRateLimit, createAdminOrdersRouter(prisma));
app.use("/api/admin", adminRateLimit, createAdminProductRouter(prisma));
app.use("/api/admin", adminRateLimit, createAdminInventoryAlertRouter(prisma));
app.use("/api/admin", adminRateLimit, createAdminInventoryRouter(prisma));
app.use(
  "/api/internal/inventory/alerts",
  inventoryAlertRateLimit,
  createInternalInventoryAlertRouter(prisma)
);

// Health check route
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "stroane-api",
  });
});

// Catalogue routes are public read-only foundations for the Stroane storefront.
// Keep legacy aliases during the Railway API rollout so deployed builds
// that still call /api/products do not break while the frontend moves to
// /api/catalogue/*.
app.get(["/api/catalogue/categories", "/api/categories"], async (_req, res) => {
  try {
    const { categories, source } = await getCatalogueCategoriesForResponse();
    res.json({
      categories,
      meta: { source },
    });
  } catch (error) {
    console.error("Error fetching categories:", toSafeErrorLog(error));
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

app.get(["/api/catalogue/products", "/api/products"], async (req, res) => {
  try {
    const { products, categories, source } = await getCatalogueProductsForResponse({
      category: req.query.category,
      search: req.query.search,
    });

    res.json({
      products,
      categories,
      businessProfile: getBusinessProfile(),
      meta: {
        source,
        count: products.length,
      },
    });
  } catch (error) {
    console.error("Error fetching products:", toSafeErrorLog(error));
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.get(["/api/catalogue/products/:slug", "/api/products/:slug"], async (req, res) => {
  try {
    const slug = String(req.params.slug || "");
    let persistedProduct = null;
    try {
      persistedProduct = await getPersistedCatalogueProductBySlug(prisma, slug);
    } catch (error) {
      console.warn("Falling back to catalogue seed product:", toSafeErrorLog(error));
    }

    const product = persistedProduct || getCatalogueProductBySlug(slug);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({
      product,
      meta: {
        source: persistedProduct ? "stroane-catalogue-db" : "stroane-catalogue-seed",
      },
    });
  } catch (error) {
    console.error("Error fetching product:", toSafeErrorLog(error));
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

app.post("/api/inquiries", inquiryRateLimit, async (req, res) => {
  try {
    const result = createCatalogueInquiry(req.body);
    const record = toCatalogueInquiryRecord(result, {
      userAgent: req.get("user-agent"),
    });

    if (!prisma.catalogueInquiry?.create) {
      return res.status(503).json({
        error: "Inquiry storage is not available. Please email Stroane directly.",
      });
    }

    const savedInquiry = await prisma.catalogueInquiry.create({
      data: record,
      select: {
        id: true,
        status: true,
        createdAt: true,
        productSlug: true,
        productName: true,
        source: true,
      },
    });

    console.info("Stroane catalogue inquiry persisted", {
      inquiryId: savedInquiry.id,
      productSlug: savedInquiry.productSlug,
      source: savedInquiry.source,
    });

    res.status(201).json({
      inquiry: {
        ...result.inquiry,
        id: savedInquiry.id,
        status: "received",
        receivedAt: savedInquiry.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error?.statusCode === 400) {
      return res.status(400).json({
        error: error.message,
        details: error.details || [],
      });
    }

    console.error("Error receiving inquiry:", toSafeErrorLog(error));
    res.status(503).json({
      error: "Inquiry storage is unavailable. Please email Stroane directly.",
    });
  }
});

app.post("/api/orders", checkoutRateLimit, async (req, res) => {
  try {
    const preparedOrder = await prepareCommerceOrder(prisma, req.body);

    if (!prisma.commerceOrder?.create) {
      return res.status(503).json({
        error: "Order storage is not available. Please contact Stroane directly.",
      });
    }

    const savedOrder = await prisma.commerceOrder.create({
      data: {
        orderNumber: preparedOrder.orderNumber,
        status: preparedOrder.status,
        customerName: preparedOrder.customer.name,
        customerEmail: preparedOrder.customer.email,
        customerPhone: preparedOrder.customer.phone,
        preferredContactMethod: preparedOrder.customer.preferredContactMethod,
        businessName: preparedOrder.customer.businessName,
        deliveryAddress: preparedOrder.customer.deliveryAddress,
        deliveryNotes: preparedOrder.customer.deliveryNotes,
        currency: preparedOrder.currency,
        subtotal: preparedOrder.subtotal,
        total: preparedOrder.total,
        paymentProvider: preparedOrder.paymentProvider,
        paymentReference: preparedOrder.paymentReference,
        paymentStatus: preparedOrder.paymentStatus,
        source: preparedOrder.source,
        userAgent: req.get("user-agent") || null,
        items: {
          create: preparedOrder.lines.map((line) => ({
            productSlug: line.productSlug,
            productName: line.productName,
            sku: line.sku,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            currency: line.currency,
            snapshot: line.snapshot,
          })),
        },
      },
      include: { items: true },
    });

    console.info("Stroane commerce order prepared", {
      orderId: savedOrder.id,
      orderNumber: savedOrder.orderNumber,
      itemCount: savedOrder.items.length,
    });

    res.status(201).json({
      order: toPublicCommerceOrder(savedOrder),
      payment: buildPaystackPreparation(),
    });
  } catch (error) {
    if (error?.statusCode === 400) {
      return res.status(400).json({
        error: error.message,
        details: error.details || [],
      });
    }

    console.error("Error creating order:", toSafeErrorLog(error));
    res.status(503).json({
      error: "Order storage is unavailable. Please contact Stroane directly.",
    });
  }
});

app.post("/api/orders/:orderId/paystack/initialize", paymentInitRateLimit, async (req, res) => {
  try {
    if (!prisma.commerceOrder?.findUnique) {
      return res.status(503).json({
        error: "Order storage is not available. Please contact Stroane directly.",
      });
    }

    const order = await prisma.commerceOrder.findUnique({
      where: { id: String(req.params.orderId || "") },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    if (!["PENDING", "PAYMENT_PENDING"].includes(order.status)) {
      return res.status(409).json({
        error: "This order is not available for payment.",
      });
    }

    await validateCommerceOrderPaymentReadiness(prisma, order);
    buildOrderPaymentAmount(order);
    const reference = buildPaystackReference(order);
    const initializedPayment = await initializePaystackTransaction({ order, reference });

    await prisma.commerceOrder.update({
      where: { id: order.id },
      data: {
        status: "PAYMENT_PENDING",
        paymentProvider: "paystack",
        paymentReference: initializedPayment.reference,
        paymentStatus: PAYMENT_STATUSES.PAYMENT_PENDING,
        paymentInitializedAt: new Date(),
        paymentMetadata: {
          provider: "paystack",
          reference: initializedPayment.reference,
          amount: initializedPayment.amountMinor,
          currency: initializedPayment.currency,
          initializedAt: new Date().toISOString(),
          providerMessage: initializedPayment.providerMessage,
          testMode: initializedPayment.testMode,
        },
      },
    });

    res.json({
      payment: {
        provider: "paystack",
        status: PAYMENT_STATUSES.PAYMENT_PENDING,
        reference: initializedPayment.reference,
        authorizationUrl: initializedPayment.authorizationUrl,
        testMode: initializedPayment.testMode,
      },
    });
  } catch (error) {
    console.error("Error initializing Paystack payment:", toSafeErrorLog(error));
    res.status(error?.statusCode || 503).json({
      error: error?.message || "Unable to initialize Paystack payment.",
    });
  }
});

app.post(PAYSTACK_WEBHOOK_PATH, webhookRateLimit, async (req, res) => {
  try {
    const signature = String(req.get("x-paystack-signature") || "").trim();
    const signatureValid = verifyPaystackWebhookSignature({
      rawBody: req.rawBody,
      signature,
    });

    if (!signatureValid) {
      return res.status(401).json({ error: "Invalid Paystack webhook signature." });
    }

    const event = String(req.body?.event || "").trim();
    const data = req.body?.data && typeof req.body.data === "object" ? req.body.data : {};
    const reference = String(data.reference || "").trim();

    if (!event || !reference) {
      return res.status(400).json({ error: "Invalid Paystack webhook event." });
    }

    if (!String(event).startsWith("charge.")) {
      return res.json({
        received: true,
        ignored: true,
      });
    }

    const webhookPaymentStatus = mapPaystackWebhookPaymentStatus(event, data);
    const supportedStatus = [
      PAYMENT_STATUSES.PAYMENT_PENDING,
      PAYMENT_STATUSES.PAID,
      PAYMENT_STATUSES.FAILED,
      PAYMENT_STATUSES.ABANDONED,
    ].includes(webhookPaymentStatus);

    if (!supportedStatus) {
      return res.json({
        received: true,
        ignored: true,
      });
    }

    if (!prisma.commerceOrder?.findFirst) {
      return res.status(503).json({
        error: "Order storage is not available. Please contact Stroane directly.",
      });
    }

    const order = await prisma.commerceOrder.findFirst({
      where: { paymentReference: reference },
      include: { items: true },
    });

    if (!order) {
      console.warn("Paystack webhook reference did not match a Stroane order", {
        event,
        reference,
      });
      return res.status(202).json({
        received: true,
        matched: false,
      });
    }

    const alreadyPaid =
      order.paymentStatus === PAYMENT_STATUSES.PAID || order.status === "PAID" || Boolean(order.paidAt);
    const now = new Date();

    if (alreadyPaid) {
      if (!order.customerNotificationSentAt) {
        await sendPaymentConfirmedNotification(order);
      }

      return res.json({
        received: true,
        matched: true,
        alreadyFinalized: true,
        status: PAYMENT_STATUSES.PAID,
      });
    }

    const expected = buildOrderPaymentAmount(order);
    const transaction = await verifyPaystackTransaction(reference);
    const verifiedReference = String(transaction.reference || "").trim();
    const providerPaymentStatus = mapPaystackStatus(transaction.status);
    const providerAmount = getVerifiedProviderAmount(transaction);
    const providerCurrency = getVerifiedProviderCurrency(transaction);
    const amountMatches = providerAmount === expected.amountMinor;
    const currencyMatches =
      normalizeCurrencyCode(providerCurrency) === normalizeCurrencyCode(expected.currency);
    const referenceMatches = verifiedReference === reference;
    const safeWebhookMetadata = buildWebhookVerificationMetadata({
      event,
      webhookData: data,
      transaction,
      receivedAt: now,
    });
    const eligibleForPaidFinalization = isOrderEligibleForPaidFinalization(order);

    if (
      providerPaymentStatus === PAYMENT_STATUSES.PAID &&
      (!referenceMatches || !amountMatches || !currencyMatches || !eligibleForPaidFinalization)
    ) {
      const validationError = !referenceMatches
        ? "reference_mismatch"
        : !eligibleForPaidFinalization
          ? "order_not_eligible_for_paid_finalization"
          : "amount_or_currency_mismatch";

      await prisma.commerceOrder.update({
        where: { id: order.id },
        data: {
          paymentStatus: eligibleForPaidFinalization
            ? PAYMENT_STATUSES.FAILED
            : order.paymentStatus || PAYMENT_STATUSES.PAYMENT_PENDING,
          paymentFailedAt: eligibleForPaidFinalization ? now : order.paymentFailedAt,
          paymentConfirmationSource: "webhook",
          paymentWebhookEvent: event,
          paymentWebhookReference: reference,
          paymentWebhookProcessedAt: now,
          paymentWebhookMetadata: {
            ...safeWebhookMetadata,
            validationError,
            expectedAmount: expected.amountMinor,
            expectedCurrency: expected.currency,
            verifiedReference,
            currentOrderStatus: String(order.status || ""),
          },
          paymentMetadata: {
            ...safeWebhookMetadata,
            validationError,
            expectedAmount: expected.amountMinor,
            expectedCurrency: expected.currency,
            verifiedReference,
            currentOrderStatus: String(order.status || ""),
          },
        },
      });

      return res.json({
        received: true,
        accepted: false,
        reason: validationError,
      });
    }

    const nextPaymentStatus = providerPaymentStatus;
    const nextOrderStatus =
      nextPaymentStatus === PAYMENT_STATUSES.PAID
        ? resolvePaidOrderStatus(order.status)
        : order.status;
    const nextPaymentMetadata = safeWebhookMetadata;

    const updatedOrder = await prisma.commerceOrder.update({
      where: { id: order.id },
      data: {
        status: nextOrderStatus,
        paymentStatus: nextPaymentStatus,
        paymentVerifiedAt:
          nextPaymentStatus === PAYMENT_STATUSES.PAID ? now : order.paymentVerifiedAt,
        paymentFailedAt:
          nextPaymentStatus === PAYMENT_STATUSES.FAILED ||
          nextPaymentStatus === PAYMENT_STATUSES.ABANDONED
            ? now
            : order.paymentFailedAt,
        paidAt:
          nextPaymentStatus === PAYMENT_STATUSES.PAID
            ? data.paid_at
              ? new Date(data.paid_at)
              : order.paidAt || now
            : order.paidAt,
        paymentConfirmationSource:
          nextPaymentStatus === PAYMENT_STATUSES.PAID
            ? "webhook"
            : order.paymentConfirmationSource || "webhook",
        paymentWebhookEvent: event,
        paymentWebhookReference: reference,
        paymentWebhookProcessedAt: now,
        paymentWebhookMetadata: safeWebhookMetadata,
        paymentMetadata: nextPaymentMetadata,
      },
      include: { items: true },
    });

    if (nextPaymentStatus === PAYMENT_STATUSES.PAID) {
      await sendPaymentConfirmedNotification(updatedOrder);
    }

    return res.json({
      received: true,
      matched: true,
      status: nextPaymentStatus,
    });
  } catch (error) {
    console.error("Error handling Paystack webhook:", {
      message: error?.message || "Unknown webhook error",
    });
    return res.status(error?.statusCode || 503).json({
      error: error?.message || "Unable to process Paystack webhook.",
    });
  }
});

app.post("/api/paystack/verify", paymentVerifyRateLimit, async (req, res) => {
  try {
    const reference = String(req.body?.reference || req.query?.reference || "").trim();
    if (!reference) {
      return res.status(400).json({ error: "Payment reference is required." });
    }

    if (!prisma.commerceOrder?.findFirst) {
      return res.status(503).json({
        error: "Order storage is not available. Please contact Stroane directly.",
      });
    }

    const order = await prisma.commerceOrder.findFirst({
      where: { paymentReference: reference },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found for this payment reference." });
    }

    if (
      order.paymentStatus === PAYMENT_STATUSES.PAID &&
      order.paymentConfirmationSource === "webhook"
    ) {
      return res.json({
        order: toPublicCommerceOrder(order),
        payment: {
          provider: "paystack",
          status: PAYMENT_STATUSES.PAID,
          reference,
          confirmationSource: "webhook",
        },
      });
    }

    const expected = buildOrderPaymentAmount(order);
    const transaction = await verifyPaystackTransaction(reference);
    const providerPaymentStatus = mapPaystackStatus(transaction.status);
    const providerAmount = Number(transaction.amount) || 0;
    const providerCurrency = String(transaction.currency || "");
    const amountMatches = providerAmount === expected.amountMinor;
    const currencyMatches =
      normalizeCurrencyCode(providerCurrency) === normalizeCurrencyCode(expected.currency);
    const safeMetadata = toSafePaystackMetadata(transaction);

    if (providerPaymentStatus === PAYMENT_STATUSES.PAID && (!amountMatches || !currencyMatches)) {
      await prisma.commerceOrder.update({
        where: { id: order.id },
        data: {
          paymentStatus: PAYMENT_STATUSES.FAILED,
          paymentFailedAt: new Date(),
          paymentMetadata: {
            ...safeMetadata,
            validationError: "amount_or_currency_mismatch",
            expectedAmount: expected.amountMinor,
            expectedCurrency: expected.currency,
          },
        },
      });

      return res.status(409).json({
        error: "Payment verification failed. Please contact Stroane with your reference.",
        payment: {
          provider: "paystack",
          status: PAYMENT_STATUSES.FAILED,
          reference,
        },
      });
    }

    const orderAlreadyPaid =
      order.paymentStatus === PAYMENT_STATUSES.PAID || order.status === "PAID" || Boolean(order.paidAt);
    const callbackMetadata = {
      ...safeMetadata,
      confirmationSource: "callback_status_check",
      awaitingWebhookConfirmation:
        providerPaymentStatus === PAYMENT_STATUSES.PAID && !orderAlreadyPaid,
    };
    const responsePaymentStatus =
      providerPaymentStatus === PAYMENT_STATUSES.PAID && !orderAlreadyPaid
        ? PAYMENT_STATUSES.PAYMENT_PENDING
        : orderAlreadyPaid
          ? PAYMENT_STATUSES.PAID
          : providerPaymentStatus;

    const updatedOrder = await prisma.commerceOrder.update({
      where: { id: order.id },
      data: {
        status: orderAlreadyPaid ? resolvePaidOrderStatus(order.status) : order.status,
        paymentStatus: responsePaymentStatus,
        paymentFailedAt:
          responsePaymentStatus === PAYMENT_STATUSES.FAILED ||
          responsePaymentStatus === PAYMENT_STATUSES.ABANDONED
            ? new Date()
            : order.paymentFailedAt,
        paymentMetadata: callbackMetadata,
      },
      include: { items: true },
    });

    res.json({
      order: toPublicCommerceOrder(updatedOrder),
      payment: {
        provider: "paystack",
        status: responsePaymentStatus,
        reference,
        confirmationSource: orderAlreadyPaid
          ? order.paymentConfirmationSource || "existing_paid_order"
          : "callback_status_check",
      },
    });
  } catch (error) {
    console.error("Error verifying Paystack payment:", toSafeErrorLog(error));
    res.status(error?.statusCode || 503).json({
      error: error?.message || "Unable to verify Paystack payment.",
      payment: {
        provider: "paystack",
        status: PAYMENT_STATUSES.PAYMENT_PENDING,
      },
    });
  }
});

// All other /api routes: deny write methods until they are implemented
app.use("/api", createUnsafeApiDefaultDenyMiddleware());

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error("Unhandled Stroane backend error:", toSafeErrorLog(err));
  const schemaNotReady = isDatabaseSchemaReadinessError(err);
  res.status(err?.statusCode || (schemaNotReady ? 503 : 500)).json({
    error: err?.statusCode
      ? err.message
      : schemaNotReady
        ? "Database schema is not ready. Apply the latest Stroane migrations and restart the API."
        : "Internal server error",
  });
});

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

// Start server
if (isDirectRun) {
  app.listen(PORT, (error) => {
    if (error) {
      console.error("Unable to start Stroane backend server:", {
        message: error.message,
        code: error.code,
        port: PORT,
      });
      process.exitCode = 1;
      return;
    }

    console.log(`Stroane backend server running on port ${PORT}`);
    console.log(`Environment: ${runtimeEnvironment}`);
  });
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});
