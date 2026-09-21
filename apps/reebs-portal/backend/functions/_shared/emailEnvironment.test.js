import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

const emailModuleUrl = new URL("./email.js", import.meta.url).href;

const runEmailPolicy = (environment) => JSON.parse(execFileSync(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    `const { sendNotificationEmail } = await import(${JSON.stringify(emailModuleUrl)}); const result = await sendNotificationEmail({ to: "customer@example.test", subject: "Test", text: "Test" }); console.log(JSON.stringify(result));`,
  ],
  {
    encoding: "utf8",
    env: {
      APP_ENV: environment,
      NODE_ENV: environment === "development" ? "development" : "production",
      REEBS_SKIP_ENV_FILES: "true",
      EMAIL_NOTIFICATIONS_ENABLED: "true",
    },
  }
));

const runEmailAvailability = (environment, extraEnvironment = {}) => JSON.parse(execFileSync(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    `const { getEmailDeliveryStatus } = await import(${JSON.stringify(emailModuleUrl)}); console.log(JSON.stringify(getEmailDeliveryStatus()));`,
  ],
  {
    encoding: "utf8",
    env: {
      APP_ENV: environment,
      NODE_ENV: environment === "development" ? "development" : "production",
      REEBS_SKIP_ENV_FILES: "true",
      ...extraEnvironment,
    },
  }
));

test("staging does not send customer email without an explicit sink policy", () => {
  assert.deepEqual(runEmailPolicy("staging"), {
    skipped: true,
    reason: "staging_recipient_policy_not_configured",
  });
});

test("production provider configuration remains environment supplied", () => {
  assert.deepEqual(runEmailPolicy("production"), {
    skipped: true,
    reason: "missing_api_key",
  });
});

test("staging email is available only with notifications, provider key, and controlled sink", () => {
  assert.deepEqual(runEmailAvailability("staging", {
    EMAIL_NOTIFICATIONS_ENABLED: "true",
    BREVO_API_KEY: "placeholder-provider-key",
    EMAIL_FORCE_TO: "staging-sink@example.test",
  }), {
    available: true,
    reason: "configured",
  });

  assert.deepEqual(runEmailAvailability("staging", {
    EMAIL_NOTIFICATIONS_ENABLED: "false",
    BREVO_API_KEY: "placeholder-provider-key",
    EMAIL_FORCE_TO: "staging-sink@example.test",
  }), {
    available: false,
    reason: "disabled",
  });
});
