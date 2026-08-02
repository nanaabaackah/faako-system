import test from "node:test";
import assert from "node:assert/strict";
import { doesAlertRuleMatch } from "./alert.engine.js";
import { buildAlertDeduplicationKey, shouldCreateRepeatedEvent } from "./alert.deduplication.js";
import { parseAlertRulePayload, parseChannelPayload } from "./alert.validation.js";

const service = { id: 7, category: "API", environment: "production", checkType: "HTTP", critical: true };

test("alert rule validation rejects executable or invalid rule fields", () => {
  assert.throws(() => parseAlertRulePayload({ name: "Unsafe", triggerType: "eval(check)" }), /trigger type/i);
  assert.throws(() => parseAlertRulePayload({ name: "Wrong env", triggerType: "SERVICE_DOWN", environment: "staging" }), /development or production/i);
  assert.deepEqual(parseAlertRulePayload({ name: "API down", triggerType: "SERVICE_DOWN", category: "api", cooldownMinutes: 10 }).category, "API");
});

test("rule matcher supports failure, degradation, latency, uptime, worker, SSL, and dependency triggers", () => {
  assert.equal(doesAlertRuleMatch({ enabled: true, triggerType: "SERVICE_DOWN" }, { service, check: { status: "DOWN" } }), true);
  assert.equal(doesAlertRuleMatch({ enabled: true, triggerType: "SERVICE_DEGRADED" }, { service, check: { status: "DEGRADED" } }), true);
  assert.equal(doesAlertRuleMatch({ enabled: true, triggerType: "CONSECUTIVE_FAILURES", consecutiveFailures: 3 }, { service, check: { status: "DOWN" }, incident: { failureCount: 3 } }), true);
  assert.equal(doesAlertRuleMatch({ enabled: true, triggerType: "LATENCY_THRESHOLD", thresholdValue: 500 }, { service, check: { latencyMs: 501 } }), true);
  assert.equal(doesAlertRuleMatch({ enabled: true, triggerType: "UPTIME_BELOW", thresholdValue: 99 }, { service, check: {}, uptimePercentage: 98.9 }), true);
  assert.equal(doesAlertRuleMatch({ enabled: true, triggerType: "CRITICAL_DEPENDENCY_FAILURE" }, { service, check: {}, dependencyFailed: true }), true);
  assert.equal(doesAlertRuleMatch({ enabled: true, triggerType: "WORKER_STALE" }, { service: { ...service, checkType: "WORKER" }, check: { status: "DOWN" } }), true);
  assert.equal(doesAlertRuleMatch({ enabled: true, triggerType: "SSL_EXPIRY", thresholdValue: 7 }, { service: { ...service, checkType: "SSL" }, check: { details: { daysRemaining: 5 } } }), true);
});

test("persistent deduplication keys and cooldown prevent duplicate delivery", () => {
  const key = buildAlertDeduplicationKey({ ruleId: 1, serviceId: 2, incidentId: 3, eventType: "TRIGGERED", channelId: 4 });
  assert.equal(key, "1:2:3:TRIGGERED:4");
  assert.equal(shouldCreateRepeatedEvent({ latestEvent: { createdAt: "2026-07-31T10:00:00Z" }, now: new Date("2026-07-31T10:05:00Z"), cooldownMinutes: 15 }), false);
  assert.equal(shouldCreateRepeatedEvent({ latestEvent: { createdAt: "2026-07-31T10:00:00Z" }, now: new Date("2026-07-31T10:16:00Z"), cooldownMinutes: 15 }), true);
});

test("channel validation keeps unapproved providers disabled and secrets out of display fields", () => {
  assert.throws(() => parseChannelPayload({ name: "WA", type: "WHATSAPP", config: { accessToken: "secret" } }), /not enabled/i);
  const email = parseChannelPayload({ name: "Ops", type: "EMAIL", config: { recipients: ["ops@example.com"] } });
  assert.equal(email.safeDisplay, "1 email recipient");
  assert.equal(JSON.stringify(email).includes("accessToken"), false);
});
