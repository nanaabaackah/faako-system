import { acknowledgementMessage, sendEmail, staffMessage } from "../enquiry.js";

// Safe to invoke on request and on a timer. PostgreSQL leases prevent two
// replicas from dispatching the same job simultaneously. Resend receives a
// stable idempotency key for each message even after a process restart.
export async function processPendingEnquiries(store, config, { request = fetch, submissionId = null, limit = 10 } = {}) {
  let processed = 0;
  let failed = 0;
  for (let index = 0; index < limit; index += 1) {
    const job = await store.claim(submissionId);
    if (!job) break;
    const input = {
      submissionId: job.submission_id,
      name: job.name, email: job.email, topic: job.topic, message: job.message,
    };
    const recipient = job.recipient_kind;
    const key = recipient === "staff" ? `ttngh-enquiry/${input.submissionId}` : `ttngh-ack/${input.submissionId}`;
    try {
      const message = recipient === "staff" ? staffMessage(input, config) : acknowledgementMessage(input);
      const providerId = await sendEmail(message, key, config, request);
      await store.sent(job, providerId);
      processed += 1;
    } catch {
      // Never log enquiry content, recipient email, provider bodies, or tokens.
      await store.failed(job);
      failed += 1;
    }
  }
  return { processed, failed };
}
