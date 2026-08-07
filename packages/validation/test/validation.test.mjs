import assert from "node:assert/strict";
import test from "node:test";
import {
  authenticationRegistrationInputSchema,
  bookingInputSchema,
  bookingStatusTransitionSchema,
  contactInputSchema,
  customerFormSchema,
  customerMasterDataFormSchema,
  eventRegistrationInputSchema,
  forgotPasswordInputSchema,
  inventoryAdjustmentSchema,
  orderCreateInputSchema,
  orderStatusTransitionSchema,
  invoiceInputSchema,
  loginInputSchema,
  newsletterInputSchema,
  orderStatusTransitionSchema,
  organisationFormSchema,
  passwordResetInputSchema,
  paymentInputSchema,
  productFormSchema,
  roleAssignmentInputSchema,
  roleFormSchema,
  userAccessFormSchema,
  usernameAccessFormSchema,
  validationIssues,
  vendorFormSchema,
  deliveryUpdateSchema,
} from "../src/index.js";

test("authentication schemas preserve current Dev ERP login and reset limits", () => {
  assert.equal(
    loginInputSchema.parse({
      email: "person@example.com",
      password: "not-trimmed ",
    }).password,
    "not-trimmed ",
  );
  assert.equal(
    forgotPasswordInputSchema.safeParse({ email: "person@example.com" }).success,
    true,
  );
  assert.equal(
    passwordResetInputSchema.safeParse({
      token: "token",
      password: "12345678",
    }).success,
    true,
  );
  assert.equal(
    authenticationRegistrationInputSchema.safeParse({
      name: "Person Name",
      email: "person@example.com",
      password: "12345678",
    }).success,
    true,
  );
});

test("authentication schemas strip undeclared server-managed fields", () => {
  const result = forgotPasswordInputSchema.parse({
    email: "person@example.com",
    passwordHash: "must-not-cross-the-boundary",
    tokenVersion: 9,
  });
  assert.deepEqual(result, { email: "person@example.com" });
});

test("Stroane portal role and username inputs enforce safe identifiers", () => {
  const account = usernameAccessFormSchema.parse({
    username: " Store.Manager ",
    password: "safe-password",
    roleKey: "inventory_manager",
  });
  assert.equal(account.username, "store.manager");
  assert.equal(
    usernameAccessFormSchema.safeParse({
      username: "unsafe user",
      password: "safe-password",
      roleKey: "inventory_manager",
    }).success,
    false,
  );
  assert.equal(
    roleFormSchema.safeParse({
      name: "Inventory Manager",
      key: "inventory_manager",
      modules: ["inventory"],
      permissions: { inventory: ["view", "adjust"] },
      isActive: true,
    }).success,
    true,
  );
});

test("Stroane order status transitions accept supported states only", () => {
  assert.equal(
    orderStatusTransitionSchema.safeParse({ status: "processing" }).success,
    true,
  );
  assert.equal(
    orderStatusTransitionSchema.safeParse({ status: "unsupported" }).success,
    false,
  );
});

test("organisation and customer schemas accept string and numeric boundaries", () => {
  const organisation = organisationFormSchema.parse({
    name: " Faako Labs ",
    parentId: 2,
    defaultCurrency: "ghs",
  });
  assert.equal(organisation.name, "Faako Labs");
  assert.equal(organisation.defaultCurrency, "GHS");

  assert.equal(
    customerFormSchema.safeParse({
      name: "Customer One",
      phone: "+233 20 000 0000",
    }).success,
    true,
  );
});

test("master-data schemas preserve name-only customers and validate identity fields", () => {
  assert.equal(
    customerMasterDataFormSchema.safeParse({ name: "Walk-in customer" }).success,
    true,
  );
  assert.equal(
    customerMasterDataFormSchema.safeParse({
      name: "Walk-in customer",
      email: "invalid",
    }).success,
    false,
  );
  assert.equal(
    userAccessFormSchema.safeParse({
      firstName: "Ama",
      lastName: "Mensah",
      roleKey: "manager",
      status: "ACTIVE",
    }).success,
    true,
  );
  assert.equal(
    userAccessFormSchema.safeParse({ firstName: "", lastName: "Mensah" }).success,
    false,
  );
});

test("role assignment and vendor schemas enforce safe master-data boundaries", () => {
  assert.equal(
    roleAssignmentInputSchema.safeParse({ userId: 2, roleKey: "warehouse" }).success,
    true,
  );
  assert.equal(roleAssignmentInputSchema.safeParse({ userId: 2 }).success, false);
  assert.equal(
    roleFormSchema.safeParse({ name: "Inventory lead", key: "inventory_lead" }).success,
    true,
  );
  assert.equal(
    vendorFormSchema.safeParse({ name: "Accra Supplies", leadTimeDays: 4 }).success,
    true,
  );
  assert.equal(
    vendorFormSchema.safeParse({ name: "Accra Supplies", leadTimeDays: -1 }).success,
    false,
  );
});

