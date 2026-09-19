import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCustomerInput,
  buildCustomerReference,
  normalizeCustomerEmail,
  normalizeCustomerPhone,
} from "./customerIdentity.js";

test("normalizes common Ghana phone formats to one E.164 value", () => {
  for (const value of ["0244123456", "+233244123456", "233244123456"]) {
    assert.equal(normalizeCustomerPhone(value).value, "+233244123456");
  }
});

test("preserves supported international E.164 numbers", () => {
  assert.deepEqual(normalizeCustomerPhone("+44 20 7946 0958"), {
    value: "+442079460958",
    display: "+442079460958",
    isValid: true,
    isGhanaian: false,
  });
});

test("rejects invalid phones and normalizes email case", () => {
  assert.equal(normalizeCustomerPhone("123").isValid, false);
  assert.deepEqual(normalizeCustomerEmail(" Person@Example.COM "), {
    value: "person@example.com",
    isValid: true,
  });
});

test("builds individual and organization customer inputs", () => {
  const individual = buildCustomerInput({ name: " Ama  Mensah ", phone: "0244123456" });
  assert.equal(individual.errors.length, 0);
  assert.equal(individual.value.name, "Ama Mensah");
  assert.equal(individual.value.customerType, "individual");

  const organization = buildCustomerInput({
    customerType: "organization",
    organizationName: "Acme Ghana Ltd",
    contactPersonName: "Kofi Owusu",
    email: "events@acme.test",
  });
  assert.equal(organization.errors.length, 0);
  assert.equal(organization.value.name, "Acme Ghana Ltd");
  assert.equal(organization.value.contactPersonName, "Kofi Owusu");
});

test("requires identity while preserving valid walk-in customer records", () => {
  const result = buildCustomerInput({ customerType: "organization" });
  assert.deepEqual(result.errors.map((entry) => entry.code), ["REQUIRED"]);
  assert.equal(buildCustomerInput({ name: "Walk-in customer" }).errors.length, 0);
  assert.equal(buildCustomerReference(42), "CUS-000042");
});
