import assert from "node:assert/strict";
import test from "node:test";
import {
  createIsGlobalAdmin,
  createResolveOrganizationReadScope,
  createResolveOrganizationWriteScope,
} from "./scope.js";

test("createIsGlobalAdmin requires admin role and configured email", () => {
  const isGlobalAdmin = createIsGlobalAdmin(["root@example.com"]);

  assert.equal(isGlobalAdmin({ roleName: "Admin", email: "ROOT@example.com" }), true);
  assert.equal(isGlobalAdmin({ roleName: "Admin", email: "other@example.com" }), false);
  assert.equal(isGlobalAdmin({ roleName: "Tenant", email: "root@example.com" }), false);
});

test("createResolveOrganizationReadScope defaults to the requester's organization", async () => {
  const resolveScope = createResolveOrganizationReadScope({
    prisma: {},
    isGlobalAdmin() {
      return false;
    },
  });

  const scope = await resolveScope({
    user: { organizationId: 7 },
    requestedByAdmin: false,
  });

  assert.deepEqual(scope, {
    organizationFilter: { organizationId: 7 },
    includeAllOrganizations: false,
    selectedOrganization: null,
  });
});

test("createResolveOrganizationReadScope rejects users without an organization scope", async () => {
  const resolveScope = createResolveOrganizationReadScope({
    prisma: {},
    isGlobalAdmin() {
      return false;
    },
  });

  const scope = await resolveScope({
    user: {},
    requestedByAdmin: false,
  });

  assert.deepEqual(scope, {
    status: 403,
    error: "Authenticated user is missing an organization scope.",
  });
});

test("createResolveOrganizationReadScope blocks organizationId=all for local admins", async () => {
  const resolveScope = createResolveOrganizationReadScope({
    prisma: {},
    isGlobalAdmin() {
      return false;
    },
  });

  const scope = await resolveScope({
    user: { organizationId: 7 },
    requestedByAdmin: true,
    organizationParam: "all",
  });

  assert.deepEqual(scope, {
    status: 403,
    error: "Global admin access is required for organizationId=all.",
  });
});

test("createResolveOrganizationReadScope blocks cross-organization reads for local admins", async () => {
  const resolveScope = createResolveOrganizationReadScope({
    prisma: {},
    isGlobalAdmin() {
      return false;
    },
  });

  const scope = await resolveScope({
    user: { organizationId: 7 },
    requestedByAdmin: true,
    organizationParam: "12",
    ownAccessError: "Custom cross-org denial.",
  });

  assert.deepEqual(scope, {
    status: 403,
    error: "Custom cross-org denial.",
  });
});

test("createResolveOrganizationReadScope resolves selected organizations for global admins", async () => {
  const resolveScope = createResolveOrganizationReadScope({
    prisma: {
      organization: {
        async findUnique(options) {
          assert.deepEqual(options, {
            where: { id: 12 },
            select: { id: true, name: true, slug: true },
          });
          return { id: 12, name: "Acme", slug: "acme" };
        },
      },
    },
    isGlobalAdmin() {
      return true;
    },
  });

  const scope = await resolveScope({
    user: { organizationId: 7 },
    requestedByAdmin: true,
    organizationParam: "12",
  });

  assert.deepEqual(scope, {
    organizationFilter: { organizationId: 12 },
    includeAllOrganizations: false,
    selectedOrganization: { id: 12, name: "Acme", slug: "acme" },
  });
});

test("createResolveOrganizationWriteScope defaults writes to the requester's organization", async () => {
  const resolveScope = createResolveOrganizationWriteScope({
    prisma: {},
    isGlobalAdmin() {
      return false;
    },
  });

  const scope = await resolveScope({
    user: { organizationId: 7 },
  });

  assert.deepEqual(scope, {
    organizationId: 7,
    organization: null,
  });
});

test("createResolveOrganizationWriteScope blocks cross-organization writes for local admins", async () => {
  const resolveScope = createResolveOrganizationWriteScope({
    prisma: {},
    isGlobalAdmin() {
      return false;
    },
  });

  const scope = await resolveScope({
    user: { organizationId: 7 },
    organizationId: 12,
    ownAccessError: "Custom cross-org write denial.",
  });

  assert.deepEqual(scope, {
    status: 403,
    error: "Custom cross-org write denial.",
  });
});

test("createResolveOrganizationWriteScope resolves selected organizations for global admins", async () => {
  const resolveScope = createResolveOrganizationWriteScope({
    prisma: {
      organization: {
        async findUnique(options) {
          assert.deepEqual(options, {
            where: { id: 12 },
            select: { id: true, name: true, slug: true },
          });
          return { id: 12, name: "Acme", slug: "acme" };
        },
      },
    },
    isGlobalAdmin() {
      return true;
    },
  });

  const scope = await resolveScope({
    user: { organizationId: 7 },
    organizationId: "12",
  });

  assert.deepEqual(scope, {
    organizationId: 12,
    organization: { id: 12, name: "Acme", slug: "acme" },
  });
});

test("createResolveOrganizationWriteScope rejects invalid organization ids", async () => {
  const resolveScope = createResolveOrganizationWriteScope({
    prisma: {},
    isGlobalAdmin() {
      return true;
    },
  });

  const scope = await resolveScope({
    user: { organizationId: 7 },
    organizationId: "all",
  });

  assert.deepEqual(scope, {
    status: 400,
    error: "organizationId must be a valid id",
  });
});
