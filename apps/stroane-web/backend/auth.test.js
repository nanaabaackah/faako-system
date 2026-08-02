import assert from "node:assert/strict";
import test from "node:test";
import { requireAdminRole, resolveUserAccess, userHasPermission } from "./src/adminAuth.js";
import { safeVerifyPassword, signToken } from "./src/auth.js";
import { createAuthRouter } from "./src/routes/auth.js";
import { createAdminOrderRouter } from "./src/ordersAdmin/routes.js";

const createResponse = (resolve) => ({
  statusCode: 200,
  body: null,
  cookies: [],
  clearedCookies: [],
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    resolve();
    return this;
  },
  setHeader() {
    return this;
  },
  getHeader() {
    return undefined;
  },
  cookie(name, value, options) {
    this.cookies.push({ name, value, options });
    return this;
  },
  clearCookie(name, options) {
    this.clearedCookies.push({ name, options });
    return this;
  },
  end() {
    return this;
  },
});

test("viewer role can view operational modules without edit or team access", () => {
  const viewer = { role: "VIEWER" };
  const access = resolveUserAccess(viewer);

  assert.equal(access.role, "VIEWER");
  assert.equal(userHasPermission(viewer, "dashboard", "view"), true);
  assert.equal(userHasPermission(viewer, "orders", "view"), true);
  assert.equal(userHasPermission(viewer, "orders", "edit"), false);
  assert.equal(userHasPermission(viewer, "team", "view"), false);
  assert.equal(userHasPermission(viewer, "team", "manage"), false);
});

test("admin and owner roles are elevated across modules", () => {
  assert.equal(resolveUserAccess({ role: "ADMIN" }).isElevated, true);
  assert.equal(resolveUserAccess({ role: "OWNER" }).isElevated, true);
  assert.equal(userHasPermission({ role: "OWNER" }, "team", "manage"), true);
  assert.equal(userHasPermission({ role: "ADMIN" }, "inventory", "archive"), true);
});

test("owner role can use order action permission middleware", async () => {
  process.env.APP_AUTH_SECRET = "owner-order-action-test-secret";
  const token = signToken({ id: "owner-order-1", username: "owner", role: "OWNER" });
  const middleware = requireAdminRole(
    {
      siteUser: {
        findUnique: async (query) => {
          assert.deepEqual(query.where, { id: "owner-order-1" });
          return {
            id: "owner-order-1",
            username: "owner",
            role: "OWNER",
            isActive: true,
            customRole: null,
          };
        },
      },
    },
    "orders",
    "edit"
  );
  let response;
  let nextCalled = false;

  await new Promise((resolve, reject) => {
    response = createResponse(resolve);
    middleware(
      { headers: { authorization: `Bearer ${token}` } },
      response,
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        nextCalled = true;
        resolve();
      }
    );
  });

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, null);
});

test("custom roles use configured permissions but never team permissions", () => {
  const customUser = {
    role: "CUSTOM",
    customRole: {
      key: "crm-helper",
      name: "CRM helper",
      isActive: true,
      permissions: {
        crm: { view: true, edit: true },
        team: { view: true, manage: true },
      },
    },
  };

  assert.equal(userHasPermission(customUser, "crm", "view"), true);
  assert.equal(userHasPermission(customUser, "crm", "edit"), true);
  assert.equal(userHasPermission(customUser, "crm", "delete"), false);
  assert.equal(userHasPermission(customUser, "team", "view"), false);
  assert.equal(userHasPermission(customUser, "team", "manage"), false);
});

test("custom roles need inventory view permission for protected inventory reads", async () => {
  process.env.APP_AUTH_SECRET = "inventory-view-test-secret";
  const token = signToken({ id: "custom-user-1", username: "custom.user", role: "CUSTOM" });
  const runMiddleware = async (permissions) => {
    const middleware = requireAdminRole(
      {
        siteUser: {
          findUnique: async (query) => {
            assert.deepEqual(query.where, { id: "custom-user-1" });
            return {
              id: "custom-user-1",
              username: "custom.user",
              role: "CUSTOM",
              isActive: true,
              customRole: {
                id: "role-1",
                key: "ops-helper",
                name: "Operations helper",
                permissions,
                isActive: true,
              },
            };
          },
        },
      },
      "inventory",
      "view"
    );
    let response;
    let nextCalled = false;

    await new Promise((resolve, reject) => {
      response = createResponse(resolve);
      middleware(
        { headers: { authorization: `Bearer ${token}` } },
        response,
        (error) => {
          if (error) {
            reject(error);
            return;
          }
          nextCalled = true;
          resolve();
        }
      );
    });

    return { nextCalled, response };
  };

  const allowed = await runMiddleware({ inventory: { view: true } });
  assert.equal(allowed.nextCalled, true);
  assert.equal(allowed.response.statusCode, 200);
  assert.equal(allowed.response.body, null);

  const denied = await runMiddleware({ orders: { view: true } });
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.response.statusCode, 403);
  assert.equal(denied.response.body.error, "Access denied");
  assert.equal(denied.response.body.apiError.code, "permission_error");
});

