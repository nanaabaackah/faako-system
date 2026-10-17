import crypto from "node:crypto";

const METHODS = new Set(["MOBILE_MONEY", "BANK_TRANSFER", "CASH", "CARD_GATEWAY", "OTHER"]);
const ADJUSTMENT_TYPES = new Set(["CORRECTION", "RECONCILIATION_ADJUSTMENT"]);
const REFERENCE_REQUIRED = new Set(["MOBILE_MONEY", "BANK_TRANSFER", "CARD_GATEWAY"]);
const MAX_RETRIES = 3;

class PaymentError extends Error {
  constructor(status, message, code = "PAYMENT_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const bounded = (value, max) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, max) : null;
};

const centsFrom = (value, field = "amount") => {
  const text = String(value ?? "").trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) throw new PaymentError(400, `${field} must be a valid amount with no more than two decimal places.`);
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  const cents = (BigInt(whole) * 100n) + BigInt(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
};

const decimalFromCents = (cents) => {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  return `${negative ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
};

const numberFrom = (value) => Number(typeof value?.toString === "function" ? value.toString() : value || 0);
const dateOnly = (value, field = "paymentDate") => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new PaymentError(400, `${field} must be a valid date.`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
};

export const fingerprintPaymentRequest = (value) => crypto.createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");

export const buildExternalReferenceKey = ({ method, provider, externalReference }) => {
  const reference = bounded(externalReference, 180)?.toLowerCase().replace(/\s+/g, "");
  if (!reference) return null;
  const network = bounded(provider, 80)?.toLowerCase().replace(/\s+/g, "-") || "unspecified";
  return `${method}:${network}:${reference}`;
};

const serializeLedgerEntry = (entry) => ({
  id: entry.id,
  transactionId: entry.transactionId,
  entryType: entry.entryType,
  status: entry.status,
  amount: Math.abs(numberFrom(entry.signedAmount)),
  signedAmount: numberFrom(entry.signedAmount),
  currency: entry.currency,
  effectiveAt: entry.effectiveAt?.toISOString?.() || entry.effectiveAt,
  postedAt: entry.postedAt?.toISOString?.() || entry.postedAt,
  reason: entry.reason || null,
  reversesEntryId: entry.reversesEntryId || null,
  actor: entry.actorUser ? { id: entry.actorUser.id, name: entry.actorUser.fullName, email: entry.actorUser.email } : null,
});

export const serializeInvoicePayment = (payment) => ({
  id: payment.id,
  transactionId: payment.transactionId,
  invoiceId: payment.invoiceId,
  customerName: payment.customerName,
  amount: numberFrom(payment.amount),
  currency: payment.currency,
  method: payment.method,
  provider: payment.provider || null,
  externalReference: payment.externalReference || null,
  paymentDate: payment.paymentDate?.toISOString?.() || payment.paymentDate,
  verificationStatus: payment.verificationStatus,
  evidenceUrl: payment.evidenceUrl || null,
  note: payment.note || null,
  recordedBy: payment.recordedByUser ? { id: payment.recordedByUser.id, name: payment.recordedByUser.fullName, email: payment.recordedByUser.email } : null,
  verifiedBy: payment.verifiedByUser ? { id: payment.verifiedByUser.id, name: payment.verifiedByUser.fullName, email: payment.verifiedByUser.email } : null,
  verifiedAt: payment.verifiedAt?.toISOString?.() || payment.verifiedAt || null,
  rejectedBy: payment.rejectedByUser ? { id: payment.rejectedByUser.id, name: payment.rejectedByUser.fullName, email: payment.rejectedByUser.email } : null,
  rejectedAt: payment.rejectedAt?.toISOString?.() || payment.rejectedAt || null,
  rejectionReason: payment.rejectionReason || null,
  reversedAt: payment.reversedAt?.toISOString?.() || payment.reversedAt || null,
  correctsPaymentId: payment.correctsPaymentId || null,
  createdAt: payment.createdAt?.toISOString?.() || payment.createdAt,
  ledgerEntries: (payment.ledgerEntries || []).map(serializeLedgerEntry),
});

const paymentInclude = {
  recordedByUser: { select: { id: true, fullName: true, email: true } },
  verifiedByUser: { select: { id: true, fullName: true, email: true } },
  rejectedByUser: { select: { id: true, fullName: true, email: true } },
  ledgerEntries: { include: { actorUser: { select: { id: true, fullName: true, email: true } } }, orderBy: { postedAt: "asc" } },
};

const operationKey = (req) => bounded(req.headers?.["idempotency-key"] || req.body?.idempotencyKey, 160);
const organizationWhere = (req, invoiceId, isGlobalAdmin) => isGlobalAdmin(req.user)
  ? { id: invoiceId, archivedAt: null }
  : { id: invoiceId, organizationId: req.user.organizationId, archivedAt: null };

const lockInvoice = async (tx, invoiceId) => {
  if (typeof tx.$queryRawUnsafe === "function") await tx.$queryRawUnsafe('SELECT "id" FROM "Invoice" WHERE "id" = $1 FOR UPDATE', invoiceId);
  else if (typeof tx.$executeRawUnsafe === "function") await tx.$executeRawUnsafe('SELECT 1 FROM "Invoice" WHERE "id" = $1 FOR UPDATE', invoiceId);
};

const retryTransaction = async (prisma, work) => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable" });
    } catch (error) {
      if (attempt < MAX_RETRIES && (error?.code === "P2034" || error?.code === "40001")) continue;
      throw error;
    }
  }
  throw new PaymentError(503, "Payment transaction could not be completed safely.");
};

const createClaim = async (tx, { organizationId, invoiceId, operation, key, fingerprint }) => tx.paymentIdempotencyClaim.create({
  data: { organizationId, invoiceId, operation, idempotencyKey: key, requestFingerprint: fingerprint },
});

const completeClaim = async (tx, claimId, { paymentId = null, ledgerEntryId = null, response }) => tx.paymentIdempotencyClaim.update({
  where: { id: claimId },
  data: { paymentId, ledgerEntryId, responseSnapshot: response, completedAt: new Date() },
});

const resolveReplay = async (prisma, { organizationId, operation, key, fingerprint }) => {
  const claim = await prisma.paymentIdempotencyClaim.findUnique({
    where: { organizationId_operation_idempotencyKey: { organizationId, operation, idempotencyKey: key } },
  });
  if (!claim) return null;
  if (claim.requestFingerprint !== fingerprint) throw new PaymentError(409, "This idempotency key was already used with a different payment request.", "IDEMPOTENCY_CONFLICT");
  if (!claim.completedAt || !claim.responseSnapshot) throw new PaymentError(409, "An identical payment operation is already in progress.", "OPERATION_IN_PROGRESS");
  return { ...claim.responseSnapshot, idempotentReplay: true };
};

const sumLedgerCents = async (tx, invoiceId) => {
  const result = await tx.invoicePaymentLedgerEntry.aggregate({
    where: { invoiceId, status: "POSTED" },
    _sum: { signedAmount: true },
  });
  return centsFrom(result._sum.signedAmount?.toString?.() || "0.00", "ledger amount");
};

const syncAccountingProjection = async (tx, invoice, paidCents, effectiveAt) => {
  const paidAmount = decimalFromCents(paidCents);
  const existing = await tx.accountingEntry.findFirst({
    where: { organizationId: invoice.organizationId, invoiceNumber: invoice.invoiceNumber, type: "REVENUE", source: "MANUAL", archivedAt: null },
    orderBy: { id: "asc" },
  });
  if (!existing && paidCents === 0n) return null;
  const data = {
    organizationId: invoice.organizationId,
    type: "REVENUE",
    status: paidCents > 0n ? "PAID" : "PENDING",
    source: "MANUAL",
    sourceRef: `invoice:${invoice.id}:payment-ledger`,
    recurringInterval: null,
    invoiceNumber: invoice.invoiceNumber,
    archivedAt: null,
    currency: invoice.currency,
    amount: paidAmount,
    serviceName: `Invoice payment - ${invoice.invoiceNumber}`,
    detail: "Derived projection of verified immutable invoice payment ledger entries.",
    paidAt: paidCents > 0n ? effectiveAt : null,
    dueAt: null,
  };
  return existing ? tx.accountingEntry.update({ where: { id: existing.id }, data }) : tx.accountingEntry.create({ data });
};

const updateInvoiceProjection = async (tx, invoice, effectiveAt) => {
  const openingCents = centsFrom((invoice.legacyPaidAmount ?? invoice.paidAmount ?? 0).toString(), "legacy paid amount");
  const ledgerCents = await sumLedgerCents(tx, invoice.id);
  const paidCents = openingCents + ledgerCents;
  const totalCents = centsFrom(invoice.total.toString(), "invoice total");
  if (paidCents < 0n) throw new PaymentError(409, "This transaction would make the settled amount negative.", "NEGATIVE_SETTLEMENT");
  if (paidCents > totalCents) throw new PaymentError(409, "This transaction would overpay the invoice.", "OVERPAYMENT");
  const settled = paidCents === totalCents;
  const status = settled ? "PAID" : invoice.status === "PAID" || invoice.status === "DRAFT" ? "SENT" : invoice.status;
  const updated = await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      legacyPaidAmount: invoice.legacyPaidAmount ?? invoice.paidAmount,
      paymentLedgerActivatedAt: invoice.paymentLedgerActivatedAt || new Date(),
      paidAmount: decimalFromCents(paidCents),
      status,
      paidAt: settled ? effectiveAt : null,
    },
    include: { organization: { select: { id: true, name: true, slug: true } }, lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  const accountingEntry = await syncAccountingProjection(tx, invoice, paidCents, effectiveAt);
  return { invoice: updated, accountingEntry };
};

const audit = (tx, req, invoice, action, summary, metadata) => tx.auditLog.create({ data: {
  userId: req.user.userId,
  organizationId: invoice.organizationId,
  action,
  targetType: "invoice-payment",
  targetId: String(metadata.paymentId || invoice.id),
  source: "api",
  category: "financial",
  severity: action.includes("REJECT") || action.includes("REVERSE") || action.includes("ADJUST") ? "warning" : "info",
  status: "ok",
  summary,
  actorLabel: req.user.fullName || req.user.email || null,
  requestId: String(req.headers?.["x-request-id"] || req.requestId || ""),
  ipAddress: req.ip || null,
  metadata,
} });

const invoiceIdFrom = (req) => {
  const invoiceId = Number(req.params.id);
  if (!Number.isInteger(invoiceId) || invoiceId <= 0) throw new PaymentError(400, "Invoice id must be a valid number.");
  return invoiceId;
};

const paymentIdFrom = (req) => {
  const paymentId = Number(req.params.paymentId);
  if (!Number.isInteger(paymentId) || paymentId <= 0) throw new PaymentError(400, "Payment id must be a valid number.");
  return paymentId;
};

const requireKey = (req) => {
  const key = operationKey(req);
  if (!key || key.length < 8) throw new PaymentError(400, "Provide an Idempotency-Key of at least 8 characters.", "IDEMPOTENCY_KEY_REQUIRED");
  return key;
};

const safeEvidenceUrl = (value) => {
  const text = bounded(value, 1000);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:") throw new Error("unsafe");
    return url.toString();
  } catch {
    throw new PaymentError(400, "evidenceUrl must be an HTTPS URL.");
  }
};

const send = (res, body, status = 200) => res.status(status).json(body);
const handleError = async (res, error, replay) => {
  if (error?.code === "P2002" && replay) {
    try {
      const replayResult = await replay();
      if (replayResult) return send(res, replayResult);
      error = new PaymentError(409, "This payment reference or financial operation was already recorded.", "DUPLICATE_PAYMENT_REFERENCE");
    } catch (replayError) { error = replayError; }
  }
  if (error instanceof PaymentError) return send(res, { error: error.message, code: error.code }, error.status);
  throw error;
};

export const createInvoicePaymentHandlers = ({ prisma, isGlobalAdmin, serializeInvoice }) => {
  const reconciliationReport = async (req, res) => {
    const organizationId = isGlobalAdmin(req.user) && Number.isInteger(Number(req.query?.organizationId))
      ? Number(req.query.organizationId)
      : req.user.organizationId;
    const invoices = await prisma.invoice.findMany({
      where: { organizationId, OR: [{ paidAmount: { gt: 0 } }, { paymentLedgerActivatedAt: { not: null } }] },
      select: { id: true, invoiceNumber: true, currency: true, total: true, paidAmount: true, legacyPaidAmount: true, paymentLedgerActivatedAt: true, _count: { select: { payments: true, paymentLedgerEntries: true } } },
      orderBy: { id: "asc" },
    });
    const accountingEntries = await prisma.accountingEntry.findMany({
      where: { organizationId, invoiceNumber: { in: invoices.map((invoice) => invoice.invoiceNumber) }, type: "REVENUE", archivedAt: null },
      select: { id: true, invoiceNumber: true, amount: true, sourceRef: true },
    });
    const byInvoice = new Map();
    for (const entry of accountingEntries) byInvoice.set(entry.invoiceNumber, [...(byInvoice.get(entry.invoiceNumber) || []), entry]);
    const records = invoices.map((invoice) => {
      const entries = byInvoice.get(invoice.invoiceNumber) || [];
      const paidAmount = numberFrom(invoice.paidAmount);
      const accountingAmount = entries.reduce((sum, entry) => sum + numberFrom(entry.amount), 0);
      const issues = [];
      if (!invoice.paymentLedgerActivatedAt && paidAmount > 0) issues.push("LEGACY_PAYMENT_REQUIRES_REVIEW");
      if (!entries.length && paidAmount > 0) issues.push("MISSING_ACCOUNTING_PROJECTION");
      if (entries.length > 1) issues.push("POTENTIAL_DUPLICATE_ACCOUNTING_ENTRIES");
      if (entries.length && Math.abs(accountingAmount - paidAmount) > 0.005) issues.push("ACCOUNTING_TOTAL_MISMATCH");
      return {
        invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, currency: invoice.currency,
        total: numberFrom(invoice.total), paidAmount, legacyPaidAmount: invoice.legacyPaidAmount === null ? null : numberFrom(invoice.legacyPaidAmount),
        ledgerActivated: Boolean(invoice.paymentLedgerActivatedAt), paymentRecords: invoice._count.payments,
        ledgerEntries: invoice._count.paymentLedgerEntries, accountingEntries: entries.length, accountingAmount, issues,
      };
    });
    return res.json({
      generatedAt: new Date().toISOString(), organizationId,
      summary: { invoicesReviewed: records.length, clean: records.filter((record) => !record.issues.length).length, requiresReview: records.filter((record) => record.issues.length).length },
      records,
      migrationPolicy: "Historical paid amounts are retained as opening balances and are never auto-posted as verified ledger entries.",
    });
  };

  const list = async (req, res) => {
    try {
      const invoiceId = invoiceIdFrom(req);
      const invoice = await prisma.invoice.findFirst({ where: organizationWhere(req, invoiceId, isGlobalAdmin), select: { id: true, organizationId: true } });
      if (!invoice) throw new PaymentError(404, "Invoice not found.");
      const payments = await prisma.invoicePayment.findMany({ where: { invoiceId, organizationId: invoice.organizationId }, include: paymentInclude, orderBy: { createdAt: "desc" } });
      const ledgerEntries = await prisma.invoicePaymentLedgerEntry.findMany({ where: { invoiceId, organizationId: invoice.organizationId }, include: { actorUser: { select: { id: true, fullName: true, email: true } } }, orderBy: { postedAt: "desc" } });
      return res.json({ payments: payments.map(serializeInvoicePayment), ledgerEntries: ledgerEntries.map(serializeLedgerEntry) });
    } catch (error) { return handleError(res, error); }
  };

  const record = async (req, res) => {
    let replay;
    try {
      const invoiceId = invoiceIdFrom(req);
      const key = requireKey(req);
      const method = String(req.body?.method || "").trim().toUpperCase();
      if (!METHODS.has(method)) throw new PaymentError(400, "method must be MOBILE_MONEY, BANK_TRANSFER, CASH, CARD_GATEWAY, or OTHER.");
      const amountCents = centsFrom(req.body?.amount);
      if (amountCents <= 0n) throw new PaymentError(400, "amount must be greater than 0.");
      const provider = bounded(req.body?.provider, 80);
      if (method === "MOBILE_MONEY" && !provider) throw new PaymentError(400, "provider is required for Mobile Money payments.");
      const externalReference = bounded(req.body?.externalReference || req.body?.reference, 180);
      if (REFERENCE_REQUIRED.has(method) && !externalReference) throw new PaymentError(400, "A transaction reference is required for this payment method.");
      const payload = {
        invoiceId, amount: decimalFromCents(amountCents), currency: bounded(req.body?.currency, 3)?.toUpperCase() || null,
        method, provider, externalReference, paymentDate: dateOnly(req.body?.paymentDate || req.body?.paidAt).toISOString().slice(0, 10),
        evidenceUrl: safeEvidenceUrl(req.body?.evidenceUrl), note: bounded(req.body?.note, 500), correctsPaymentId: req.body?.correctsPaymentId ? Number(req.body.correctsPaymentId) : null,
      };
      const fingerprint = fingerprintPaymentRequest(payload);
      let organizationId;
      const result = await retryTransaction(prisma, async (tx) => {
        await lockInvoice(tx, invoiceId);
        const invoice = await tx.invoice.findFirst({ where: organizationWhere(req, invoiceId, isGlobalAdmin) });
        if (!invoice) throw new PaymentError(404, "Invoice not found.");
        organizationId = invoice.organizationId;
        replay = () => resolveReplay(prisma, { organizationId, operation: "RECORD", key, fingerprint });
        if (["VOID", "DECLINED", "QUOTATION"].includes(invoice.status)) throw new PaymentError(400, "Payments can only be recorded for active invoices.");
        if (payload.currency && payload.currency !== invoice.currency) throw new PaymentError(400, "Payment currency must match the invoice currency.", "CURRENCY_MISMATCH");
        if (payload.correctsPaymentId) {
          const corrected = await tx.invoicePayment.findFirst({ where: { id: payload.correctsPaymentId, invoiceId, organizationId, verificationStatus: "REVERSED" } });
          if (!corrected) throw new PaymentError(400, "A correction must reference a reversed payment on this invoice.");
        }
        const claim = await createClaim(tx, { organizationId, invoiceId, operation: "RECORD", key, fingerprint });
        const payment = await tx.invoicePayment.create({ data: {
          organizationId, invoiceId, customerName: invoice.clientName, amount: payload.amount, currency: invoice.currency,
          method, provider, externalReference, externalReferenceKey: buildExternalReferenceKey({ method, provider, externalReference }),
          paymentDate: new Date(`${payload.paymentDate}T00:00:00.000Z`), evidenceUrl: payload.evidenceUrl, note: payload.note,
          recordedByUserId: req.user.userId, correctsPaymentId: payload.correctsPaymentId,
        }, include: paymentInclude });
        const response = { invoice: serializeInvoice(invoice), payment: serializeInvoicePayment(payment), settled: false };
        await completeClaim(tx, claim.id, { paymentId: payment.id, response });
        await audit(tx, req, invoice, "INVOICE_PAYMENT_RECORDED_PENDING", `Recorded pending ${invoice.currency} ${payload.amount} payment for invoice ${invoice.invoiceNumber}.`, { paymentId: payment.id, transactionId: payment.transactionId, method });
        return response;
      });
      return send(res, result, 201);
    } catch (error) { return handleError(res, error, replay); }
  };

  const transition = (operation) => async (req, res) => {
    let replay;
    try {
      const invoiceId = invoiceIdFrom(req);
      const paymentId = paymentIdFrom(req);
      const key = requireKey(req);
      const reason = bounded(req.body?.reason, 500);
      if ((operation === "REJECT" || operation === "REVERSE") && !reason) throw new PaymentError(400, "A reason is required.");
      const refund = operation === "REVERSE" && String(req.body?.type || "").toUpperCase() === "REFUND";
      if (refund && (req.body?.providerConfirmed !== true || !bounded(req.body?.externalReference, 180))) {
        throw new PaymentError(400, "A refund requires providerConfirmed and an external refund reference.");
      }
      const payload = { invoiceId, paymentId, operation, reason, refund, externalReference: bounded(req.body?.externalReference, 180), segregationOverrideReason: bounded(req.body?.segregationOverrideReason, 500) };
      const fingerprint = fingerprintPaymentRequest(payload);
      let organizationId;
      const result = await retryTransaction(prisma, async (tx) => {
        await lockInvoice(tx, invoiceId);
        const invoice = await tx.invoice.findFirst({ where: organizationWhere(req, invoiceId, isGlobalAdmin) });
        if (!invoice) throw new PaymentError(404, "Invoice not found.");
        organizationId = invoice.organizationId;
        replay = () => resolveReplay(prisma, { organizationId, operation, key, fingerprint });
        const payment = await tx.invoicePayment.findFirst({ where: { id: paymentId, invoiceId, organizationId } });
        if (!payment) throw new PaymentError(404, "Payment not found.");
        const claim = await createClaim(tx, { organizationId, invoiceId, operation, key, fingerprint });
        let ledgerEntry = null;
        let projection = { invoice, accountingEntry: null };
        if (operation === "VERIFY") {
          if (payment.verificationStatus !== "PENDING_VERIFICATION") throw new PaymentError(409, "Only pending payments can be verified.", "INVALID_PAYMENT_STATE");
          if (payment.recordedByUserId === req.user.userId && !(isGlobalAdmin(req.user) && payload.segregationOverrideReason)) {
            throw new PaymentError(403, "A different administrator must verify this payment, or a global administrator must provide an override reason.", "SEGREGATION_OF_DUTIES");
          }
          const currentOpening = centsFrom((invoice.legacyPaidAmount ?? invoice.paidAmount ?? 0).toString());
          const currentLedger = await sumLedgerCents(tx, invoice.id);
          if (currentOpening + currentLedger + centsFrom(payment.amount.toString()) > centsFrom(invoice.total.toString())) throw new PaymentError(409, "Verifying this payment would overpay the invoice.", "OVERPAYMENT");
          ledgerEntry = await tx.invoicePaymentLedgerEntry.create({ data: {
            organizationId, invoiceId, paymentId, entryType: "PAYMENT", signedAmount: payment.amount, currency: payment.currency,
            method: payment.method, externalReference: payment.externalReference, effectiveAt: payment.paymentDate,
            actorUserId: req.user.userId, reason: payload.segregationOverrideReason,
            metadata: payload.segregationOverrideReason ? { segregationOverrideReason: payload.segregationOverrideReason } : undefined,
          } });
          await tx.invoicePayment.update({ where: { id: paymentId }, data: { verificationStatus: "VERIFIED", verifiedByUserId: req.user.userId, verifiedAt: new Date() } });
          projection = await updateInvoiceProjection(tx, invoice, payment.paymentDate);
        } else if (operation === "REJECT") {
          if (payment.verificationStatus !== "PENDING_VERIFICATION") throw new PaymentError(409, "Only pending payments can be rejected.", "INVALID_PAYMENT_STATE");
          await tx.invoicePayment.update({ where: { id: paymentId }, data: { verificationStatus: "REJECTED", rejectedByUserId: req.user.userId, rejectedAt: new Date(), rejectionReason: reason } });
        } else {
          if (payment.verificationStatus !== "VERIFIED") throw new PaymentError(409, "Only verified payments can be reversed.", "INVALID_PAYMENT_STATE");
          const original = await tx.invoicePaymentLedgerEntry.findFirst({ where: { paymentId, entryType: "PAYMENT", status: "POSTED" } });
          if (!original) throw new PaymentError(409, "The verified posting is unavailable.");
          ledgerEntry = await tx.invoicePaymentLedgerEntry.create({ data: {
            organizationId, invoiceId, paymentId, entryType: refund ? "REFUND" : "REVERSAL",
            signedAmount: decimalFromCents(-centsFrom(original.signedAmount.toString())), currency: payment.currency, method: payment.method,
            externalReference: payload.externalReference || payment.externalReference, effectiveAt: dateOnly(req.body?.effectiveAt || new Date()), actorUserId: req.user.userId,
            reversesEntryId: original.id, reason, metadata: refund ? { providerConfirmed: true, externalRefundReference: payload.externalReference } : undefined,
          } });
          await tx.invoicePayment.update({ where: { id: paymentId }, data: { verificationStatus: "REVERSED", reversedAt: new Date() } });
          projection = await updateInvoiceProjection(tx, invoice, ledgerEntry.effectiveAt);
        }
        const refreshed = await tx.invoicePayment.findUnique({ where: { id: paymentId }, include: paymentInclude });
        const response = { invoice: serializeInvoice(projection.invoice), payment: serializeInvoicePayment(refreshed), ledgerEntry: ledgerEntry ? serializeLedgerEntry(ledgerEntry) : null };
        await completeClaim(tx, claim.id, { paymentId, ledgerEntryId: ledgerEntry?.id, response });
        await audit(tx, req, invoice, `INVOICE_PAYMENT_${operation}`, `${operation === "VERIFY" ? "Verified" : operation === "REJECT" ? "Rejected" : refund ? "Recorded refund for" : "Reversed"} payment ${payment.transactionId}.`, { paymentId, transactionId: payment.transactionId, ledgerEntryId: ledgerEntry?.id || null, reason });
        return response;
      });
      return send(res, result);
    } catch (error) { return handleError(res, error, replay); }
  };

  const adjust = async (req, res) => {
    let replay;
    try {
      const invoiceId = invoiceIdFrom(req);
      const key = requireKey(req);
      const entryType = String(req.body?.entryType || "").toUpperCase();
      if (!ADJUSTMENT_TYPES.has(entryType)) throw new PaymentError(400, "entryType must be CORRECTION or RECONCILIATION_ADJUSTMENT.");
      const signedCents = centsFrom(req.body?.signedAmount, "signedAmount");
      if (signedCents === 0n) throw new PaymentError(400, "signedAmount cannot be zero.");
      const reason = bounded(req.body?.reason, 500);
      if (!reason) throw new PaymentError(400, "A reconciliation reason is required.");
      const effectiveAt = dateOnly(req.body?.effectiveAt);
      const payload = { invoiceId, entryType, signedAmount: decimalFromCents(signedCents), reason, effectiveAt: effectiveAt.toISOString().slice(0, 10) };
      const fingerprint = fingerprintPaymentRequest(payload);
      let organizationId;
      const result = await retryTransaction(prisma, async (tx) => {
        await lockInvoice(tx, invoiceId);
        const invoice = await tx.invoice.findFirst({ where: organizationWhere(req, invoiceId, isGlobalAdmin) });
        if (!invoice) throw new PaymentError(404, "Invoice not found.");
        organizationId = invoice.organizationId;
        replay = () => resolveReplay(prisma, { organizationId, operation: "ADJUST", key, fingerprint });
        const claim = await createClaim(tx, { organizationId, invoiceId, operation: "ADJUST", key, fingerprint });
        const entry = await tx.invoicePaymentLedgerEntry.create({ data: { organizationId, invoiceId, entryType, signedAmount: payload.signedAmount, currency: invoice.currency, effectiveAt, actorUserId: req.user.userId, reason } });
        const projection = await updateInvoiceProjection(tx, invoice, effectiveAt);
        const response = { invoice: serializeInvoice(projection.invoice), ledgerEntry: serializeLedgerEntry(entry) };
        await completeClaim(tx, claim.id, { ledgerEntryId: entry.id, response });
        await audit(tx, req, invoice, "INVOICE_PAYMENT_ADJUSTED", `Posted ${entryType.toLowerCase().replaceAll("_", " ")} for invoice ${invoice.invoiceNumber}.`, { ledgerEntryId: entry.id, signedAmount: payload.signedAmount, reason });
        return response;
      });
      return send(res, result, 201);
    } catch (error) { return handleError(res, error, replay); }
  };

  return { reconciliationReport, list, record, verify: transition("VERIFY"), reject: transition("REJECT"), reverse: transition("REVERSE"), adjust };
};

export const registerInvoicePaymentRoutes = (app, dependencies) => {
  const { authMiddleware, requireAdmin } = dependencies;
  const handlers = createInvoicePaymentHandlers(dependencies);
  app.get("/api/invoice-payments/reconciliation-report", authMiddleware, requireAdmin, handlers.reconciliationReport);
  app.get("/api/invoices/:id/payments", authMiddleware, requireAdmin, handlers.list);
  app.post("/api/invoices/:id/payments", authMiddleware, requireAdmin, handlers.record);
  app.post("/api/invoices/:id/payments/:paymentId/verify", authMiddleware, requireAdmin, handlers.verify);
  app.post("/api/invoices/:id/payments/:paymentId/reject", authMiddleware, requireAdmin, handlers.reject);
  app.post("/api/invoices/:id/payments/:paymentId/reverse", authMiddleware, requireAdmin, handlers.reverse);
  app.post("/api/invoices/:id/payment-adjustments", authMiddleware, requireAdmin, handlers.adjust);
  return handlers;
};
