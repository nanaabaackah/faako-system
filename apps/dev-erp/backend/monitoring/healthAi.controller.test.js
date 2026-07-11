import assert from "node:assert/strict";
import test from "node:test";
import {
  createSystemHealthAiHandler,
  sanitizeHealthIncidentContext,
} from "./healthAi.controller.js";

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

test("sanitizeHealthIncidentContext bounds monitoring evidence", () => {
  const context = sanitizeHealthIncidentContext({
    label: "Orders API",
    status: "offline",
    checks: Array.from({ length: 12 }, (_, index) => ({
      label: `Check ${index}`,
      httpStatus: 503,
      errorMessage: "x".repeat(400),
    })),
  });

  assert.equal(context.checks.length, 8);
  assert.equal(context.checks[0].errorMessage.length, 180);
});

test("createSystemHealthAiHandler requests and returns structured diagnostics", async () => {
  let requestBody;
  const handler = createSystemHealthAiHandler({
    openAiApiKey: "test-key",
    openAiResponsesUrl: "https://api.openai.test/v1/responses",
    openAiModel: "gpt-test",
    openAiTimeoutMs: 5000,
    async fetchImpl(_url, options) {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            model: "gpt-test",
            output_text: JSON.stringify({
              executiveSummary: "The API is returning 503 responses.",
              likelyCause: "The application or an upstream dependency is unavailable.",
              impact: "Order workflows may fail.",
              confidence: "medium",
              actions: [
                { title: "Inspect logs", instruction: "Open Railway logs.", urgency: "now" },
                { title: "Retry", instruction: "Check the health URL.", urgency: "verify" },
              ],
              verificationSteps: ["Confirm HTTP 200."],
              escalation: "Escalate if 503 responses continue after rollback.",
            }),
          };
        },
      };
    },
  });
  const res = createResponse();

  await handler({ body: { incident: { label: "Orders API", status: "offline" } } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.diagnosis.confidence, "medium");
  assert.equal(requestBody.text.format.type, "json_schema");
  assert.equal(requestBody.text.format.strict, true);
});
