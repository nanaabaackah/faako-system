import assert from "node:assert/strict";
import test from "node:test";
import {
  detectInventoryAlert,
  INVENTORY_ALERT_TYPES,
  isInventoryAlertEligible,
  shouldDispatchAlert,
} from "./src/inventoryAlerts/services.js";
import {
  buildInventoryAlertWhatsAppMessage,
  prepareInventoryAlertWhatsApp,
} from "./src/inventoryAlerts/notifications.js";
import {
  createAdminInventoryAlertRouter,
  requireCronSecret,
} from "./src/inventoryAlerts/routes.js";

const activeProduct = {
  id: "product-1",
  slug: "digital-probe",
  name: "Digital Probe Thermometer",
  isPublished: true,
  publishingStatus: "active",
};

test("detects low-stock and reorder-threshold inventory alerts", () => {
  const alert = detectInventoryAlert({
    inventoryTrackingEnabled: true,
    product: activeProduct,
    quantityOnHand: 7,
    reservedQuantity: 2,
    lowStockThreshold: 3,
    reorderThreshold: 5,
  });

  assert.equal(alert.alertType, INVENTORY_ALERT_TYPES.LOW_STOCK);
  assert.equal(alert.availableQuantity, 5);
  assert.equal(alert.reason, "reorder_threshold_reached");
});

test("detects out-of-stock inventory alerts before low-stock alerts", () => {
  const alert = detectInventoryAlert({
    inventoryTrackingEnabled: true,
    product: activeProduct,
    quantityOnHand: 2,
    reservedQuantity: 2,
    lowStockThreshold: 5,
    reorderThreshold: 5,
  });

  assert.equal(alert.alertType, INVENTORY_ALERT_TYPES.OUT_OF_STOCK);
  assert.equal(alert.availableQuantity, 0);
});

test("excludes unpublished and tracking-disabled products from alerts", () => {
  assert.equal(
    isInventoryAlertEligible({
      inventoryTrackingEnabled: false,
      product: activeProduct,
    }),
    false
  );
  assert.equal(
    detectInventoryAlert({
      inventoryTrackingEnabled: true,
      product: { ...activeProduct, publishingStatus: "draft" },
      quantityOnHand: 0,
    }),
    null
  );
  assert.equal(
    detectInventoryAlert({
      inventoryTrackingEnabled: true,
      product: { ...activeProduct, isPublished: false },
      quantityOnHand: 0,
    }),
    null
  );
});

test("uses notification attempt timestamps for cooldown deduplication", () => {
  const now = new Date("2026-05-31T12:00:00.000Z");
  assert.equal(shouldDispatchAlert({}, { now, cooldownMs: 60_000 }), true);
  assert.equal(
    shouldDispatchAlert(
      { lastNotificationAttemptAt: new Date("2026-05-31T11:59:30.000Z") },
      { now, cooldownMs: 60_000 }
    ),
    false
  );
  assert.equal(
    shouldDispatchAlert(
      { lastNotificationAttemptAt: new Date("2026-05-31T11:58:30.000Z") },
      { now, cooldownMs: 60_000 }
    ),
    true
  );
});

test("prepares provider-neutral WhatsApp alerts without exposing recipients", async () => {
  const originalRecipients = process.env.STROANE_ALERT_WHATSAPP_NUMBERS;
  process.env.STROANE_ALERT_WHATSAPP_NUMBERS = "+233200000000,+233240000000";
  const alerts = [
    {
      alertType: INVENTORY_ALERT_TYPES.LOW_STOCK,
      inventoryItem: {
        productSlug: "digital-probe",
        product: activeProduct,
      },
      availableQuantity: 2,
      reorderThreshold: 3,
    },
  ];

  const message = buildInventoryAlertWhatsAppMessage(alerts);
  const result = await prepareInventoryAlertWhatsApp({ alerts });

  assert.match(message, /Digital Probe Thermometer/);
  assert.equal(result.status, "PREPARED");
  assert.equal(result.provider, "unconfigured");
  assert.equal(result.recipientCount, 2);
  assert.equal("recipients" in result, false);

  if (originalRecipients === undefined) delete process.env.STROANE_ALERT_WHATSAPP_NUMBERS;
  else process.env.STROANE_ALERT_WHATSAPP_NUMBERS = originalRecipients;
});

test("rejects scheduled alert checks when the cron secret is absent or incorrect", () => {
  const originalSecret = process.env.STROANE_ALERT_CRON_SECRET;
  const makeResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  });

  delete process.env.STROANE_ALERT_CRON_SECRET;
  const missingConfig = makeResponse();
  requireCronSecret({ headers: {} }, missingConfig, () => assert.fail("must not continue"));
  assert.equal(missingConfig.statusCode, 503);

  process.env.STROANE_ALERT_CRON_SECRET = "configured-secret";
  const rejected = makeResponse();
  requireCronSecret(
    { headers: { authorization: "Bearer wrong-secret" } },
    rejected,
    () => assert.fail("must not continue")
  );
  assert.equal(rejected.statusCode, 401);

  if (originalSecret === undefined) delete process.env.STROANE_ALERT_CRON_SECRET;
  else process.env.STROANE_ALERT_CRON_SECRET = originalSecret;
});

test("admin alert routes apply bearer auth before private inventory alert data", async () => {
  const router = createAdminInventoryAlertRouter({ siteUser: {} });
  const authLayer = router.stack[0];
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;

  await authLayer.handle({ headers: {} }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: "Unauthorized" });
  assert.deepEqual(
    router.stack.filter((layer) => layer.route).map((layer) => layer.route.path),
    ["/inventory/alerts", "/inventory/alerts/check"]
  );
});
