import assert from "node:assert/strict";
import test from "node:test";
import { OFFLINE_QUEUE_ACTION_TYPES, SYNC_STATES } from "@faako/offline-sync";
import {
  buildQueuedBookingAction,
  getBookingQueueFailureState,
  getQueuedBookingNotice,
  isQueuedBookingForScope,
  sanitizeQueuedBookingPayload,
} from "./offlineBookingQueue.js";

test("buildQueuedBookingAction stores minimal booking create payload", () => {
  const queued = buildQueuedBookingAction({
    organizationId: "org-1",
    actorId: "user-1",
    actionType: OFFLINE_QUEUE_ACTION_TYPES.CREATE_BOOKING,
    method: "POST",
    booking: {
      customerId: 12,
      customerName: "Should not be persisted",
      eventDate: "2026-05-20",
      startTime: "10:00",
      endTime: "12:00",
      venueAddress: "Accra",
      status: "pending",
      assignedUserId: 7,
      discount: 15,
      items: [
        {
          productId: 40,
          variantId: 5,
          productName: "Castle",
          variantLabel: "Castle / Blue",
          quantity: 2,
          price: 100,
        },
      ],
      userId: "user-1",
      userName: "Ada Admin",
      userEmail: "ada@example.com",
    },
    customer: {
      id: 12,
      name: "Customer One",
      phone: "0200000000",
      email: "customer@example.com",
    },
  });

  assert.equal(queued.actionType, OFFLINE_QUEUE_ACTION_TYPES.CREATE_BOOKING);
  assert.equal(queued.sourceApp, "reebs-portal");
  assert.equal(queued.organizationId, "org-1");
  assert.equal(queued.actorId, "user-1");
  assert.equal(queued.status, SYNC_STATES.PENDING);
  assert.equal(queued.payload.targetType, "booking");
  assert.equal(queued.payload.targetId, null);
  assert.equal(queued.payload.endpoint.path, "/api/bookings");
  assert.equal(queued.payload.endpoint.method, "POST");
  assert.deepEqual(queued.payload.booking.items, [
    {
      productId: 40,
      variantId: 5,
      quantity: 2,
      price: 100,
    },
  ]);
  assert.equal(queued.payload.customer.customerId, 12);
  assert.equal(queued.payload.metadata.itemCount, 1);
});

test("sanitizeQueuedBookingPayload keeps status updates narrow", () => {
  const payload = sanitizeQueuedBookingPayload({
    id: 88,
    status: "confirmed",
    userId: "user-1",
  });

  assert.deepEqual(payload, {
    id: 88,
    status: "confirmed",
    userId: "user-1",
  });
});

test("isQueuedBookingForScope filters app, org, actor, and booking", () => {
  const queued = buildQueuedBookingAction({
    organizationId: "org-1",
    actorId: "user-1",
    actionType: OFFLINE_QUEUE_ACTION_TYPES.UPDATE_BOOKING_STATUS,
    method: "PUT",
    booking: {
      id: 88,
      status: "confirmed",
    },
  });

  assert.equal(
    isQueuedBookingForScope(queued, {
      organizationId: "org-1",
      actorId: "user-1",
      bookingId: 88,
    }),
    true
  );
  assert.equal(
    isQueuedBookingForScope(queued, {
      organizationId: "org-2",
      actorId: "user-1",
      bookingId: 88,
    }),
    false
  );
});

test("getQueuedBookingNotice prioritizes review states", () => {
  const pending = buildQueuedBookingAction({
    organizationId: "org-1",
    actorId: "user-1",
    actionType: OFFLINE_QUEUE_ACTION_TYPES.CREATE_BOOKING,
    method: "POST",
    booking: { customerId: 12, eventDate: "2026-05-20", items: [] },
  });
  const review = {
    ...pending,
    id: "review",
    status: SYNC_STATES.NEEDS_REVIEW,
    retry: { lastError: "Insufficient availability on this date" },
  };

  const notice = getQueuedBookingNotice([pending, review]);
  assert.equal(notice.status, SYNC_STATES.NEEDS_REVIEW);
  assert.equal(notice.title, "Needs review");
  assert.equal(notice.message, "Insufficient availability on this date");
});

test("getBookingQueueFailureState marks booking conflicts for review", () => {
  assert.equal(
    getBookingQueueFailureState("Insufficient availability on this date").status,
    SYNC_STATES.NEEDS_REVIEW
  );
  assert.equal(
    getBookingQueueFailureState("Network request failed").status,
    SYNC_STATES.FAILED
  );
});
