import { verifiedState } from "./rules.js";

// Inject a pg Pool configured for the dedicated TTNGH database, never another app's pool.
export function createDonationStore(pool) {
  async function transaction(work) {
    const client = await pool.connect();
    try { await client.query("BEGIN"); const result = await work(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  async function audit(client, ref, previous, next, source, requestId) {
    await client.query("INSERT INTO ttngh_payments.transitions (reference,previous_state,next_state,source,request_id) VALUES ($1,$2,$3,$4,$5)", [ref, previous, next, source, requestId]);
  }
  return {
    async create(intent, requestId) {
      return transaction(async client => {
        const inserted = await client.query("INSERT INTO ttngh_payments.intents (reference,mode,submission_id,fingerprint,access_hash,amount_pesewas,email) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (mode,submission_id) DO NOTHING RETURNING *", [intent.reference,intent.mode,intent.submissionId,intent.fingerprint,intent.accessHash,intent.amountPesewas,intent.email]);
        if (inserted.rowCount) { await audit(client,intent.reference,null,"created","initialize",requestId); return { intent: inserted.rows[0], created: true }; }
        const existing = (await client.query("SELECT * FROM ttngh_payments.intents WHERE mode=$1 AND submission_id=$2 FOR UPDATE", [intent.mode,intent.submissionId])).rows[0];
        if (!existing || existing.fingerprint !== intent.fingerprint || existing.access_hash !== intent.accessHash) throw new Error("Idempotency conflict.");
        return { intent: existing, created: false };
      });
    },
    async find(reference) { return (await pool.query("SELECT * FROM ttngh_payments.intents WHERE reference=$1", [reference])).rows[0]; },
    async initialized(reference, checkoutUrl, requestId) {
      return transaction(async client => {
        const result = await client.query("UPDATE ttngh_payments.intents SET state='initialized',checkout_url=$2,updated_at=now() WHERE reference=$1 AND state='created' RETURNING *", [reference,checkoutUrl]);
        if (result.rowCount) await audit(client,reference,"created","initialized","initialize",requestId);
        return result.rows[0];
      });
    },
    async reconcile(reference, provider, source, requestId) {
      if (!["verify","webhook","reconcile"].includes(source)) throw new Error("Invalid reconciliation source.");
      return transaction(async client => {
        const intent = (await client.query("SELECT * FROM ttngh_payments.intents WHERE reference=$1 FOR UPDATE", [reference])).rows[0];
        if (!intent) throw new Error("Unknown donation.");
        const next = verifiedState(intent, provider);
        // Paid is terminal here. Refunds/disputes require a separate reconciliation workflow.
        if (intent.state === "paid") {
          if (next === "paid" && String(intent.provider_id) !== String(provider.id)) throw new Error("Conflicting provider identity.");
          return intent;
        }
        if (intent.state === next) return intent;
        const result = await client.query("UPDATE ttngh_payments.intents SET state=$2,provider_id=$3,paid_at=$4,updated_at=now() WHERE reference=$1 RETURNING *", [reference,next,next === "paid" ? provider.id : null,next === "paid" ? provider.paid_at : null]);
        await audit(client,reference,intent.state,next,source,requestId);
        if (next === "paid") await client.query("INSERT INTO ttngh_payments.receipts (reference) VALUES ($1) ON CONFLICT DO NOTHING", [reference]);
        return result.rows[0];
      });
    },
  };
}
