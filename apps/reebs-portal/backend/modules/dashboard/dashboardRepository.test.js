import test from "node:test";
import assert from "node:assert/strict";
import {
  CORE_PRODUCT_FILTER,
  buildCoreBookingFilter,
  buildCoreOrderFilter,
} from "./dashboardRepository.js";

test("core product scope explicitly excludes Water category and configuration", () => {
  assert.match(CORE_PRODUCT_FILTER, /sourceCategoryCode/);
  assert.match(CORE_PRODUCT_FILTER, /<> 'WATER'/);
  assert.match(CORE_PRODUCT_FILTER, /waterProductConfig/);
});

test("core order scope uses business unit when deployed and still excludes Water items", () => {
  const columns = { order: new Set(["businessUnit"]) };
  const filter = buildCoreOrderFilter(columns, "orders_alias");
  assert.match(filter, /REEBS_CORE/);
  assert.match(filter, /waterProductConfig/);
  assert.match(filter, /orders_alias/);
});

test("core booking scope excludes bookings containing Water-configured products", () => {
  const filter = buildCoreBookingFilter("booking_alias");
  assert.match(filter, /bookingItem/);
  assert.match(filter, /waterProductConfig/);
  assert.match(filter, /booking_alias/);
});
