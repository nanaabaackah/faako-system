import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeHasDraft } from "./storeModeUtils.js";

const emptyDraft = () => ({
  orderItems: [],
  customerName: "",
  customerContact: "",
  selectedCustomer: null,
  paymentMethod: "cash",
  discountType: "amount",
  momoReference: "",
  discountValue: "",
  cashReceived: "",
});

describe("computeHasDraft", () => {
  it("returns false for a completely empty draft", () => {
    assert.equal(computeHasDraft(emptyDraft()), false);
  });

  it("returns true when orderItems are present", () => {
    assert.equal(computeHasDraft({ ...emptyDraft(), orderItems: [{ id: 1 }] }), true);
  });

  it("returns true when customerName is non-empty", () => {
    assert.equal(computeHasDraft({ ...emptyDraft(), customerName: "Ama" }), true);
  });

  it("returns false when customerName is only whitespace", () => {
    assert.equal(computeHasDraft({ ...emptyDraft(), customerName: "   " }), false);
  });

  it("returns true when customerContact is non-empty", () => {
    assert.equal(computeHasDraft({ ...emptyDraft(), customerContact: "test@example.com" }), true);
  });

  it("returns false when customerContact is only whitespace", () => {
    assert.equal(computeHasDraft({ ...emptyDraft(), customerContact: "  " }), false);
  });

  it("returns true when a customer is selected", () => {
    assert.equal(computeHasDraft({ ...emptyDraft(), selectedCustomer: { id: 5, name: "Ama" } }), true);
  });

  it("returns false when selectedCustomer has no id", () => {
    assert.equal(computeHasDraft({ ...emptyDraft(), selectedCustomer: { name: "Ama" } }), false);
  });

  it("returns false when selectedCustomer is null", () => {
    assert.equal(computeHasDraft({ ...emptyDraft(), selectedCustomer: null }), false);
  });

  it("returns true when paymentMethod is momo", () => {
    assert.equal(computeHasDraft({ ...emptyDraft(), paymentMethod: "momo" }), true);
  });

  it("returns true when discountType is percent", () => {
    assert.equal(computeHasDraft({ ...emptyDraft(), discountType: "percent" }), true);
  });

  it("returns true when momoReference is set", () => {
    assert.equal(computeHasDraft({ ...emptyDraft(), momoReference: "GH123456" }), true);
  });

  it("returns true when discountValue is set", () => {
    assert.equal(computeHasDraft({ ...emptyDraft(), discountValue: "10" }), true);
  });

  it("returns true when cashReceived is set", () => {
    assert.equal(computeHasDraft({ ...emptyDraft(), cashReceived: "50" }), true);
  });

  it("returns false when all string fields are whitespace and no items or customer", () => {
    assert.equal(
      computeHasDraft({
        ...emptyDraft(),
        customerName: " ",
        momoReference: "\t",
        discountValue: "\n",
        cashReceived: "  ",
      }),
      false
    );
  });
});
