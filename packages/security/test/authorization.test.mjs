import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORIZATION_APPLICATION_IDS,
  buildPermissionIdentifier,
  definePermission,
  hasApplicationAccess,
  hasModuleAccess,
  hasPermissionDefinition,
  hasPermissionIdentifier,
  isOrganisationAssignmentAllowed,
} from "../src/index.js";

test("permission identifiers preserve existing module-action database values", () => {
  assert.equal(buildPermissionIdentifier("Users", "Write"), "users:write");
  const permission = definePermission({
    applicationId: AUTHORIZATION_APPLICATION_IDS.REEBS_PORTAL,
    moduleId: "users",
    action: "write",
    legacyIds: ["USERS:WRITE"],
  });
  assert.equal(permission.id, "users:write");
  assert.deepEqual(permission.legacyIds, ["users:write"]);
});

test("permission checks support exact, global, and module wildcards without action aliases", () => {
  assert.equal(hasPermissionIdentifier(["users:read"], "users:read"), true);
  assert.equal(hasPermissionIdentifier(["users:*"], "users:write"), true);
  assert.equal(hasPermissionIdentifier(["*"], "users:write"), true);
  assert.equal(hasPermissionIdentifier(["users:read"], "users:write"), false);
  assert.equal(hasPermissionIdentifier(["users:view"], "users:read"), false);
});

test("permission definitions accept compatible legacy identifiers", () => {
  const permission = definePermission({
    id: "orders:view",
    applicationId: AUTHORIZATION_APPLICATION_IDS.STROANE_ADMIN,
    moduleId: "orders",
    action: "view",
    legacyIds: ["orders:read"],
  });
  assert.equal(hasPermissionDefinition(["orders:read"], permission), true);
});

test("application and module assignments are explicit unless unrestricted", () => {
  assert.equal(
    hasApplicationAccess(["dev-erp"], AUTHORIZATION_APPLICATION_IDS.DEV_ERP),
    true,
  );
  assert.equal(hasApplicationAccess(["dev-erp"], "reebs-portal"), false);
  assert.equal(hasModuleAccess(["inventory"], "orders"), false);
  assert.equal(hasModuleAccess([], "orders", { unrestricted: true }), true);
});

test("organisation assignments never infer cross-tenant access from a role name", () => {
  assert.equal(
    isOrganisationAssignmentAllowed({
      authenticatedOrganisationId: 7,
      requestedOrganisationId: 7,
    }),
    true,
  );
  assert.equal(
    isOrganisationAssignmentAllowed({
      authenticatedOrganisationId: 7,
      requestedOrganisationId: 12,
      assignedOrganisationIds: [7],
    }),
    false,
  );
  assert.equal(
    isOrganisationAssignmentAllowed({
      authenticatedOrganisationId: 7,
      requestedOrganisationId: 12,
      assignedOrganisationIds: [7, 12],
    }),
    true,
  );
});
