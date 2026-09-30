import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBookingNotification,
  buildBookingWhatsAppLines,
} from "./bookingNotifications.js";

const booking = {
  id: 14,
  reference: "RB-0014",
  customerName: "Ama Mensah",
  totalAmount: 125000,
  eventDate: "2026-09-12",
  startTime: "10:00",
  endTime: "14:00",
  venueAddress: "Labone, Accra",
  items: [{ productName: "Bouncy castle", productId: 5, quantity: 2 }],
};

test("manager notification retains the existing booking summary contract", () => {
  const notification = buildBookingNotification(booking);

  assert.equal(notification.title, "New booking RB-0014");
  assert.match(notification.body, /GHS 1250\.00/);
  assert.deepEqual(notification.data, { type: "booking", id: 14 });
});

test("WhatsApp notification includes booking, venue, and line items", () => {
  const lines = buildBookingWhatsAppLines(booking);

  assert.equal(lines[0], "New booking RB-0014");
  assert.ok(lines.includes("Venue: Labone, Accra"));
  assert.ok(lines.includes("Bouncy castle x2"));
});
