import test from "node:test";
import assert from "node:assert/strict";
import { serializePgClientQueries } from "./serializedPgClient.js";

test("serialized PostgreSQL client runs concurrent callers one at a time", async () => {
  let active = 0;
  let maximumActive = 0;
  const client = serializePgClientQueries({
    async query(value) {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return value;
    },
  });

  const results = await Promise.all([
    client.query("first"),
    client.query("second"),
    client.query("third"),
  ]);

  assert.deepEqual(results, ["first", "second", "third"]);
  assert.equal(maximumActive, 1);
});

test("serialized PostgreSQL client continues after a failed query", async () => {
  let callCount = 0;
  const client = serializePgClientQueries({
    async query() {
      callCount += 1;
      if (callCount === 1) throw new Error("temporary failure");
      return "recovered";
    },
  });

  const first = client.query().catch((error) => error.message);
  const second = client.query();

  assert.equal(await first, "temporary failure");
  assert.equal(await second, "recovered");
});
