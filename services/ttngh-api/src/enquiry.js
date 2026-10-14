import { z } from "zod";
import { emailSchema } from "@faako/validation";
export const topics = ["Programmes or support", "Events", "Volunteering", "Donations", "Partnerships", "Media collaboration", "Privacy question", "Other enquiry"];
const singleLine = z.string().trim().regex(/^[^\r\n\u0000-\u001f\u007f]+$/);
export const enquirySchema = z.object({
  name: singleLine.min(2).max(80), email: singleLine.max(160).pipe(emailSchema),
  topic: z.enum(topics), message: z.string().trim().min(20).max(2000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+$/),
  consent: z.literal(true), website: z.string().max(200).default(""),
  turnstileToken: z.string().min(1).max(2048), submissionId: z.string().uuid(),
}).strict();

export async function verifyTurnstile(token, config, request = fetch) {
  const response = await request("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: config.secret, response: token }), redirect: "error", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Verification unavailable");
  const result = await response.json();
  const age = Date.now() - Date.parse(result.challenge_ts);
  return result.success === true && config.hostnames.includes(result.hostname) && result.action === "ttngh_enquiry" && age >= -30000 && age <= 300000;
}

export async function sendEmail(message, key, config, request = fetch) {
  const response = await request("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${config.resendKey}`, "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({ from: config.from, ...message }), redirect: "error", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Email delivery unavailable");
  const result = await response.json();
  if (typeof result.id !== "string" || !result.id) throw new Error("Email delivery unconfirmed");
}

export function staffMessage(input, config) {
  return { to: [config.to], reply_to: input.email, subject: "New TTNGH website enquiry",
    text: [`Name: ${input.name}`, `Email: ${input.email}`, `Category: ${input.topic}`, "", input.message, "", "Submitted with privacy consent. Handle under TTNGH's mailbox retention and safeguarding procedure."].join("\n") };
}
export function acknowledgementMessage(input) {
  return { to: [input.email], subject: "Your TTNGH enquiry has been received", text: "Thank you for contacting The Thriving Network GH. Your enquiry has been sent to the team. Please do not reply with medical records or highly sensitive information. Contact details: https://thethrivingnetworkgh.org/contact" };
}
