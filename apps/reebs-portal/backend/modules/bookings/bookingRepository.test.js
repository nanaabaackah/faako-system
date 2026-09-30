import assert from "node:assert/strict";
import test from "node:test";

import {
  findBookingById,
  listBookings,
  resolveOrganizationUserId,
} from "./bookingRepository.js";

const createClient = (rows = []) => {
  const calls = [];
  return {
    calls,
    async query(text, values) {
      calls.push({ text, values });
      return { rows, rowCount: rows.length };
    },
  };
};

test("compact booking lists omit item aggregation and remain organization scoped", async () => {
  const client = createClient([{ id: 4 }]);
  const rows = await listBookings(client, 12, { compact: true });

  assert.deepEqual(rows, [{ id: 4 }]);
  assert.deepEqual(client.calls[0].values, [12]);
  assert.match(client.calls[0].text, /b\."organizationId" = \$1/);
  assert.match(client.calls[0].text, /"payableType" = 'BOOKING'/);
  assert.match(client.calls[0].text, /"amountPaidCents"/);
  assert.doesNotMatch(client.calls[0].text, /json_agg/);
});

test("full booking detail is constrained by booking and organization", async () => {
  const client = createClient([{ id: 8, items: [] }]);
  const booking = await findBookingById(client, 31, 8);

  assert.equal(booking.id, 8);
  assert.deepEqual(client.calls[0].values, [8, 31]);
  assert.match(client.calls[0].text, /json_agg/);
  assert.match(client.calls[0].text, /b\."organizationId" = \$2/);
});

test("user resolution enforces organization scope when provided", async () => {
  const client = createClient([{ id: 7 }]);
  const userId = await resolveOrganizationUserId(client, "7", 3);

  assert.equal(userId, 7);
  assert.deepEqual(client.calls[0].values, [7, 3]);
  assert.match(client.calls[0].text, /"organizationId" = \$2/);
});
