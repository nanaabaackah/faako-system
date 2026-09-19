import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBookingEditorState,
  buildBookingsSearch,
  formatDate,
  normalizeBookingTimeInput,
  normalizeBookingView,
} from "./bookingViewModel.js";

test("booking URL state keeps supported filters and drops invalid values", () => {
  const search = buildBookingsSearch({
    query: "Ama",
    status: "confirmed",
    assigned: "7",
    timing: "next7",
    view: "board",
  });

  assert.equal(search, "?q=Ama&status=confirmed&assigned=7&timing=next7&view=board");
  assert.equal(normalizeBookingView("board", { isMobile: true }), "list");
});

test("booking editor normalization preserves dates, times, prices, and customer linkage", () => {
  const state = buildBookingEditorState({
    customerId: 3,
    customerName: "Ama",
    eventDate: "2026-09-12T00:00:00.000Z",
    startTime: "2:30 PM",
    discountCents: 500,
    items: [{ productId: 4, quantity: 2, price: 12500 }],
  });

  assert.equal(state.customerId, "3");
  assert.equal(state.eventDate, "2026-09-12");
  assert.equal(state.eventEndDate, "2026-09-12");
  assert.equal(state.startTime, "14:30");
  assert.equal(state.discount, "5.00");
  assert.equal(state.items[0].price, "125.00");
});

test("date and time formatters keep established booking presentation", () => {
  assert.equal(formatDate("2026-09-12"), "12-09-26");
  assert.equal(normalizeBookingTimeInput("12:00 AM"), "00:00");
});
