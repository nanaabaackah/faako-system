-- Payments foundation. This is additive and deliberately does not rewrite
-- historical Core order payments or Water sale payment snapshots.
CREATE TABLE "paymentAttempt" (
  "id" SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL,
  "customerId" INTEGER,
  "reference" TEXT NOT NULL,
  "businessUnit" TEXT NOT NULL,
  "payableType" TEXT NOT NULL,
  "payableId" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerReference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "authorizationUrl" TEXT,
  "accessCode" TEXT,
  "expiresAt" TIMESTAMPTZ,
  "lastVerifiedAt" TIMESTAMPTZ,
  "paidAt" TIMESTAMPTZ,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "paymentAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "paymentAttempt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "paymentAttempt_amount_check" CHECK ("amountCents" > 0),
  CONSTRAINT "paymentAttempt_business_unit_check" CHECK ("businessUnit" IN ('REEBS_CORE', 'WATER')),
  CONSTRAINT "paymentAttempt_payable_type_check" CHECK ("payableType" IN ('BOOKING', 'ORDER', 'INVOICE', 'WATER_ORDER')),
  CONSTRAINT "paymentAttempt_status_check" CHECK ("status" IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED')),
  CONSTRAINT "paymentAttempt_verification_check" CHECK ("verificationStatus" IN ('UNVERIFIED', 'VERIFIED', 'MISMATCH', 'FAILED'))
);

CREATE UNIQUE INDEX "paymentAttempt_organizationId_reference_key" ON "paymentAttempt"("organizationId", "reference");
CREATE UNIQUE INDEX "paymentAttempt_organizationId_idempotencyKey_key" ON "paymentAttempt"("organizationId", "idempotencyKey");
CREATE UNIQUE INDEX "paymentAttempt_organization_providerReference_key" ON "paymentAttempt"("organizationId", "provider", LOWER("providerReference")) WHERE "providerReference" IS NOT NULL;
CREATE INDEX "paymentAttempt_organizationId_payableType_payableId_idx" ON "paymentAttempt"("organizationId", "payableType", "payableId");
CREATE INDEX "paymentAttempt_organizationId_status_createdAt_idx" ON "paymentAttempt"("organizationId", "status", "createdAt");
CREATE UNIQUE INDEX "paymentAttempt_one_pending_payable_key"
  ON "paymentAttempt"("organizationId", "payableType", "payableId")
  WHERE status = 'PENDING';

CREATE TABLE "paymentRecord" (
  "id" SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL,
  "customerId" INTEGER,
  "attemptId" INTEGER,
  "reference" TEXT NOT NULL,
  "businessUnit" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "provider" TEXT,
  "providerReference" TEXT,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PAID',
  "verificationStatus" TEXT NOT NULL,
  "paidAt" TIMESTAMPTZ NOT NULL,
  "recordedByUserId" INTEGER,
  "notes" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "paymentRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "paymentRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "paymentRecord_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "paymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "paymentRecord_amount_check" CHECK ("amountCents" > 0),
  CONSTRAINT "paymentRecord_business_unit_check" CHECK ("businessUnit" IN ('REEBS_CORE', 'WATER')),
  CONSTRAINT "paymentRecord_status_check" CHECK ("status" = 'PAID'),
  CONSTRAINT "paymentRecord_verification_check" CHECK ("verificationStatus" IN ('VERIFIED', 'MANUAL'))
);

CREATE UNIQUE INDEX "paymentRecord_attemptId_key" ON "paymentRecord"("attemptId");
CREATE UNIQUE INDEX "paymentRecord_organizationId_reference_key" ON "paymentRecord"("organizationId", "reference");
CREATE UNIQUE INDEX "paymentRecord_organizationId_idempotencyKey_key" ON "paymentRecord"("organizationId", "idempotencyKey");
CREATE UNIQUE INDEX "paymentRecord_organization_providerReference_key" ON "paymentRecord"("organizationId", "provider", LOWER("providerReference")) WHERE "providerReference" IS NOT NULL AND "status" = 'PAID';
CREATE INDEX "paymentRecord_organizationId_customerId_paidAt_idx" ON "paymentRecord"("organizationId", "customerId", "paidAt");
CREATE INDEX "paymentRecord_organizationId_businessUnit_paidAt_idx" ON "paymentRecord"("organizationId", "businessUnit", "paidAt");

CREATE TABLE "paymentApplication" (
  "id" SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL,
  "customerId" INTEGER,
  "paymentId" INTEGER NOT NULL,
  "orderPaymentId" INTEGER,
  "businessUnit" TEXT NOT NULL,
  "payableType" TEXT NOT NULL,
  "payableId" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'APPLIED',
  "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "paymentApplication_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "paymentApplication_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "paymentApplication_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "paymentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "paymentApplication_orderPaymentId_fkey" FOREIGN KEY ("orderPaymentId") REFERENCES "orderPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "paymentApplication_amount_check" CHECK ("amountCents" > 0),
  CONSTRAINT "paymentApplication_business_unit_check" CHECK ("businessUnit" IN ('REEBS_CORE', 'WATER')),
  CONSTRAINT "paymentApplication_payable_type_check" CHECK ("payableType" IN ('BOOKING', 'ORDER', 'INVOICE', 'WATER_ORDER')),
  CONSTRAINT "paymentApplication_status_check" CHECK ("status" IN ('APPLIED', 'REVERSED'))
);

CREATE UNIQUE INDEX "paymentApplication_orderPaymentId_key" ON "paymentApplication"("orderPaymentId");
CREATE UNIQUE INDEX "paymentApplication_payment_payable_key" ON "paymentApplication"("organizationId", "paymentId", "payableType", "payableId");
CREATE INDEX "paymentApplication_organizationId_payable_idx" ON "paymentApplication"("organizationId", "payableType", "payableId", "status");
CREATE INDEX "paymentApplication_organizationId_customerId_appliedAt_idx" ON "paymentApplication"("organizationId", "customerId", "appliedAt");

CREATE TABLE "paymentProviderEvent" (
  "id" SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL,
  "attemptId" INTEGER,
  "provider" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "providerReference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMPTZ,
  "errorCode" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "paymentProviderEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "paymentProviderEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "paymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "paymentProviderEvent_status_check" CHECK ("status" IN ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED'))
);

CREATE UNIQUE INDEX "paymentProviderEvent_provider_fingerprint_key" ON "paymentProviderEvent"("provider", "fingerprint");
CREATE INDEX "paymentProviderEvent_organizationId_providerReference_idx" ON "paymentProviderEvent"("organizationId", "providerReference");
CREATE INDEX "paymentProviderEvent_organizationId_status_receivedAt_idx" ON "paymentProviderEvent"("organizationId", "status", "receivedAt");

-- Match the tenant isolation policy used by the existing financial tables.
ALTER TABLE "paymentAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "paymentAttempt" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "paymentAttempt"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_organization_id', true)::integer)
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true)::integer);

ALTER TABLE "paymentRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "paymentRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "paymentRecord"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_organization_id', true)::integer)
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true)::integer);

ALTER TABLE "paymentApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "paymentApplication" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "paymentApplication"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_organization_id', true)::integer)
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true)::integer);

ALTER TABLE "paymentProviderEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "paymentProviderEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "paymentProviderEvent"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_organization_id', true)::integer)
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true)::integer);
