import { randomUUID } from "node:crypto";
import { readNotificationConfig, ResendSender } from "../src/notifications/resend.js";

// Explicit opt-in only: unit/CI tests never invoke a live email provider.
try {
  const config = readNotificationConfig();
  if (!config || config.environment === "production" || !process.argv.includes("--send")) {
    throw new Error("test_delivery_not_enabled");
  }
  const sender = new ResendSender(config);
  await sender.send({
    id: randomUUID(),
    delivery_payload: {
      ...sender.payload(),
      subject: "Travel With Ease — email delivery test",
      text: "This is an authorised test of Travel With Ease email delivery. No enquiry, invitation, booking or publication was created.",
    },
  });
  console.log("Test email accepted by the provider. Confirm receipt in the testing mailbox; acceptance is not proof of inbox delivery.");
} catch {
  console.error("Test email not confirmed. Check non-production notification configuration and provider status. No credentials or provider response have been logged.");
  process.exitCode = 1;
}
