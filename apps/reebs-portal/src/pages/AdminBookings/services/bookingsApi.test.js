import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchBookingOverview,
  fetchRentalProducts,
  submitBooking,
} from "./bookingsApi.js";

const withFetch = async (implementation, callback) => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = implementation;
  try {
    await callback();
  } finally {
    globalThis.fetch = previousFetch;
  }
};

test("rental inventory adapter excludes sales stock and pump accessories", async () => {
  await withFetch(
    async () => new Response(JSON.stringify([
      { id: 1, sku: "RENT-CHAIR", name: "Chair" },
      { id: 2, sku: "PUM-01", sourceCategoryCode: "RENTAL", name: "Motor pump" },
      { id: 3, sku: "SALE-CUP", sourceCategoryCode: "SALE", name: "Cup" },
    ]), { status: 200 }),
    async () => {
      const products = await fetchRentalProducts();
      assert.deepEqual(products.map((item) => item.id), [1]);
    }
  );
});

test("overview does not request privileged support data for read-only users", async () => {
  const paths = [];
  await withFetch(
    async (path) => {
      paths.push(path);
      return new Response("[]", { status: 200 });
    },
    async () => {
      const overview = await fetchBookingOverview({ canManageBookings: false });
      assert.deepEqual(overview, { bookings: [], users: [], documents: [] });
      assert.deepEqual(paths, ["/api/bookings?compact=1"]);
    }
  );
});

test("booking mutation preserves idempotency headers and server errors", async () => {
  await withFetch(
    async (_path, options) => {
      assert.equal(options.headers["Idempotency-Key"], "booking-key");
      return new Response(JSON.stringify({ error: "Availability conflict" }), { status: 409 });
    },
    async () => {
      await assert.rejects(
        submitBooking({ method: "POST", payload: { customerId: 4 }, idempotencyKey: "booking-key" }),
        /Availability conflict/
      );
    }
  );
});
