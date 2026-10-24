import crypto from "node:crypto";
import { jsPDF } from "jspdf";
import { postVerifiedProviderInvoicePayment } from "../invoices/paymentLedger.js";
import { createPaystackGateway, parseGhsPesewas, PaystackGatewayError, verifyPaystackSignature } from "./paystackGateway.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+0-9() .-]{7,30}$/;
const ACTIVE_INTENT_STATUSES = ["CREATED", "INITIALIZING", "PENDING"];
const INVOICE_PAYMENT_STATUSES = new Set(["SENT", "ACCEPTED", "OVERDUE"]);
const DAY_MS = 86_400_000;

export class PaymentApplicationError extends Error {
  constructor(status, message, code = "PAYMENT_REQUEST_ERROR") {
    super(message);
    this.name = "PaymentApplicationError";
    this.status = status;
    this.code = code;
  }
}

const bounded = (value, max, required = false) => {
  const text = String(value ?? "").trim();
  if (required && !text) throw new PaymentApplicationError(400, "A required payment field is missing.");
  return text ? text.slice(0, max) : null;
};
const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const token = () => crypto.randomBytes(32).toString("base64url");
const reference = (type) => `DEV-${type === "INVOICE" ? "INV" : "PAY"}-${crypto.randomBytes(12).toString("hex")}`;
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const fingerprint = (value) => hash(JSON.stringify(stable(value)));
const minorFromMajor = (value, field = "amount") => {
  try { return parseGhsPesewas(value); }
  catch { throw new PaymentApplicationError(400, `${field} must be a valid amount with no more than two decimal places.`); }
};
const majorFromMinor = (minor) => `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
const integerId = (value, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new PaymentApplicationError(400, `${field} must be a valid id.`);
  return parsed;
};
const validDate = (value, field) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new PaymentApplicationError(400, `${field} must be a valid date.`);
  return parsed;
};
const expiryDays = (value, fallback = 7) => {
  const parsed = value === undefined || value === null || value === "" ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) {
    throw new PaymentApplicationError(400, "expiresInDays must be a whole number from 1 to 30.");
  }
  return parsed;
};
const safeFailure = (error) => {
  if (error?.code === "PAYSTACK_TIMEOUT") return "PROVIDER_TIMEOUT";
  if (error?.code === "PAYSTACK_UNAVAILABLE") return "PROVIDER_UNAVAILABLE";
  if (error instanceof PaystackGatewayError) return "PROVIDER_REJECTED";
  if (error instanceof PaymentApplicationError) return error.code;
  return "INTERNAL_ERROR";
};
const scope = (req, isGlobalAdmin) => isGlobalAdmin(req.user) && req.query?.organizationId ? integerId(req.query.organizationId, "organizationId") : req.user.organizationId;

export const resolvePaystackRuntimeConfig = (env = process.env) => {
  const enabled = String(env.PAYSTACK_PAYMENTS_ENABLED || "").trim().toLowerCase() === "true";
  const mode = String(env.PAYSTACK_MODE || "test").trim().toLowerCase() === "live" ? "live" : "test";
  const secretKey = String(env.PAYSTACK_SECRET_KEY || "").trim();
  const callbackUrl = String(env.PAYSTACK_CALLBACK_URL || "").trim();
  const currency = String(env.PAYSTACK_CURRENCY || "GHS").trim().toUpperCase();
  const expectedPrefix = mode === "live" ? "sk_live_" : "sk_test_";
  let callback = null;
  try { callback = new URL(callbackUrl); } catch { callback = null; }
  const configurationErrors = [
    ...(secretKey.startsWith(expectedPrefix) ? [] : [`PAYSTACK_SECRET_KEY must use ${expectedPrefix}`]),
    ...(callback?.protocol === "https:" ? [] : ["PAYSTACK_CALLBACK_URL must be HTTPS"]),
    ...(currency === "GHS" ? [] : ["PAYSTACK_CURRENCY must be GHS"]),
  ];
  return { enabled, mode, secretKey, callbackUrl: callback?.toString() || "", currency, configured: configurationErrors.length === 0, configurationErrors };
};

export const calculateInvoicePaymentAmountMinor = ({ mode = "FULL", totalMinor, balanceMinor, amount, percentage }) => {
  const normalizedMode = String(mode).toUpperCase();
  if (["FULL", "REMAINING"].includes(normalizedMode)) return balanceMinor;
  if (normalizedMode === "DEPOSIT_PERCENT") {
    const text = String(percentage ?? "").trim();
    if (!/^(?:100(?:\.0{1,2})?|[0-9]{1,2}(?:\.\d{1,2})?)$/.test(text)) throw new PaymentApplicationError(400, "percentage must be greater than 0 and no more than 100 with at most two decimal places.");
    const [whole, fraction = ""] = text.split(".");
    const basisPoints = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
    if (basisPoints <= 0n || basisPoints > 10_000n) throw new PaymentApplicationError(400, "percentage must be greater than 0 and no more than 100.");
    return Math.min(balanceMinor, Number((BigInt(totalMinor) * basisPoints + 5_000n) / 10_000n));
  }
  if (["DEPOSIT_FIXED", "PARTIAL"].includes(normalizedMode)) return minorFromMajor(amount);
  throw new PaymentApplicationError(400, "Unsupported payment amount mode.");
};

const requireRuntime = (config) => {
  if (!config.enabled) throw new PaymentApplicationError(503, "Paystack payments are disabled.", "PAYMENTS_DISABLED");
  if (!config.configured) throw new PaymentApplicationError(503, "Paystack is not configured safely.", "PAYSTACK_NOT_CONFIGURED");
};
const requireVerificationRuntime = (config) => {
  if (!config.configured) throw new PaymentApplicationError(503, "Paystack is not configured safely.", "PAYSTACK_NOT_CONFIGURED");
};
const requestKey = (req) => {
  const key = bounded(req.header?.("idempotency-key") || req.headers?.["idempotency-key"], 160);
  if (!key || key.length < 8) throw new PaymentApplicationError(400, "Provide an Idempotency-Key of at least 8 characters.", "IDEMPOTENCY_KEY_REQUIRED");
  return key;
};
const lock = async (tx, table, id) => tx.$queryRawUnsafe(`SELECT "id" FROM "${table}" WHERE "id" = $1 FOR UPDATE`, id);
const retrySerializable = async (prisma, work) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await prisma.$transaction(work, { isolationLevel: "Serializable" }); }
    catch (error) { if (attempt < 2 && ["P2034", "40001"].includes(error?.code)) continue; throw error; }
  }
};
const pendingReservedMinor = async (tx, where) => {
  const rows = await tx.paymentIntent.aggregate({ where: { ...where, status: { in: ACTIVE_INTENT_STATUSES }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, _sum: { amountMinor: true } });
  return Number(rows._sum.amountMinor || 0);
};
const audit = (tx, { req, organizationId, action, targetType, targetId, summary, metadata, source = "api", actorType = "user" }) => tx.auditLog.create({ data: {
  organizationId, userId: req?.user?.userId || null, action, targetType, targetId: String(targetId), source, category: "financial", severity: "info", status: "ok", summary, actorType,
  actorLabel: req?.user?.fullName || req?.user?.email || (actorType === "payment_provider" ? "Paystack" : null), requestId: String(req?.requestId || req?.headers?.["x-request-id"] || "") || null, ipAddress: req?.ip || null, metadata,
} });

const serializeReceipt = (receipt) => ({ id: receipt.id, receiptNumber: receipt.receiptNumber, issuedAt: receipt.issuedAt, deliveryStatus: receipt.deliveryStatus, sentTo: receipt.sentTo, sentAt: receipt.sentAt, snapshot: receipt.snapshot });
const serializeIntent = (intent, { includeCheckout = true } = {}) => ({
  id: intent.id, type: intent.type, invoiceId: intent.invoiceId, standalonePaymentId: intent.standalonePaymentId, amountMinor: intent.amountMinor, amount: majorFromMinor(intent.amountMinor), currency: intent.currency,
  status: intent.status, provider: intent.provider, providerReference: intent.providerReference, checkoutUrl: includeCheckout ? intent.checkoutUrl : undefined, expiresAt: intent.expiresAt,
  initializedAt: intent.initializedAt, completedAt: intent.completedAt, failedAt: intent.failedAt, failureCategory: intent.failureCategory, providerChannel: intent.providerChannel,
  linkDeliveryStatus: intent.linkDeliveryStatus, linkSentTo: intent.linkSentTo, linkSentAt: intent.linkSentAt,
  createdAt: intent.createdAt, receipt: intent.receipt ? serializeReceipt(intent.receipt) : null,
});
const serializeStandalone = (payment) => ({
  id: payment.id, customerReference: payment.customerReference, customerName: payment.customerName, customerEmail: payment.customerEmail, customerPhone: payment.customerPhone,
  description: payment.description, internalReference: payment.internalReference, internalNotes: payment.internalNotes, expectedMinor: payment.expectedMinor, expectedAmount: majorFromMinor(payment.expectedMinor),
  receivedMinor: payment.receivedMinor, receivedAmount: majorFromMinor(payment.receivedMinor), outstandingMinor: payment.expectedMinor - payment.receivedMinor,
  outstandingAmount: majorFromMinor(payment.expectedMinor - payment.receivedMinor), currency: payment.currency, status: payment.status, dueAt: payment.dueAt, canceledAt: payment.canceledAt,
  reconciledInvoiceId: payment.reconciledInvoiceId, reconciledAt: payment.reconciledAt, createdAt: payment.createdAt, updatedAt: payment.updatedAt,
  attempts: (payment.paymentIntents || []).map((intent) => serializeIntent(intent)), receipts: (payment.receipts || []).map(serializeReceipt),
});

const createIntentRecord = async ({ prisma, req, type, targetId, amountMinor, customerName, customerEmail, expiresInDays = 7 }) => {
  const key = requestKey(req);
  const targetField = type === "INVOICE" ? "invoiceId" : "standalonePaymentId";
  const requestFingerprint = fingerprint({ type, targetId, amountMinor, customerEmail: customerEmail.toLowerCase(), expiresInDays });
  const existing = await prisma.paymentIntent.findUnique({ where: { organizationId_initializationKey: { organizationId: req.user.organizationId, initializationKey: key } }, include: { receipt: true } });
  if (existing) {
    if (existing.requestFingerprint !== requestFingerprint) throw new PaymentApplicationError(409, "Idempotency key was used with a different payment request.", "IDEMPOTENCY_CONFLICT");
    return { intent: existing, rawToken: null, replay: true };
  }
  const rawToken = token();
  let created;
  try {
    created = await retrySerializable(prisma, async (tx) => {
      if (type === "INVOICE") {
      await lock(tx, "Invoice", targetId);
      const invoice = await tx.invoice.findFirst({ where: { id: targetId, organizationId: req.user.organizationId, archivedAt: null } });
      if (!invoice) throw new PaymentApplicationError(404, "Invoice not found.");
      if (!INVOICE_PAYMENT_STATUSES.has(invoice.status)) throw new PaymentApplicationError(409, "Only sent, accepted, or overdue invoices can collect payment.", "INVOICE_NOT_COLLECTIBLE");
      if (!EMAIL_PATTERN.test(String(invoice.clientEmail || ""))) throw new PaymentApplicationError(400, "Invoice requires a valid customer email.");
      if (invoice.currency !== "GHS") throw new PaymentApplicationError(409, "Paystack collection currently supports GHS invoices only.", "UNSUPPORTED_CURRENCY");
      const collectibleMinor = minorFromMajor(invoice.total.toString()) - minorFromMajor(invoice.paidAmount.toString()) - await pendingReservedMinor(tx, { invoiceId: invoice.id });
      if (collectibleMinor <= 0 || amountMinor > collectibleMinor) throw new PaymentApplicationError(409, "Requested amount exceeds the currently collectible invoice balance.", "AMOUNT_EXCEEDS_BALANCE");
      } else {
      await lock(tx, "StandalonePayment", targetId);
      const standalone = await tx.standalonePayment.findFirst({ where: { id: targetId, organizationId: req.user.organizationId } });
      if (!standalone) throw new PaymentApplicationError(404, "Payment request not found.");
      if (["CANCELED", "EXPIRED", "PAID"].includes(standalone.status)) throw new PaymentApplicationError(409, "Payment request cannot accept another attempt.", "INVALID_PAYMENT_STATE");
      if (standalone.reconciledInvoiceId) throw new PaymentApplicationError(409, "This standalone payment was reconciled to an invoice and cannot accept new attempts.", "PAYMENT_ALREADY_RECONCILED");
      const collectibleMinor = standalone.expectedMinor - standalone.receivedMinor - await pendingReservedMinor(tx, { standalonePaymentId: standalone.id });
      if (collectibleMinor <= 0 || amountMinor > collectibleMinor) throw new PaymentApplicationError(409, "Requested amount exceeds the currently collectible balance.", "AMOUNT_EXCEEDS_BALANCE");
      }
      const intent = await tx.paymentIntent.create({ data: {
        organizationId: req.user.organizationId, type, [targetField]: targetId, customerName, customerEmail, amountMinor, currency: "GHS", providerReference: reference(type), publicTokenHash: hash(rawToken),
        initializationKey: key, requestFingerprint, status: "INITIALIZING", expiresAt: new Date(Date.now() + Math.min(Math.max(expiresInDays, 1), 30) * DAY_MS), createdByUserId: req.user.userId,
      } });
      await audit(tx, { req, organizationId: intent.organizationId, action: "PAYSTACK_PAYMENT_INTENT_CREATED", targetType: "payment-intent", targetId: intent.id, summary: "Created Paystack payment attempt.", metadata: { type, invoiceId: intent.invoiceId, standalonePaymentId: intent.standalonePaymentId, amountMinor } });
      return intent;
    });
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    const replay = await prisma.paymentIntent.findUnique({ where: { organizationId_initializationKey: { organizationId: req.user.organizationId, initializationKey: key } }, include: { receipt: true } });
    if (!replay || replay.requestFingerprint !== requestFingerprint) throw new PaymentApplicationError(409, "Idempotency key was used with a different payment request.", "IDEMPOTENCY_CONFLICT");
    return { intent: replay, rawToken: null, replay: true };
  }
  return { intent: created, rawToken, replay: false };
};

const initializeIntent = async ({ prisma, gateway, config, intent, rawToken }) => {
  if (!rawToken) return intent;
  const callback = new URL(config.callbackUrl);
  callback.searchParams.set("token", rawToken);
  try {
    const initialized = await gateway.initialize({ reference: intent.providerReference, amountPesewas: intent.amountMinor, email: intent.customerEmail, callbackUrl: callback.toString(), channels: ["card", "bank", "mobile_money", "bank_transfer"], metadata: { payment_intent_id: intent.id, payment_type: intent.type } });
    return prisma.paymentIntent.update({ where: { id: intent.id }, data: { checkoutUrl: initialized.authorizationUrl, status: "PENDING", initializedAt: new Date(), failureCategory: null }, include: { receipt: true } });
  } catch (error) {
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "FAILED", failedAt: new Date(), failureCategory: safeFailure(error) } });
    throw error;
  }
};

const receiptSnapshot = ({ intent, providerResult, invoice, standalone, remainingMinor }) => ({
  businessName: intent.organization?.name || "Faako", customerName: intent.customerName, paymentDate: providerResult.paidAt || new Date().toISOString(), amountMinor: intent.amountMinor,
  amount: majorFromMinor(intent.amountMinor), currency: intent.currency, paymentMethod: providerResult.channel || "Paystack", provider: "Paystack", providerReference: providerResult.reference,
  invoiceNumber: invoice?.invoiceNumber || null, paymentPurpose: standalone?.description || null, remainingMinor, remainingAmount: Number.isInteger(remainingMinor) ? majorFromMinor(remainingMinor) : null,
});

const reconcile = async ({ prisma, intent, providerResult, eventFingerprint, eventType, requestId, expectedDomain }) => {
  let event = await prisma.paymentProviderEvent.findUnique({ where: { eventFingerprint } });
  if (event?.status === "PROCESSED") return prisma.paymentIntent.findUnique({ where: { id: intent.id }, include: { receipt: true } });
  if (!event) event = await prisma.paymentProviderEvent.create({ data: { organizationId: intent.organizationId, paymentIntentId: intent.id, eventFingerprint, eventType } });
  const failEvent = async (error) => { await prisma.paymentProviderEvent.update({ where: { id: event.id }, data: { status: "FAILED", failureCategory: error.code } }); throw error; };
  if (providerResult.reference !== intent.providerReference) return failEvent(new PaymentApplicationError(409, "Provider reference mismatch.", "REFERENCE_MISMATCH"));
  if (providerResult.status !== "success") {
    await prisma.paymentProviderEvent.update({ where: { id: event.id }, data: { status: "IGNORED", processedAt: new Date(), failureCategory: `PROVIDER_STATUS_${String(providerResult.status || "UNKNOWN").toUpperCase()}` } });
    if (["failed", "abandoned", "reversed"].includes(providerResult.status)) await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "FAILED", failedAt: new Date(), failureCategory: `PROVIDER_${providerResult.status.toUpperCase()}` } });
    return prisma.paymentIntent.findUnique({ where: { id: intent.id }, include: { receipt: true } });
  }
  if (expectedDomain && providerResult.domain && providerResult.domain !== expectedDomain) return failEvent(new PaymentApplicationError(409, "Provider environment does not match the configured Paystack mode.", "PROVIDER_MODE_MISMATCH"));
  if (providerResult.amountPesewas !== intent.amountMinor || providerResult.currency !== intent.currency) return failEvent(new PaymentApplicationError(409, "Provider settlement does not match the payment request.", "SETTLEMENT_MISMATCH"));
  if (providerResult.customerEmail && providerResult.customerEmail.toLowerCase() !== intent.customerEmail.toLowerCase()) return failEvent(new PaymentApplicationError(409, "Provider customer does not match the payment request.", "CUSTOMER_MISMATCH"));
  try {
    return await retrySerializable(prisma, async (tx) => {
      await lock(tx, "PaymentIntent", intent.id);
      const current = await tx.paymentIntent.findUnique({ where: { id: intent.id }, include: { organization: { select: { name: true } }, receipt: true } });
      if (current.status === "SUCCEEDED") { await tx.paymentProviderEvent.update({ where: { id: event.id }, data: { status: "PROCESSED", processedAt: new Date() } }); return current; }
      let invoice = null; let standalone = null; let invoicePaymentId = null; let remainingMinor = 0;
      if (current.type === "INVOICE") {
        const settlement = await postVerifiedProviderInvoicePayment({ tx, intent: current, providerResult, actorUserId: current.createdByUserId, requestId });
        invoice = settlement.invoice; invoicePaymentId = settlement.payment.id;
        remainingMinor = minorFromMajor(invoice.total.toString()) - minorFromMajor(invoice.paidAmount.toString());
      } else {
        await lock(tx, "StandalonePayment", current.standalonePaymentId);
        standalone = await tx.standalonePayment.findFirst({ where: { id: current.standalonePaymentId, organizationId: current.organizationId } });
        if (!standalone || ["CANCELED", "EXPIRED"].includes(standalone.status)) throw new PaymentApplicationError(409, "Standalone payment request is no longer collectible.", "INVALID_PAYMENT_STATE");
        const receivedMinor = standalone.receivedMinor + current.amountMinor;
        if (receivedMinor > standalone.expectedMinor) throw new PaymentApplicationError(409, "Settlement would overpay the standalone request.", "OVERPAYMENT");
        remainingMinor = standalone.expectedMinor - receivedMinor;
        standalone = await tx.standalonePayment.update({ where: { id: standalone.id }, data: { receivedMinor, status: remainingMinor === 0 ? "PAID" : "PARTIALLY_PAID" } });
        await audit(tx, { req: null, organizationId: current.organizationId, action: "STANDALONE_PAYMENT_PROVIDER_SETTLED", targetType: "standalone-payment", targetId: standalone.id, summary: "Verified Paystack standalone payment settlement.", source: "paystack", actorType: "payment_provider", metadata: { paymentIntentId: current.id, providerReference: providerResult.reference, amountMinor: current.amountMinor } });
      }
      const receiptNumber = `RCP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(current.id).padStart(6, "0")}`;
      const receipt = current.receipt || await tx.paymentReceipt.create({ data: { organizationId: current.organizationId, paymentIntentId: current.id, standalonePaymentId: current.standalonePaymentId, receiptNumber, publicTokenHash: hash(`${current.publicTokenHash}:receipt`), snapshot: receiptSnapshot({ intent: current, providerResult, invoice, standalone, remainingMinor }) } });
      const updated = await tx.paymentIntent.update({ where: { id: current.id }, data: { status: "SUCCEEDED", completedAt: new Date(), invoicePaymentId, providerTransactionId: providerResult.transactionId, providerChannel: providerResult.channel, providerPaidAt: providerResult.paidAt ? new Date(providerResult.paidAt) : new Date(), failureCategory: null }, include: { receipt: true } });
      await tx.paymentProviderEvent.update({ where: { id: event.id }, data: { status: "PROCESSED", processedAt: new Date(), failureCategory: null } });
      await audit(tx, { req: null, organizationId: current.organizationId, action: "PAYSTACK_PAYMENT_RECONCILED", targetType: "payment-intent", targetId: current.id, summary: "Paystack payment verified and reconciled.", source: "paystack", actorType: "payment_provider", metadata: { receiptId: receipt.id, invoicePaymentId, providerReference: providerResult.reference } });
      return updated;
    });
  } catch (error) { await prisma.paymentProviderEvent.update({ where: { id: event.id }, data: { status: "FAILED", failureCategory: safeFailure(error) } }).catch(() => {}); throw error; }
};

const findIntentByToken = async (prisma, rawToken) => {
  const value = bounded(rawToken, 200);
  if (!value || value.length < 32) return null;
  return prisma.paymentIntent.findUnique({ where: { publicTokenHash: hash(value) }, include: { receipt: true, organization: { select: { name: true } } } });
};

export const buildReceiptPdf = (snapshot, receiptNumber) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text("Payment receipt", 48, 62);
  doc.setFontSize(12); doc.text(snapshot.businessName || "Faako", 48, 88);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  let y = 126;
  for (const [label, value] of [["Receipt", receiptNumber], ["Customer", snapshot.customerName], ["Date", new Date(snapshot.paymentDate).toISOString().slice(0, 10)], ["Amount", `${snapshot.currency} ${snapshot.amount}`], ["Method", snapshot.paymentMethod], ["Provider reference", snapshot.providerReference], ["Invoice", snapshot.invoiceNumber], ["Purpose", snapshot.paymentPurpose], ["Remaining balance", snapshot.remainingAmount == null ? null : `${snapshot.currency} ${snapshot.remainingAmount}`]]) {
    if (value == null) continue;
    doc.setFont("helvetica", "bold"); doc.text(`${label}:`, 48, y); doc.setFont("helvetica", "normal"); doc.text(String(value), 170, y); y += 24;
  }
  doc.setFontSize(9); doc.text("This receipt confirms a provider-verified payment recorded by DEV ERP.", 48, y + 22);
  return Buffer.from(doc.output("arraybuffer"));
};

export const createPaystackPaymentHandlers = ({ prisma, isGlobalAdmin, env = process.env, sendEmail, gateway: providedGateway }) => {
  const config = resolvePaystackRuntimeConfig(env);
  const gateway = providedGateway || (config.configured ? createPaystackGateway({ secretKey: config.secretKey }) : null);
  const initializeInvoice = async (req, res) => {
    try {
      requireRuntime(config);
      const invoiceId = integerId(req.params.id, "invoiceId");
      const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId: req.user.organizationId, archivedAt: null } });
      if (!invoice) throw new PaymentApplicationError(404, "Invoice not found.");
      const totalMinor = minorFromMajor(invoice.total.toString(), "invoice total");
      const balanceMinor = totalMinor - minorFromMajor(invoice.paidAmount.toString(), "invoice paid amount");
      const amountMinor = calculateInvoicePaymentAmountMinor({ mode: req.body?.mode, totalMinor, balanceMinor, amount: req.body?.amount, percentage: req.body?.percentage });
      const created = await createIntentRecord({ prisma, req, type: "INVOICE", targetId: invoiceId, amountMinor, customerName: invoice.clientName, customerEmail: invoice.clientEmail, expiresInDays: expiryDays(req.body?.expiresInDays) });
      const initialized = created.replay ? created.intent : await initializeIntent({ prisma, gateway, config, intent: created.intent, rawToken: created.rawToken });
      return res.status(created.replay ? 200 : 201).json({ intent: serializeIntent(initialized), publicStatusUrl: created.rawToken ? `${config.callbackUrl}?token=${encodeURIComponent(created.rawToken)}` : null, idempotentReplay: created.replay });
    } catch (error) { return handle(res, error); }
  };
  const createStandalone = async (req, res) => {
    try {
      const initializationKey = requestKey(req);
      const customerName = bounded(req.body?.customerName, 160, true);
      const customerEmail = bounded(req.body?.customerEmail, 254, true)?.toLowerCase();
      if (!EMAIL_PATTERN.test(customerEmail)) throw new PaymentApplicationError(400, "Valid customer email required.");
      const customerPhone = bounded(req.body?.customerPhone, 30);
      if (customerPhone && !PHONE_PATTERN.test(customerPhone)) throw new PaymentApplicationError(400, "customerPhone is invalid.");
      const expectedMinor = minorFromMajor(req.body?.amount);
      const description = bounded(req.body?.description, 500, true);
      const dueAt = validDate(req.body?.dueDate, "dueDate");
      const customerReference = bounded(req.body?.customerReference, 160);
      const internalReference = bounded(req.body?.internalReference, 160);
      const internalNotes = bounded(req.body?.internalNotes, 1000);
      const requestFingerprint = fingerprint({ customerName, customerEmail, customerPhone, expectedMinor, description, dueAt: dueAt?.toISOString() || null, customerReference, internalReference, internalNotes });
      const existing = await prisma.standalonePayment.findUnique({ where: { organizationId_creationKey: { organizationId: req.user.organizationId, creationKey: initializationKey } } });
      if (existing) {
        if (existing.requestFingerprint !== requestFingerprint) throw new PaymentApplicationError(409, "Idempotency key was used with a different payment request.", "IDEMPOTENCY_CONFLICT");
        return res.json({ payment: serializeStandalone(existing), idempotentReplay: true });
      }
      let standalone;
      try {
        standalone = await prisma.$transaction(async (tx) => {
          const created = await tx.standalonePayment.create({ data: { organizationId: req.user.organizationId, customerReference, customerName, customerEmail, customerPhone, description, internalReference, internalNotes, creationKey: initializationKey, requestFingerprint, expectedMinor, currency: "GHS", dueAt, createdByUserId: req.user.userId } });
          await audit(tx, { req, organizationId: req.user.organizationId, action: "STANDALONE_PAYMENT_CREATED", targetType: "standalone-payment", targetId: created.id, summary: "Created standalone payment request.", metadata: { expectedMinor, currency: "GHS" } });
          return created;
        });
      } catch (error) {
        if (error?.code !== "P2002") throw error;
        const replay = await prisma.standalonePayment.findUnique({ where: { organizationId_creationKey: { organizationId: req.user.organizationId, creationKey: initializationKey } } });
        if (!replay || replay.requestFingerprint !== requestFingerprint) throw new PaymentApplicationError(409, "Idempotency key was used with a different payment request.", "IDEMPOTENCY_CONFLICT");
        return res.json({ payment: serializeStandalone(replay), idempotentReplay: true });
      }
      return res.status(201).json({ payment: serializeStandalone(standalone) });
    } catch (error) { return handle(res, error); }
  };
  const initializeStandalone = async (req, res) => {
    try {
      requireRuntime(config);
      const id = integerId(req.params.id, "paymentId");
      const standalone = await prisma.standalonePayment.findFirst({ where: { id, organizationId: req.user.organizationId } });
      if (!standalone) throw new PaymentApplicationError(404, "Payment request not found.");
      const outstanding = standalone.expectedMinor - standalone.receivedMinor;
      const amountMinor = req.body?.amount ? minorFromMajor(req.body.amount) : outstanding;
      const created = await createIntentRecord({ prisma, req, type: "STANDALONE", targetId: id, amountMinor, customerName: standalone.customerName, customerEmail: standalone.customerEmail, expiresInDays: expiryDays(req.body?.expiresInDays) });
      const initialized = created.replay ? created.intent : await initializeIntent({ prisma, gateway, config, intent: created.intent, rawToken: created.rawToken });
      if (!created.replay) await prisma.standalonePayment.update({ where: { id }, data: { status: "PENDING" } });
      return res.status(created.replay ? 200 : 201).json({ intent: serializeIntent(initialized), publicStatusUrl: created.rawToken ? `${config.callbackUrl}?token=${encodeURIComponent(created.rawToken)}` : null, idempotentReplay: created.replay });
    } catch (error) { return handle(res, error); }
  };
  const list = async (req, res) => {
    try {
      const organizationId = scope(req, isGlobalAdmin);
      const standalonePayments = await prisma.standalonePayment.findMany({ where: { organizationId }, include: { paymentIntents: { include: { receipt: true }, orderBy: { createdAt: "desc" } }, receipts: { orderBy: { issuedAt: "desc" } } }, orderBy: { createdAt: "desc" }, take: 200 });
      const invoiceIntents = await prisma.paymentIntent.findMany({ where: { organizationId, type: "INVOICE" }, include: { receipt: true, invoice: { select: { invoiceNumber: true, total: true, paidAmount: true, status: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
      return res.json({ standalonePayments: standalonePayments.map(serializeStandalone), invoicePayments: invoiceIntents.map((intent) => ({ ...serializeIntent(intent), invoice: intent.invoice })) });
    } catch (error) { return handle(res, error); }
  };
  const detail = async (req, res) => {
    try {
      const id = integerId(req.params.id, "paymentId");
      const payment = await prisma.standalonePayment.findFirst({ where: { id, organizationId: req.user.organizationId }, include: { paymentIntents: { include: { receipt: true, providerEvents: { orderBy: { receivedAt: "desc" } } }, orderBy: { createdAt: "desc" } }, receipts: { orderBy: { issuedAt: "desc" } } } });
      if (!payment) throw new PaymentApplicationError(404, "Payment request not found.");
      return res.json({ payment: serializeStandalone(payment), events: payment.paymentIntents.flatMap((intent) => intent.providerEvents.map((event) => ({ id: event.id, paymentIntentId: intent.id, eventType: event.eventType, status: event.status, receivedAt: event.receivedAt, processedAt: event.processedAt, failureCategory: event.failureCategory }))) });
    } catch (error) { return handle(res, error); }
  };
  const cancel = async (req, res) => {
    try {
      const id = integerId(req.params.id, "paymentId");
      const result = await retrySerializable(prisma, async (tx) => {
        await lock(tx, "StandalonePayment", id);
        const payment = await tx.standalonePayment.findFirst({ where: { id, organizationId: req.user.organizationId } });
        if (!payment) throw new PaymentApplicationError(404, "Payment request not found.");
        if (payment.status === "CANCELED") return payment;
        if (payment.receivedMinor > 0 || payment.status === "PAID") throw new PaymentApplicationError(409, "A payment request with settlements cannot be canceled.");
        const updated = await tx.standalonePayment.update({ where: { id }, data: { status: "CANCELED", canceledAt: new Date() } });
        await tx.paymentIntent.updateMany({ where: { standalonePaymentId: id, status: { in: ACTIVE_INTENT_STATUSES } }, data: { status: "CANCELED" } });
        await audit(tx, { req, organizationId: payment.organizationId, action: "STANDALONE_PAYMENT_CANCELED", targetType: "standalone-payment", targetId: id, summary: "Canceled unpaid standalone payment request.", metadata: {} });
        return updated;
      });
      return res.json({ payment: serializeStandalone(result) });
    } catch (error) { return handle(res, error); }
  };
  const retry = async (req, res) => {
    try {
      requireRuntime(config);
      const id = integerId(req.params.id, "intentId");
      const intent = await prisma.paymentIntent.findFirst({ where: { id, organizationId: req.user.organizationId }, include: { invoice: true, standalonePayment: true, receipt: true, organization: { select: { name: true } } } });
      if (!intent) throw new PaymentApplicationError(404, "Payment attempt not found.");
      if (intent.status !== "FAILED") throw new PaymentApplicationError(409, "Only failed initialization attempts can be retried.", "INVALID_PAYMENT_STATE");
      try {
        const verified = await gateway.verify(intent.providerReference);
        if (verified.status === "success") return res.json({ intent: serializeIntent(await reconcile({ prisma, intent, providerResult: verified, eventFingerprint: hash(`retry-verify:${intent.id}:${verified.transactionId || "success"}`), eventType: "admin.retry.verify", requestId: req.requestId, expectedDomain: config.mode })), recoveredExistingTransaction: true });
        if (!["failed", "abandoned", "reversed"].includes(String(verified.status || "").toLowerCase())) {
          throw new PaymentApplicationError(409, "The prior provider transaction is not terminal. Review it before creating another attempt.", "PRIOR_TRANSACTION_UNRESOLVED");
        }
      } catch (error) { if (error?.code !== "PAYSTACK_TRANSACTION_NOT_FOUND") throw error; }
      const target = intent.type === "INVOICE" ? intent.invoice : intent.standalonePayment;
      if (!target) throw new PaymentApplicationError(409, "Payment target is unavailable.");
      const created = await createIntentRecord({ prisma, req, type: intent.type, targetId: intent.invoiceId || intent.standalonePaymentId, amountMinor: intent.amountMinor, customerName: intent.type === "INVOICE" ? target.clientName : target.customerName, customerEmail: intent.type === "INVOICE" ? target.clientEmail : target.customerEmail, expiresInDays: expiryDays(req.body?.expiresInDays) });
      const initialized = created.replay ? created.intent : await initializeIntent({ prisma, gateway, config, intent: created.intent, rawToken: created.rawToken });
      return res.status(created.replay ? 200 : 201).json({ intent: serializeIntent(initialized), publicStatusUrl: created.rawToken ? `${config.callbackUrl}?token=${encodeURIComponent(created.rawToken)}` : null, idempotentReplay: created.replay });
    } catch (error) { return handle(res, error); }
  };
  const reconcileStandaloneToInvoice = async (req, res) => {
    try {
      requestKey(req);
      const standaloneId = integerId(req.params.id, "paymentId");
      const invoiceId = integerId(req.body?.invoiceId, "invoiceId");
      const result = await retrySerializable(prisma, async (tx) => {
        await lock(tx, "StandalonePayment", standaloneId); await lock(tx, "Invoice", invoiceId);
        const standalone = await tx.standalonePayment.findFirst({ where: { id: standaloneId, organizationId: req.user.organizationId }, include: { paymentIntents: { where: { status: "SUCCEEDED" }, orderBy: { completedAt: "asc" } } } });
        if (!standalone) throw new PaymentApplicationError(404, "Payment request not found.");
        if (standalone.reconciledInvoiceId) {
          if (standalone.reconciledInvoiceId !== invoiceId) throw new PaymentApplicationError(409, "Payment request is already reconciled to another invoice.", "PAYMENT_ALREADY_RECONCILED");
          return standalone;
        }
        if (standalone.receivedMinor <= 0 || !standalone.paymentIntents.length) throw new PaymentApplicationError(409, "Only settled standalone payments can be reconciled.");
        const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, organizationId: standalone.organizationId, archivedAt: null } });
        if (!invoice) throw new PaymentApplicationError(404, "Invoice not found.");
        if (invoice.currency !== standalone.currency || !INVOICE_PAYMENT_STATUSES.has(invoice.status)) throw new PaymentApplicationError(409, "Invoice is not eligible for this reconciliation.");
        for (const intent of standalone.paymentIntents) {
          if (intent.invoicePaymentId) continue;
          const settlement = await postVerifiedProviderInvoicePayment({ tx, intent: { ...intent, invoiceId }, providerResult: { reference: intent.providerReference, status: "success", amountPesewas: intent.amountMinor, currency: intent.currency, paidAt: intent.providerPaidAt, transactionId: intent.providerTransactionId, channel: intent.providerChannel, customerEmail: intent.customerEmail }, actorUserId: req.user.userId, requestId: req.requestId });
          await tx.paymentIntent.update({ where: { id: intent.id }, data: { invoicePaymentId: settlement.payment.id } });
        }
        const updated = await tx.standalonePayment.update({ where: { id: standalone.id }, data: { reconciledInvoiceId: invoiceId, reconciledAt: new Date(), reconciledByUserId: req.user.userId } });
        await audit(tx, { req, organizationId: standalone.organizationId, action: "STANDALONE_PAYMENT_RECONCILED_TO_INVOICE", targetType: "standalone-payment", targetId: standalone.id, summary: `Reconciled standalone collection to invoice ${invoice.invoiceNumber}.`, metadata: { invoiceId, receivedMinor: standalone.receivedMinor } });
        return updated;
      });
      return res.json({ payment: serializeStandalone(result) });
    } catch (error) { return handle(res, error); }
  };
  const webhook = async (req, res) => {
    try {
      requireVerificationRuntime(config);
      if (!Buffer.isBuffer(req.rawBody) || !verifyPaystackSignature(req.rawBody, String(req.header("x-paystack-signature") || ""), config.secretKey)) return res.status(401).json({ error: "Invalid Paystack signature." });
      const eventType = bounded(req.body?.event, 100) || "unknown";
      const providerReference = bounded(req.body?.data?.reference, 120);
      if (!providerReference) return res.status(200).json({ ok: true, ignored: true });
      const intent = await prisma.paymentIntent.findUnique({ where: { providerReference }, include: { receipt: true, organization: { select: { name: true } } } });
      if (!intent) return res.status(200).json({ ok: true, ignored: true });
      const eventFingerprint = hash(req.rawBody);
      if (eventType !== "charge.success") { await prisma.paymentProviderEvent.upsert({ where: { eventFingerprint }, create: { organizationId: intent.organizationId, paymentIntentId: intent.id, eventFingerprint, eventType, status: "IGNORED", processedAt: new Date() }, update: {} }); return res.status(200).json({ ok: true, ignored: true }); }
      await prisma.paymentProviderEvent.upsert({ where: { eventFingerprint }, create: { organizationId: intent.organizationId, paymentIntentId: intent.id, eventFingerprint, eventType }, update: {} });
      let verified;
      try { verified = await gateway.verify(providerReference); }
      catch (error) { await prisma.paymentProviderEvent.update({ where: { eventFingerprint }, data: { status: "FAILED", failureCategory: safeFailure(error) } }).catch(() => {}); throw error; }
      await reconcile({ prisma, intent, providerResult: verified, eventFingerprint, eventType, requestId: req.requestId, expectedDomain: config.mode });
      return res.status(200).json({ ok: true });
    } catch (error) {
      if (error instanceof PaymentApplicationError && error.status < 500) return res.status(200).json({ ok: true, reconciliationRequired: true, code: error.code });
      return res.status(503).json({ error: "Payment event could not be reconciled safely." });
    }
  };
  const publicStatus = async (req, res) => {
    try {
      requireVerificationRuntime(config);
      const intent = await findIntentByToken(prisma, req.params.token);
      if (!intent) throw new PaymentApplicationError(404, "Payment status link is invalid or expired.");
      let current = intent;
      if (ACTIVE_INTENT_STATUSES.includes(intent.status)) {
        const verified = await gateway.verify(intent.providerReference);
        current = await reconcile({ prisma, intent, providerResult: verified, eventFingerprint: hash(`return:${intent.id}:${verified.status}:${verified.transactionId || "none"}`), eventType: "browser.return", requestId: req.requestId, expectedDomain: config.mode });
        if (ACTIVE_INTENT_STATUSES.includes(current.status) && current.expiresAt && current.expiresAt <= new Date()) current = await prisma.paymentIntent.update({ where: { id: current.id }, data: { status: "EXPIRED" }, include: { receipt: true } });
      }
      return res.json({ status: current.status, amount: majorFromMinor(current.amountMinor), currency: current.currency, receiptAvailable: Boolean(current.receipt) });
    } catch (error) { return handle(res, error); }
  };
  const receipt = async (req, res) => {
    try {
      const intent = await findIntentByToken(prisma, req.params.token);
      if (!intent?.receipt || intent.status !== "SUCCEEDED") throw new PaymentApplicationError(404, "Receipt is unavailable.");
      const pdf = buildReceiptPdf(intent.receipt.snapshot, intent.receipt.receiptNumber);
      res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", `attachment; filename="${intent.receipt.receiptNumber}.pdf"`); res.setHeader("Cache-Control", "private, no-store");
      return res.send(pdf);
    } catch (error) { return handle(res, error); }
  };
  const adminReceipt = async (req, res) => {
    try {
      const record = await prisma.paymentReceipt.findFirst({ where: { id: integerId(req.params.id, "receiptId"), organizationId: req.user.organizationId } });
      if (!record) throw new PaymentApplicationError(404, "Receipt not found.");
      res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", `attachment; filename="${record.receiptNumber}.pdf"`);
      return res.send(buildReceiptPdf(record.snapshot, record.receiptNumber));
    } catch (error) { return handle(res, error); }
  };
  const sendReceipt = async (req, res) => {
    try {
      if (typeof sendEmail !== "function") throw new PaymentApplicationError(503, "Email delivery is unavailable.");
      const id = integerId(req.params.id, "receiptId");
      const record = await prisma.paymentReceipt.findFirst({ where: { id, organizationId: req.user.organizationId }, include: { paymentIntent: true } });
      if (!record) throw new PaymentApplicationError(404, "Receipt not found.");
      const recipient = bounded(req.body?.recipient || record.paymentIntent.customerEmail, 254)?.toLowerCase();
      if (!EMAIL_PATTERN.test(recipient)) throw new PaymentApplicationError(400, "Valid recipient email required.");
      const snapshot = record.snapshot;
      try {
        await sendEmail({ fromEmail: env.PAYMENT_EMAIL_FROM || env.ALERT_FROM_EMAIL || env.DEFAULT_ADMIN_EMAIL, fromName: "Payments By Nana", recipients: [recipient], subject: `Payment receipt ${record.receiptNumber}`, text: `Hello ${snapshot.customerName},\n\nYour payment of ${snapshot.currency} ${snapshot.amount} was verified.\nReceipt: ${record.receiptNumber}\nProvider reference: ${snapshot.providerReference}\n${snapshot.remainingAmount !== null ? `Remaining balance: ${snapshot.currency} ${snapshot.remainingAmount}\n` : ""}`, html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1f2937"><h1 style="color:#0f5132">Payment received</h1><p>Hello ${escapeHtml(snapshot.customerName)},</p><p>Your payment has been independently verified.</p><p style="font-size:24px;font-weight:700">${escapeHtml(snapshot.currency)} ${escapeHtml(snapshot.amount)}</p><p><strong>Receipt:</strong> ${escapeHtml(record.receiptNumber)}<br><strong>Provider reference:</strong> ${escapeHtml(snapshot.providerReference)}</p>${snapshot.remainingAmount !== null ? `<p><strong>Remaining balance:</strong> ${escapeHtml(snapshot.currency)} ${escapeHtml(snapshot.remainingAmount)}</p>` : ""}</div>` });
        await prisma.paymentReceipt.update({ where: { id }, data: { deliveryStatus: "SENT", sentTo: recipient, sentAt: new Date(), deliveryFailure: null } });
      } catch (error) { await prisma.paymentReceipt.update({ where: { id }, data: { deliveryStatus: "FAILED", deliveryFailure: safeFailure(error) } }); throw error; }
      return res.json({ sent: true, sentTo: recipient, sentAt: new Date().toISOString() });
    } catch (error) { return handle(res, error); }
  };
  const sendLink = async (req, res) => {
    try {
      requireRuntime(config);
      if (typeof sendEmail !== "function") throw new PaymentApplicationError(503, "Email delivery is unavailable.");
      const idempotencyKey = requestKey(req);
      const intent = await prisma.paymentIntent.findFirst({ where: { id: integerId(req.params.id, "intentId"), organizationId: req.user.organizationId }, include: { invoice: { select: { invoiceNumber: true } }, standalonePayment: { select: { description: true } } } });
      if (!intent?.checkoutUrl || intent.status !== "PENDING" || (intent.expiresAt && intent.expiresAt <= new Date())) throw new PaymentApplicationError(409, "Payment link is not active.");
      const recipient = bounded(req.body?.recipient || intent.customerEmail, 254)?.toLowerCase();
      if (!EMAIL_PATTERN.test(recipient)) throw new PaymentApplicationError(400, "Valid recipient email required.");
      const purpose = intent.invoice?.invoiceNumber ? `invoice ${intent.invoice.invoiceNumber}` : intent.standalonePayment?.description || "your payment request";
      const note = bounded(req.body?.message, 500);
      const requestFingerprint = fingerprint({ paymentIntentId: intent.id, recipient, note });
      const replay = await prisma.paymentLinkDelivery.findUnique({ where: { organizationId_idempotencyKey: { organizationId: intent.organizationId, idempotencyKey } } });
      if (replay) {
        if (replay.requestFingerprint !== requestFingerprint) throw new PaymentApplicationError(409, "Idempotency key was used with a different email request.", "IDEMPOTENCY_CONFLICT");
        if (replay.status === "SENT") return res.json({ sent: true, sentTo: replay.recipient, sentAt: replay.sentAt, idempotentReplay: true });
        throw new PaymentApplicationError(409, replay.status === "FAILED" ? "The earlier email attempt failed. Use a new Idempotency-Key to resend." : "The email delivery is already in progress.", replay.status === "FAILED" ? "DELIVERY_RETRY_KEY_REQUIRED" : "DELIVERY_IN_PROGRESS");
      }
      let delivery;
      try {
        delivery = await prisma.paymentLinkDelivery.create({ data: { organizationId: intent.organizationId, paymentIntentId: intent.id, recipient, idempotencyKey, requestFingerprint } });
      } catch (error) {
        if (error?.code !== "P2002") throw error;
        const concurrent = await prisma.paymentLinkDelivery.findUnique({ where: { organizationId_idempotencyKey: { organizationId: intent.organizationId, idempotencyKey } } });
        if (!concurrent || concurrent.requestFingerprint !== requestFingerprint) throw new PaymentApplicationError(409, "Idempotency key was used with a different email request.", "IDEMPOTENCY_CONFLICT");
        if (concurrent.status === "SENT") return res.json({ sent: true, sentTo: concurrent.recipient, sentAt: concurrent.sentAt, idempotentReplay: true });
        throw new PaymentApplicationError(409, "The email delivery is already in progress.", "DELIVERY_IN_PROGRESS");
      }
      try {
        await sendEmail({ fromEmail: env.PAYMENT_EMAIL_FROM || env.ALERT_FROM_EMAIL || env.DEFAULT_ADMIN_EMAIL, fromName: "Payments By Nana", recipients: [recipient], subject: `Secure payment link for ${purpose}`, text: `Hello ${intent.customerName},\n\nYour secure Paystack payment link for ${purpose} is ready. Amount: GHS ${majorFromMinor(intent.amountMinor)}.${note ? `\n\n${note}` : ""}\n\nPay securely: ${intent.checkoutUrl}\n\nThis link expires ${intent.expiresAt ? new Date(intent.expiresAt).toUTCString() : "when the request is closed"}.`, html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1f2937"><h1 style="color:#0f5132">Secure payment request</h1><p>Hello ${escapeHtml(intent.customerName)},</p><p>Your payment link for ${escapeHtml(purpose)} is ready.</p><p style="font-size:24px;font-weight:700">GHS ${majorFromMinor(intent.amountMinor)}</p>${note ? `<p>${escapeHtml(note)}</p>` : ""}<p><a href="${escapeHtml(intent.checkoutUrl)}" style="display:inline-block;background:#0f5132;color:white;padding:14px 22px;border-radius:8px;text-decoration:none">Pay securely with Paystack</a></p><p style="font-size:12px;color:#6b7280">Payment is confirmed only after server verification. Do not forward this email.</p></div>` });
        const sentAt = new Date();
        await prisma.$transaction([
          prisma.paymentLinkDelivery.update({ where: { id: delivery.id }, data: { status: "SENT", sentAt, failureCategory: null } }),
          prisma.paymentIntent.update({ where: { id: intent.id }, data: { linkDeliveryStatus: "SENT", linkSentTo: recipient, linkSentAt: sentAt, linkDeliveryFailure: null } }),
        ]);
      } catch (error) {
        const failureCategory = safeFailure(error);
        await prisma.$transaction([
          prisma.paymentLinkDelivery.update({ where: { id: delivery.id }, data: { status: "FAILED", failedAt: new Date(), failureCategory } }),
          prisma.paymentIntent.update({ where: { id: intent.id }, data: { linkDeliveryStatus: "FAILED", linkDeliveryFailure: failureCategory } }),
          prisma.auditLog.create({ data: { organizationId: intent.organizationId, userId: req.user.userId, action: "PAYSTACK_PAYMENT_LINK_SEND_FAILED", targetType: "payment-intent", targetId: String(intent.id), source: "api", category: "financial", severity: "warning", status: "failed", summary: "Paystack payment link email failed.", actorType: "user", actorLabel: req.user.fullName || req.user.email, requestId: req.requestId, metadata: { recipient, failureCategory } } }),
        ]).catch(() => {});
        throw new PaymentApplicationError(502, "Unable to send the payment link. The existing checkout link remains active.", "PAYMENT_LINK_DELIVERY_FAILED");
      }
      await prisma.auditLog.create({ data: { organizationId: intent.organizationId, userId: req.user.userId, action: "PAYSTACK_PAYMENT_LINK_SENT", targetType: "payment-intent", targetId: String(intent.id), source: "api", category: "financial", severity: "info", status: "ok", summary: "Sent Paystack payment link.", actorType: "user", actorLabel: req.user.fullName || req.user.email, requestId: req.requestId, metadata: { recipient } } });
      return res.json({ sent: true, sentTo: recipient, sentAt: new Date().toISOString(), idempotentReplay: false });
    } catch (error) { return handle(res, error); }
  };
  const exceptions = async (req, res) => {
    try {
      const events = await prisma.paymentProviderEvent.findMany({ where: { organizationId: scope(req, isGlobalAdmin), status: "FAILED" }, include: { paymentIntent: { select: { id: true, type: true, providerReference: true, status: true, invoiceId: true, standalonePaymentId: true } } }, orderBy: { receivedAt: "desc" }, take: 200 });
      return res.json({ exceptions: events.map((event) => ({ id: event.id, eventType: event.eventType, failureCategory: event.failureCategory, receivedAt: event.receivedAt, paymentIntent: event.paymentIntent })) });
    } catch (error) { return handle(res, error); }
  };
  return { initializeInvoice, createStandalone, initializeStandalone, list, detail, cancel, retry, reconcileStandaloneToInvoice, webhook, publicStatus, receipt, adminReceipt, sendReceipt, sendLink, exceptions };
};

const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const handle = (res, error) => {
  if (error instanceof PaymentApplicationError || error instanceof PaystackGatewayError) return res.status(error.status || 500).json({ error: error.message, code: error.code || "PAYMENT_ERROR" });
  if (error?.code === "P2002") return res.status(409).json({ error: "Payment reference or idempotency key already exists.", code: "DUPLICATE_PAYMENT_REQUEST" });
  throw error;
};

export const registerPaystackPaymentRoutes = (app, dependencies) => {
  const handlers = createPaystackPaymentHandlers(dependencies);
  const { authMiddleware, requireAdmin, mutationRateLimit } = dependencies;
  const mutation = mutationRateLimit || ((_req, _res, next) => next());
  app.post("/api/invoices/:id/paystack-intents", authMiddleware, requireAdmin, mutation, handlers.initializeInvoice);
  app.post("/api/payments/standalone", authMiddleware, requireAdmin, mutation, handlers.createStandalone);
  app.post("/api/payments/standalone/:id/intents", authMiddleware, requireAdmin, mutation, handlers.initializeStandalone);
  app.get("/api/payments/requests", authMiddleware, requireAdmin, handlers.list);
  app.get("/api/payments/requests/:id", authMiddleware, requireAdmin, handlers.detail);
  app.post("/api/payments/requests/:id/cancel", authMiddleware, requireAdmin, mutation, handlers.cancel);
  app.post("/api/payments/requests/:id/reconcile-invoice", authMiddleware, requireAdmin, mutation, handlers.reconcileStandaloneToInvoice);
  app.post("/api/payments/intents/:id/retry", authMiddleware, requireAdmin, mutation, handlers.retry);
  app.post("/api/payments/intents/:id/send", authMiddleware, requireAdmin, mutation, handlers.sendLink);
  app.get("/api/payments/receipts/:id", authMiddleware, requireAdmin, handlers.adminReceipt);
  app.post("/api/payments/receipts/:id/send", authMiddleware, requireAdmin, mutation, handlers.sendReceipt);
  app.get("/api/payments/reconciliation-exceptions", authMiddleware, requireAdmin, handlers.exceptions);
  app.post("/api/webhooks/paystack", handlers.webhook);
  app.get("/api/public/payments/status/:token", handlers.publicStatus);
  app.get("/api/public/payments/status/:token/receipt", handlers.receipt);
  return handlers;
};
