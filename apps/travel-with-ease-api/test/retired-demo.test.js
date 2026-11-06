import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { PostgresLeadRepository } from "../src/db/repository.js";

test("retired demo submission endpoint cannot persist data, even with obsolete configuration", async () => {
  let writes = 0;
  const app = createApp({ environment: "test", repository: {
    async createDemoEnquiry() { writes++; },
  }, demoOrigin: "https://staging.example.test", allowedOrigins: ["https://staging.example.test"] });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/public/demo-inquiries`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "https://staging.example.test" }, body: "{}",
    });
    assert.equal(response.status, 404);
    assert.equal(writes, 0);
    assert.equal(typeof PostgresLeadRepository.prototype.createDemoEnquiry, "undefined");
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
