import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { createCustomerAccountRouter } from "./src/customerAccounts/routes.js";
import { hashPassword } from "./src/auth.js";

const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");

const toResetToken = (fill) => Buffer.alloc(32, fill).toString("base64url");

const toPublicCustomer = (customer) => ({
  id: customer.id,
  email: customer.email,
  status: customer.status,
  name: customer.name,
  phone: customer.phone,
  businessName: customer.businessName,
  preferredContactMethod: customer.preferredContactMethod,
  defaultDeliveryAddress: customer.defaultDeliveryAddress,
  deliveryNotes: customer.deliveryNotes,
  invitedAt: customer.invitedAt,
  inviteExpiresAt: customer.inviteExpiresAt,
  activatedAt: customer.activatedAt,
  lastLoginAt: customer.lastLoginAt,
  createdAt: customer.createdAt,
  updatedAt: customer.updatedAt,
});

const createCustomer = () => ({
  id: "customer-1",
  email: "client@example.com",
  status: "ACTIVE",
  name: "Client One",
  phone: "",
  businessName: "",
  preferredContactMethod: "email",
  defaultDeliveryAddress: "",
  deliveryNotes: "",
  invitedAt: null,
  inviteExpiresAt: null,
  activatedAt: new Date("2026-07-01T12:00:00.000Z"),
  lastLoginAt: null,
  createdAt: new Date("2026-07-01T12:00:00.000Z"),
  updatedAt: new Date("2026-07-01T12:00:00.000Z"),
  passwordHash: hashPassword("Old-password-1!"),
  passwordResetTokenHash: null,
  passwordResetExpiresAt: null,
  passwordResetRequestedAt: null,
  inviteTokenHash: null,
});

const createMockPrisma = (customer) => ({
  customerAccount: {
    async findFirst({ where }) {
      if (where?.email?.equals) {
        return where.email.equals.toLowerCase() === customer.email.toLowerCase() ? customer : null;
      }

      if (where?.passwordResetTokenHash) {
        const resetMatches = customer.passwordResetTokenHash === where.passwordResetTokenHash;
        const notExpired =
          !where.passwordResetExpiresAt?.gt ||
          (customer.passwordResetExpiresAt &&
            customer.passwordResetExpiresAt > where.passwordResetExpiresAt.gt);
        const notLocked = where.status?.not !== "LOCKED" || customer.status !== "LOCKED";
        return resetMatches && notExpired && notLocked ? customer : null;
      }

      return null;
    },
    async update({ where, data }) {
      assert.equal(where.id, customer.id);
      Object.assign(customer, data, { updatedAt: new Date() });
      return toPublicCustomer(customer);
    },
  },
});

const invokeRouter = (router, path, body) =>
  new Promise((resolve) => {
    const req = {
      method: "POST",
      url: path,
      originalUrl: path,
      headers: {
        "content-type": "application/json",
        "x-stroane-client": "storefront",
      },
      body,
      get(name) {
        return this.headers[String(name || "").toLowerCase()] || "";
      },
    };
    const res = {
      statusCode: 200,
      body: null,
      cookies: [],
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        resolve(this);
        return this;
      },
      cookie(name, value, options) {
        this.cookies.push({ name, value, options });
        return this;
      },
      clearCookie(name, options) {
        this.cookies.push({ name, value: "", options, clear: true });
        return this;
      },
    };

    router(req, res, (error) => {
      if (error) {
        res.status(error?.statusCode || 500).json({
          error: error?.message || "Internal server error",
        });
        return;
      }
      res.status(404).json({ error: "Not found" });
    });
  });

test("customer password reset requests replace the previous token", async () => {
  process.env.APP_AUTH_SECRET = "test-only-customer-reset-secret";
  const originalRandomBytes = crypto.randomBytes;
  const customer = createCustomer();
  const router = createCustomerAccountRouter(createMockPrisma(customer));
  let randomFill = 1;

  crypto.randomBytes = (size) => Buffer.alloc(size, randomFill);
  try {
    const firstToken = toResetToken(1);
    const secondToken = toResetToken(2);

    const firstRequest = await invokeRouter(router, "/password/forgot", {
      email: customer.email,
    });
    assert.equal(firstRequest.statusCode, 200);
    assert.equal(customer.passwordResetTokenHash, hashToken(firstToken));
    assert.ok(customer.passwordResetExpiresAt > new Date());

    randomFill = 2;
    const secondRequest = await invokeRouter(router, "/password/forgot", {
      email: customer.email,
    });
    assert.equal(secondRequest.statusCode, 200);
    assert.equal(customer.passwordResetTokenHash, hashToken(secondToken));
    assert.notEqual(customer.passwordResetTokenHash, hashToken(firstToken));

    const oldLinkAttempt = await invokeRouter(router, "/password/reset", {
      token: firstToken,
      password: "New-password-1!",
    });
    assert.equal(oldLinkAttempt.statusCode, 400);
    assert.equal(oldLinkAttempt.body.error, "Reset link is invalid or expired.");

    const currentLinkAttempt = await invokeRouter(router, "/password/reset", {
      token: secondToken,
      password: "New-password-1!",
    });
    assert.equal(currentLinkAttempt.statusCode, 200);
    assert.equal(customer.passwordResetTokenHash, null);
    assert.equal(customer.passwordResetExpiresAt, null);
    assert.equal(customer.passwordResetRequestedAt, null);
  } finally {
    crypto.randomBytes = originalRandomBytes;
  }
});

test("customer password reset rejects expired tokens", async () => {
  process.env.APP_AUTH_SECRET = "test-only-customer-reset-secret";
  const customer = createCustomer();
  const token = toResetToken(3);
  customer.passwordResetTokenHash = hashToken(token);
  customer.passwordResetExpiresAt = new Date(Date.now() - 60_000);
  customer.passwordResetRequestedAt = new Date(Date.now() - 2 * 60_000);
  const router = createCustomerAccountRouter(createMockPrisma(customer));

  const expiredAttempt = await invokeRouter(router, "/password/reset", {
    token,
    password: "New-password-1!",
  });

  assert.equal(expiredAttempt.statusCode, 400);
  assert.equal(expiredAttempt.body.error, "Reset link is invalid or expired.");
  assert.equal(customer.passwordResetTokenHash, hashToken(token));
});
