import assert from "node:assert/strict";
import test from "node:test";

import { assertPrismaCommandAllowed } from "./prismaEnvironmentPolicy.mjs";

test("development permits migrate dev and guards reset", () => {
  assert.equal(assertPrismaCommandAllowed({
    environment: "development",
    command: "migrate",
    commandArgs: ["dev"],
  }), "development");
  assert.throws(() => assertPrismaCommandAllowed({
    environment: "development",
    command: "migrate",
    commandArgs: ["reset"],
  }), /Development reset blocked/);
});

test("staging permits deploy but rejects development migration commands", () => {
  assert.equal(assertPrismaCommandAllowed({
    environment: "staging",
    command: "migrate",
    commandArgs: ["deploy"],
  }), "staging");
  assert.throws(() => assertPrismaCommandAllowed({
    environment: "staging",
    command: "migrate",
    commandArgs: ["dev"],
  }), /deployed environments must use migrate deploy/);
  assert.throws(() => assertPrismaCommandAllowed({
    environment: "staging",
    command: "migrate",
    commandArgs: ["reset"],
  }), /deployed environments must use migrate deploy/);
});

test("production deploy retains explicit Railway or one-off approval", () => {
  assert.throws(() => assertPrismaCommandAllowed({
    environment: "production",
    command: "migrate",
    commandArgs: ["deploy"],
  }), /Production migration blocked/);
  assert.equal(assertPrismaCommandAllowed({
    environment: "production",
    command: "migrate",
    commandArgs: ["deploy"],
    env: { RAILWAY_ENVIRONMENT_NAME: "production" },
  }), "production");
});
