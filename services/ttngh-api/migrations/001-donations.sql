-- Apply only to the dedicated TTNGH database after environment approval.
-- No migration is run automatically at API startup.
BEGIN;
CREATE SCHEMA IF NOT EXISTS ttngh_payments;
CREATE TABLE ttngh_payments.intents (
  reference text PRIMARY KEY CHECK (reference ~ '^ttngh-(test|live)-[a-f0-9]{32}$'),
  mode text NOT NULL CHECK (mode IN ('test','live')),
  submission_id uuid NOT NULL,
  fingerprint text NOT NULL CHECK (length(fingerprint) = 64),
  access_hash text NOT NULL CHECK (length(access_hash) = 64),
  amount_pesewas bigint NOT NULL CHECK (amount_pesewas BETWEEN 100 AND 9007199254740991),
  currency text NOT NULL DEFAULT 'GHS' CHECK (currency = 'GHS'),
  email text NOT NULL,
  consent_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'created' CHECK (state IN ('created','initialized','pending','paid','failed','abandoned')),
  checkout_url text,
  provider_id bigint,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mode, submission_id),
  UNIQUE (mode, provider_id),
  CHECK (state <> 'paid' OR (provider_id IS NOT NULL AND paid_at IS NOT NULL))
);
CREATE TABLE ttngh_payments.transitions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference text NOT NULL REFERENCES ttngh_payments.intents(reference),
  previous_state text,
  next_state text NOT NULL,
  source text NOT NULL CHECK (source IN ('initialize','verify','webhook','reconcile')),
  request_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ttngh_payments.receipts (
  reference text PRIMARY KEY REFERENCES ttngh_payments.intents(reference),
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','sending','sent','review')),
  attempts integer NOT NULL DEFAULT 0,
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