test("admin order API enforces the same custom-role view permission as the frontend", async () => {
  process.env.APP_AUTH_SECRET = "orders-view-route-test-secret";
  const token = signToken({
    id: "custom-orders-1",
    username: "custom.orders",
    role: "CUSTOM",
  });
  let orderQueryCount = 0;
  const prisma = {
    siteUser: {
      findUnique: async () => ({
        id: "custom-orders-1",
        username: "custom.orders",
        role: "CUSTOM",
        isActive: true,
        customRole: {
          id: "role-orders",
          key: "orders-helper",
          name: "Orders helper",
          permissions: { orders: { view: false } },
          isActive: true,
        },
      }),
    },
    commerceOrder: {
      findMany: async () => {
        orderQueryCount += 1;
        return [];
      },
    },
  };
  const router = createAdminOrderRouter(prisma);
  let response;

  await new Promise((resolve, reject) => {
    response = createResponse(resolve);
    router.handle(
      {
        method: "GET",
        url: "/orders",
        originalUrl: "/orders",
        headers: { authorization: `Bearer ${token}` },
        query: {},
      },
      response,
      (error) => (error ? reject(error) : resolve()),
    );
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, "Access denied");
  assert.equal(response.body.apiError.code, "permission_error");
  assert.equal(orderQueryCount, 0);
});

test("team management APIs allow owners", async () => {
  process.env.APP_AUTH_SECRET = "team-owner-test-secret";
  const prisma = {
    siteUser: {
      findUnique: async (query) => {
        assert.deepEqual(query.where, { id: "owner-1" });
        return {
          id: "owner-1",
          username: "owner",
          role: "OWNER",
          isActive: true,
          customRole: null,
        };
      },
    },
    portalRole: {
      findMany: async () => [],
    },
  };
  const router = createAuthRouter(prisma);
  let response;
  const token = signToken({ id: "owner-1", username: "owner", role: "OWNER" });

  await new Promise((resolve, reject) => {
    response = createResponse(resolve);
    router.handle(
      {
        method: "GET",
        url: "/roles",
        headers: { authorization: `Bearer ${token}` },
      },
      response,
      (error) => (error ? reject(error) : resolve())
    );
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.roles.some((role) => role.key === "OWNER"), true);
});

test("custom roles cannot use team management APIs", async () => {
  process.env.APP_AUTH_SECRET = "team-custom-denied-test-secret";
  const prisma = {
    siteUser: {
      findUnique: async (query) => {
        assert.deepEqual(query.where, { id: "custom-team-1" });
        return {
          id: "custom-team-1",
          username: "custom.team",
          role: "CUSTOM",
          isActive: true,
          customRole: {
            key: "team-helper",
            name: "Team helper",
            isActive: true,
            permissions: {
              team: { view: true, manage: true },
            },
          },
        };
      },
    },
  };
  const router = createAuthRouter(prisma);
  let response;
  const token = signToken({ id: "custom-team-1", username: "custom.team", role: "CUSTOM" });

  await new Promise((resolve, reject) => {
    response = createResponse(resolve);
    router.handle(
      {
        method: "GET",
        url: "/roles",
        headers: { authorization: `Bearer ${token}` },
      },
      response,
      (error) => (error ? reject(error) : resolve())
    );
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, { error: "Owner or admin access required" });
});

test("admin can update custom role details and permissions", async () => {
  process.env.APP_AUTH_SECRET = "team-role-edit-test-secret";
  let roleUpdateData = null;
  const prisma = {
    siteUser: {
      findUnique: async (query) => {
        assert.deepEqual(query.where, { id: "admin-1" });
        return {
          id: "admin-1",
          username: "admin",
          role: "ADMIN",
          isActive: true,
          customRole: null,
        };
      },
    },
    portalRole: {
      findUnique: async (query) => {
        assert.deepEqual(query.where, { id: "role-1" });
        return { id: "role-1", isSystem: false };
      },
      update: async (query) => {
        assert.deepEqual(query.where, { id: "role-1" });
        roleUpdateData = query.data;
        return {
          id: "role-1",
          key: "inventory-helper",
          name: query.data.name,
          description: query.data.description,
          permissions: query.data.permissions,
          isSystem: false,
          isActive: true,
          updatedAt: new Date("2026-07-04T00:00:00Z"),
        };
      },
    },
  };
  const router = createAuthRouter(prisma);
  let response;
  const token = signToken({ id: "admin-1", username: "admin", role: "ADMIN" });

  await new Promise((resolve, reject) => {
    response = createResponse(resolve);
    router.handle(
      {
        method: "PATCH",
        url: "/roles/role-1",
        headers: { authorization: `Bearer ${token}` },
        body: {
          name: "Inventory helper",
          description: "Helps with stock review.",
          permissions: {
            inventory: { view: true, edit: true },
            team: { view: true, manage: true },
          },
        },
      },
      response,
      (error) => (error ? reject(error) : resolve())
    );
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.role.name, "Inventory helper");
  assert.equal(roleUpdateData.permissions.inventory.view, true);
  assert.equal(roleUpdateData.permissions.inventory.edit, true);
  assert.equal(roleUpdateData.permissions.team.view, false);
  assert.equal(roleUpdateData.permissions.team.manage, false);
  assert.equal(response.body.role.permissions.profile.view, true);
});

test("current user can update profile details and appearance preference", async () => {
  process.env.APP_AUTH_SECRET = "profile-test-secret";
  const baseUser = {
    id: "user-1",
    username: "old.name",
    role: "ADMIN",
    isActive: true,
    firstName: "",
    lastName: "",
    personalEmail: "",
    phone: "",
    jobTitle: "",
    department: "",
    bio: "",
    avatarUrl: "",
    appearancePreference: "system",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
  const prisma = {
    siteUser: {
      findUnique: async (query) => {
        assert.deepEqual(query.where, { id: "user-1" });
        return baseUser;
      },
      update: async (query) => {
        assert.deepEqual(query.where, { id: "user-1" });
        assert.deepEqual(query.data, {
          username: "new.name",
          firstName: "Nana",
          lastName: "Aba",
          personalEmail: "nana@example.com",
          avatarUrl: null,
          appearancePreference: "dark",
        });
        return {
          ...baseUser,
          ...query.data,
          updatedAt: new Date("2026-01-02T00:00:00Z"),
        };
      },
    },
  };
  const router = createAuthRouter(prisma);
  let response;
  const token = signToken({ id: "user-1", username: "old.name", role: "ADMIN" });

  await new Promise((resolve, reject) => {
    response = createResponse(resolve);
    router.handle(
      {
        method: "PATCH",
        url: "/me",
        headers: { authorization: `Bearer ${token}` },
        body: {
          username: " New.Name ",
          firstName: " Nana ",
          lastName: " Aba ",
          personalEmail: " NANA@EXAMPLE.COM ",
          avatarUrl: "",
          appearancePreference: "dark",
        },
      },
      response,
      (error) => (error ? reject(error) : resolve())
    );
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.username, "new.name");
  assert.equal(response.body.firstName, "Nana");
  assert.equal(response.body.lastName, "Aba");
  assert.equal(response.body.displayName, "Nana Aba");
  assert.equal(response.body.personalEmail, "nana@example.com");
  assert.equal(response.body.avatarUrl, "");
  assert.equal(response.body.appearancePreference, "dark");
  assert.equal(response.body.token, undefined);
  assert.equal(response.cookies.length, 1);
  assert.equal(response.cookies[0].name, "stroane_admin_session");
  assert.equal(response.cookies[0].options.httpOnly, true);
});

test("current user can change their portal password from profile", async () => {
  process.env.APP_AUTH_SECRET = "profile-password-test-secret";
  const baseUser = {
    id: "user-2",
    username: "invited.user",
    role: "VIEWER",
    isActive: true,
    firstName: "Invited",
    lastName: "User",
    personalEmail: "",
    phone: "",
    jobTitle: "",
    department: "",
    bio: "",
    avatarUrl: "",
    appearancePreference: "system",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
  let storedPasswordHash = "";
  const prisma = {
    siteUser: {
      findUnique: async (query) => {
        assert.deepEqual(query.where, { id: "user-2" });
        return baseUser;
      },
      update: async (query) => {
        assert.deepEqual(query.where, { id: "user-2" });
        assert.equal(Object.keys(query.data).length, 1);
        assert.equal(typeof query.data.passwordHash, "string");
        assert.equal(safeVerifyPassword("New-portal-password-1!", query.data.passwordHash), true);
        storedPasswordHash = query.data.passwordHash;
        return {
          ...baseUser,
          updatedAt: new Date("2026-01-02T00:00:00Z"),
        };
      },
    },
  };
  const router = createAuthRouter(prisma);
  let response;
  const token = signToken({ id: "user-2", username: "invited.user", role: "VIEWER" });

  await new Promise((resolve, reject) => {
    response = createResponse(resolve);
    router.handle(
      {
        method: "PATCH",
        url: "/me",
        headers: { authorization: `Bearer ${token}` },
        body: {
          newPassword: "New-portal-password-1!",
        },
      },
      response,
      (error) => (error ? reject(error) : resolve())
    );
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.username, "invited.user");
  assert.equal(response.body.passwordHash, undefined);
  assert.equal(response.body.newPassword, undefined);
  assert.equal(safeVerifyPassword("Temporary-password-1!", storedPasswordHash), false);
  assert.equal(response.cookies.length, 1);
  assert.equal(response.cookies[0].name, "stroane_admin_session");
});
