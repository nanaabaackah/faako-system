/* eslint-disable no-undef */
import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MANAGER_SCOPES,
  getManagerFromEvent,
  signManagerToken,
} from "./managerAuth.js";

test("manager tokens default to the limited mobile scopes", () => {
  const previousSecret = process.env.MANAGER_APP_SECRET;
  process.env.MANAGER_APP_SECRET = "test-manager-secret";

  try {
    const token = signManagerToken({
      managerId: 5,
      organizationId: 7,
    });

    const manager = getManagerFromEvent(
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
      {
        requiredScopes: ["manager:orders:read"],
      }
    );

    assert.ok(manager);
    assert.deepEqual(manager.scopes, DEFAULT_MANAGER_SCOPES);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.MANAGER_APP_SECRET;
    } else {
      process.env.MANAGER_APP_SECRET = previousSecret;
    }
  }
});

test("manager tokens cannot be used outside their granted scopes", () => {
  const previousSecret = process.env.MANAGER_APP_SECRET;
  process.env.MANAGER_APP_SECRET = "test-manager-secret";

  try {
    const token = signManagerToken({
      managerId: 5,
      organizationId: 7,
      scopes: ["manager:orders:read"],
    });

    const manager = getManagerFromEvent(
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
      {
        requiredScopes: ["manager:device:write"],
      }
    );

    assert.equal(manager, null);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.MANAGER_APP_SECRET;
    } else {
      process.env.MANAGER_APP_SECRET = previousSecret;
    }
  }
});
