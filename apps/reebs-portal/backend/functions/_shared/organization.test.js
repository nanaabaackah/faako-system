/* eslint-disable no-undef */
import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAuthorizedOrganizationId,
  resolveCheckoutOrganizationId,
} from "./organization.js";

test("resolveAuthorizedOrganizationId blocks cross-organization access for non-admin roles", async () => {
  await assert.rejects(
    () =>
      resolveAuthorizedOrganizationId(
        {
          async query() {
            throw new Error("should not query organization table");
          },
        },
        {
          authUser: {
            organizationId: 7,
            role: "manager",
            email: "manager@example.com",
          },
          event: {
            queryStringParameters: {
              organizationId: "12",
            },
          },
          allowCrossOrgForRoles: ["owner", "admin"],
        }
      ),
    {
      message: "Cross-organization access is not allowed.",
    }
  );
});

test("resolveAuthorizedOrganizationId allows cross-organization access for admins when the organization exists", async () => {
  const organizationId = await resolveAuthorizedOrganizationId(
    {
      async query(queryText, params) {
        assert.match(queryText, /FROM "organization"/);
        assert.deepEqual(params, [12]);
        return { rowCount: 1, rows: [{ id: 12 }] };
      },
    },
    {
      authUser: {
        organizationId: 7,
        role: "admin",
        email: "admin@example.com",
      },
      event: {
        queryStringParameters: {
          organizationId: "12",
        },
      },
    }
  );

  assert.equal(organizationId, 12);
});

test("resolveCheckoutOrganizationId rejects organizations that are not explicitly allowlisted", async () => {
  const previousValue = process.env.ALLOWED_CHECKOUT_ORG_IDS;
  process.env.ALLOWED_CHECKOUT_ORG_IDS = "7,8";

  try {
    await assert.rejects(
      () =>
        resolveCheckoutOrganizationId(
          {},
          {
            queryStringParameters: {
              organizationId: "12",
            },
          },
          {}
        ),
      {
        message: "Checkout is not enabled for this organization.",
      }
    );
  } finally {
    if (previousValue === undefined) {
      delete process.env.ALLOWED_CHECKOUT_ORG_IDS;
    } else {
      process.env.ALLOWED_CHECKOUT_ORG_IDS = previousValue;
    }
  }
});
