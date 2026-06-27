import assert from "node:assert/strict";
import test from "node:test";
import { resolveUserAccess, userHasPermission } from "./src/adminAuth.js";
import { signToken } from "./src/auth.js";
import { createAuthRouter } from "./src/routes/auth.js";

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
