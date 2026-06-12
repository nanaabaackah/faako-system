import assert from "node:assert/strict";
import test from "node:test";
import { signToken } from "./src/auth.js";
import { createAuthRouter } from "./src/routes/auth.js";

const createResponse = (resolve) => ({
  statusCode: 200,
  body: null,
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
  end() {
    return this;
  },
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
  assert.equal(typeof response.body.token, "string");
});
