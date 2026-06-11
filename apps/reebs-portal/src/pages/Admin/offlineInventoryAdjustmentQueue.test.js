import assert from "node:assert/strict";
import test from "node:test";
import { SYNC_STATES } from "@faako/offline-sync";
import {
  buildQueuedInventoryAdjustment,
  getInventoryAdjustmentFailureState,
  getQueuedInventoryAdjustmentNotice,
  isQueuedInventoryAdjustmentForScope,
} from "./offlineInventoryAdjustmentQueue.js";

test("buildQueuedInventoryAdjustment stores minimal stock adjustment payload", () => {
  const queued = buildQueuedInventoryAdjustment({
    organizationId: "org-1",
    actorId: "user-1",
    item: {
      id: 42,
      name: "Speaker",
      sku: "SPK-42",
      quantity: 8,
    },
    adjustment: {
      productId: 42,
      type: "StockOut",
      quantity: 2,
      soldMonth: "2026-05",
      notes: "Damaged during setup",
      reference: "EVT-15",
      userId: "user-1",
    },
  });

  assert.equal(queued.actionType, "ADJUST_STOCK");
  assert.equal(queued.sourceApp, "reebs-portal");
  assert.equal(queued.organizationId, "org-1");
  assert.equal(queued.actorId, "user-1");
  assert.equal(queued.status, SYNC_STATES.PENDING);
  assert.equal(queued.payload.targetType, "inventory-item");
  assert.equal(queued.payload.targetId, 42);
  assert.equal(queued.payload.endpoint.path, "/api/stock");
  assert.deepEqual(queued.payload.adjustment, {
    productId: 42,
    type: "StockOut",
    quantity: 2,
    soldMonth: "2026-05",
    notes: "Damaged during setup",
    reference: "EVT-15",
    userId: "user-1",
    userName: undefined,
    userEmail: undefined,
  });
  assert.equal(queued.payload.metadata.itemName, "Speaker");
  assert.equal(queued.payload.metadata.currentQuantity, 8);
});

test("isQueuedInventoryAdjustmentForScope filters app, org, actor, and item", () => {
  const queued = buildQueuedInventoryAdjustment({
    organizationId: "org-1",
    actorId: "user-1",
    item: { id: 7 },
    adjustment: { productId: 7, type: "StockIn", quantity: 3 },
  });

  assert.equal(
    isQueuedInventoryAdjustmentForScope(queued, {
      organizationId: "org-1",
      actorId: "user-1",
      itemId: 7,
    }),
    true
  );
  assert.equal(
    isQueuedInventoryAdjustmentForScope(queued, {
      organizationId: "org-2",
      actorId: "user-1",
      itemId: 7,
    }),
    false
  );
});

test("getQueuedInventoryAdjustmentNotice prioritizes review states", () => {
  const pending = buildQueuedInventoryAdjustment({
    organizationId: "org-1",
    actorId: "user-1",
    item: { id: 7 },
    adjustment: { productId: 7, type: "StockIn", quantity: 3 },
  });
  const review = {
    ...pending,
    id: "review",
    status: SYNC_STATES.NEEDS_REVIEW,
    retry: { lastError: "Product not found" },
  };

  const notice = getQueuedInventoryAdjustmentNotice([pending, review]);
  assert.equal(notice.status, SYNC_STATES.NEEDS_REVIEW);
  assert.equal(notice.title, "Needs review");
  assert.equal(notice.message, "Product not found");
});

test("getInventoryAdjustmentFailureState marks stock and permission failures for review", () => {
  assert.equal(
    getInventoryAdjustmentFailureState("Stock is insufficient").status,
    SYNC_STATES.NEEDS_REVIEW
  );
  assert.equal(
    getInventoryAdjustmentFailureState("Network request failed").status,
    SYNC_STATES.FAILED
  );
});
