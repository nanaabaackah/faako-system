import test from "node:test";
import assert from "node:assert/strict";
import { buildMonitoringAlertEmailContent } from "./alertEmailTemplate.js";

const incident = {
  id: 42,
  severity: "CRITICAL",
  status: "OPEN",
  title: "Dev ERP API unavailable",
  summary: "The health endpoint stopped responding.",
  service: { name: "Dev ERP API", environment: "production" },
};

test("monitoring alert email uses the shared branded layout and incident deep link", () => {
  const content = buildMonitoringAlertEmailContent({
    event: { eventType: "TRIGGERED", safeSummary: "Three consecutive checks failed." },
    incident,
    appBaseUrl: "https://dev.example.com/",
  });

  assert.equal(content.subject, "[CRITICAL] Dev ERP API unavailable");
  assert.match(content.text, /Open incident: https:\/\/dev\.example\.com\/system-health\?incident=42/);
  assert.match(content.html, /Dev ERP Monitoring/);
  assert.match(content.html, /Open incident in Dev ERP/);
  assert.match(content.html, /Faako platform operations/);
});

test("monitoring recovery email clearly changes tone and remains safe", () => {
  const content = buildMonitoringAlertEmailContent({
    event: { eventType: "RECOVERED", safeSummary: "Service checks are healthy again." },
    incident: { ...incident, status: "RESOLVED", title: "API <recovered>" },
  });

  assert.equal(content.subject, "[RECOVERED] API <recovered>");
  assert.match(content.html, /Service recovered/);
  assert.doesNotMatch(content.html, /API <recovered>/);
  assert.match(content.html, /API &lt;recovered&gt;/);
});