test("username access validation preserves portal username rules", () => {
  const parsed = usernameAccessFormSchema.safeParse({
    username: "Team.Member",
    password: "temporary-password",
    roleKey: "VIEWER",
  });

  assert.equal(parsed.success, true);
  assert.equal(parsed.data.username, "team.member");
  assert.equal(
    usernameAccessFormSchema.safeParse({
      username: "invalid user",
      password: "temporary-password",
      roleKey: "VIEWER",
    }).success,
    false,
  );
});

test("product form excludes server-only publishing and inventory state", () => {
  const product = productFormSchema.parse({
    name: "Food-safe thermometer",
    price: "120.00",
    currency: "ghs",
    passwordHash: "not-a-product-field",
    paymentMetadata: { secret: true },
  });
  assert.equal(product.currency, "GHS");
  assert.equal("passwordHash" in product, false);
  assert.equal("paymentMetadata" in product, false);
});

test("inventory adjustments require an item or product and signed integer delta", () => {
  assert.equal(
    inventoryAdjustmentSchema.safeParse({
      inventoryItemId: "item-1",
      movementType: "ADJUSTMENT",
      quantityDelta: -2,
    }).success,
    true,
  );
  assert.equal(
    inventoryAdjustmentSchema.safeParse({
      movementType: "ADJUSTMENT",
      quantityDelta: 1,
    }).success,
    false,
  );
  assert.equal(
    inventoryAdjustmentSchema.safeParse({
      inventoryItemId: "item-1",
      movementType: "ADJUSTMENT",
      quantityDelta: 1.5,
    }).success,
    false,
  );
});

test("booking accepts an end time or duration and rejects reversed ranges", () => {
  const base = {
    attendeeName: "Client Name",
    attendeeEmail: "client@example.com",
    title: "Consultation",
    startAt: "2026-08-01T10:00:00.000Z",
  };
  assert.equal(
    bookingInputSchema.safeParse({ ...base, durationMinutes: 60 }).success,
    true,
  );
  assert.equal(
    bookingInputSchema.safeParse({
      ...base,
      endAt: "2026-08-01T09:00:00.000Z",
    }).success,
    false,
  );
});

test("commercial-operation schemas preserve safe prices and reject invalid transitions", () => {
  const order = orderCreateInputSchema.parse({
    customerId: 12,
    status: "pending",
    items: [{ productId: 4, quantity: 2, price: "19.50" }],
    discount: 0,
    userId: "server-owned",
  });
  assert.equal(order.items[0].price, "19.50");
  assert.equal("userId" in order, false);
  assert.equal(
    orderStatusTransitionSchema.safeParse({ status: "unsupported" }).success,
    false,
  );
  assert.equal(
    bookingStatusTransitionSchema.safeParse({ status: "confirmed" }).success,
    true,
  );
  assert.equal(
    deliveryUpdateSchema.safeParse({ status: "delivered", notes: "Left with recipient." }).success,
    true,
  );
});

test("invoice validates lines and date order", () => {
  const invoice = {
    invoiceNumber: "INV-001",
    clientName: "Client",
    issueDate: "2026-08-01",
    dueDate: "2026-08-31",
    currency: "GHS",
    lineItems: [
      {
        description: "Automation consulting",
        quantity: "1",
        unitPrice: "500.00",
      },
    ],
  };
  assert.equal(invoiceInputSchema.safeParse(invoice).success, true);
  assert.equal(
    invoiceInputSchema.safeParse({ ...invoice, dueDate: "2026-07-01" }).success,
    false,
  );
});

test("payment requires explicit currency unit and non-negative amount", () => {
  assert.equal(
    paymentInputSchema.safeParse({
      invoiceId: 12,
      amount: "100.00",
      currency: "GHS",
      unit: "major",
      method: "mobile_money",
    }).success,
    true,
  );
  assert.equal(
    paymentInputSchema.safeParse({
      amount: -1,
      currency: "GHS",
      unit: "major",
      method: "cash",
    }).success,
    false,
  );
});

test("contact schema requires at least one contact channel", () => {
  const invalid = contactInputSchema.safeParse({
    name: "Visitor Name",
    message: "Please contact me about your services.",
  });
  assert.equal(invalid.success, false);
  if (!invalid.success) {
    assert.deepEqual(
      validationIssues(invalid.error).map((issue) => issue.field),
      ["email", "phone"],
    );
  }

  assert.equal(
    contactInputSchema.safeParse({
      name: "Visitor Name",
      email: "visitor@example.com",
      message: "Please contact me about your services.",
    }).success,
    true,
  );
});

test("newsletter and event registration require affirmative consent", () => {
  assert.equal(
    newsletterInputSchema.safeParse({
      email: "reader@example.com",
      consent: true,
    }).success,
    true,
  );
  assert.equal(
    newsletterInputSchema.safeParse({
      email: "reader@example.com",
      consent: false,
    }).success,
    false,
  );
  assert.equal(
    eventRegistrationInputSchema.safeParse({
      eventId: "event-1",
      name: "Attendee",
      email: "attendee@example.com",
      consent: true,
    }).success,
    true,
  );
});
