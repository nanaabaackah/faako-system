import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { emailSchema } from "@faako/validation";

// A representation limit is not a fundraising cap. Never round donor input.
export function toPesewas(value) {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,13})(\.\d{1,2})?$/.test(value)) throw new Error("Enter a GHS amount with at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (amount < 100n) throw new Error("The minimum donation is GH₵1.");
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("This amount cannot be processed online. Please contact TTNGH.");
  return Number(amount);
}

export const donationInput = z.object({
  amount: z.string().refine(value => { try { toPesewas(value); return true; } catch { return false; } }),
  currency: z.literal("GHS"),
  email: z.string().trim().max(160).regex(/^[^\r\n\u0000-\u001f\u007f]+$/).pipe(emailSchema),
  consent: z.literal(true),
  submissionId: z.string().uuid(),
}).strict();

export function paymentConfig(env) {
  if (env.TTNGH_DONATIONS_ENABLED !== "true") return { enabled: false };
  const mode = env.PAYSTACK_MODE;
  const key = env.PAYSTACK_SECRET_KEY || "";
  if (!["test", "live"].includes(mode) || !key.startsWith(`sk_${mode}_`) || key.length < 16) throw new Error("Invalid payment mode or server key.");
  if (mode === "live" && (env.NODE_ENV !== "production" || env.TTNGH_LIVE_PAYMENTS_APPROVED !== "true")) throw new Error("Live payments require explicit production approval.");
  const callback = new URL(env.TTNGH_DONATION_RETURN_URL || "");
  if (callback.protocol !== "https:" || callback.username || callback.password || callback.search || callback.hash || callback.pathname !== "/donate/return") throw new Error("Configure an exact HTTPS donation return URL.");
  if (mode === "live" && callback.origin !== "https://thethrivingnetworkgh.org") throw new Error("Live callback must use the approved production domain.");
  if (!env.TTNGH_DATABASE_URL) throw new Error("A dedicated payment database is required.");
  const database = new URL(env.TTNGH_DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(database.protocol)) throw new Error("Payment storage must be PostgreSQL.");
  return { enabled: true, mode, key, callback: callback.href, databaseUrl: env.TTNGH_DATABASE_URL };
}

export const fingerprint = input => createHash("sha256").update(JSON.stringify([toPesewas(input.amount), "GHS", input.email.toLowerCase(), input.consent])).digest("hex");

export function validSignature(raw, signature, secret) {
  if (!Buffer.isBuffer(raw) || typeof signature !== "string" || !/^[a-f0-9]{128}$/i.test(signature) || !secret) return false;
  const expected = createHmac("sha512", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export function verifiedState(intent, transaction) {
  if (!transaction || transaction.reference !== intent.reference || transaction.amount !== Number(intent.amount_pesewas) || transaction.currency !== "GHS" || transaction.domain !== intent.mode) throw new Error("Provider transaction does not match the donation intent.");
  const states = { success: "paid", failed: "failed", abandoned: "abandoned", pending: "pending", processing: "pending", ongoing: "pending", queued: "pending" };
  const state = states[transaction.status];
  if (!state) throw new Error("Provider transaction requires manual reconciliation.");
  if (state === "paid" && (!Number.isSafeInteger(transaction.id) || transaction.id <= 0 || !Number.isFinite(Date.parse(transaction.paid_at)))) throw new Error("Verified success is incomplete.");
  return state;
}
