import assert from "node:assert/strict";
import test from "node:test";
import { sensitivePathReason } from "./security-sensitive-paths.mjs";

test("secret and credential exports are rejected by filename without opening them", () => {
  for (const file of ["app/.env", "app/.env.staging", "app/staging.env", "data/users.secrets.csv",
    "data/passwords.tsv", "credentials.json", "token.txt", "private.key", "private.p12",
    "server.crt", "secrets/anything", ".ssh/id_ed25519", ".aws/config", ".netrc", ".npmrc"]) {
    assert.ok(sensitivePathReason(file), file);
  }
});

test("documented templates and ordinary source paths are not credential exports", () => {
  for (const file of ["app/.env.example", "app/.env.template", "auth/token.js",
    "styles/tokens.css", "src/security.js", "data/catalogue.csv", "docs/security.md"]) {
    assert.equal(sensitivePathReason(file), null, file);
  }
});
