BEGIN;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS finance;

CREATE TABLE IF NOT EXISTS finance.currencies (
  code CHAR(3) PRIMARY KEY,
  name TEXT NOT NULL,
  minor_unit SMALLINT NOT NULL DEFAULT 2 CHECK (minor_unit BETWEEN 0 AND 4),
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO finance.currencies (code, name) VALUES
  ('GHS','Ghanaian Cedi'),('USD','US Dollar'),('EUR','Euro'),('GBP','Pound Sterling'),
  ('CAD','Canadian Dollar'),('AED','UAE Dirham'),('TRY','Turkish Lira'),('ZAR','South African Rand')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS finance.exchange_rates (
  id UUID PRIMARY KEY,
  base_currency CHAR(3) NOT NULL REFERENCES finance.currencies(code),
  quote_currency CHAR(3) NOT NULL REFERENCES finance.currencies(code),
  rate NUMERIC(24,12) NOT NULL CHECK (rate > 0),
  provider TEXT NOT NULL,
  provider_timestamp TIMESTAMPTZ NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (base_currency, quote_currency, provider, provider_timestamp)
);

CREATE TABLE IF NOT EXISTS crm.lead_stages (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  position INTEGER NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO crm.lead_stages (key,label,position) VALUES
 ('new','New',10),('contacted','Contacted',20),('consultation','Consultation',30),('planning','Planning',40),
 ('proposal_sent','Proposal Sent',50),('awaiting_payment','Awaiting Payment',60),('booked','Booked',70),
 ('travelling','Travelling',80),('completed','Completed',90),('lost','Lost',100)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS crm.leads (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL,
  stage_key TEXT NOT NULL REFERENCES crm.lead_stages(key),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_organisation_created_idx ON crm.leads (organisation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS crm.inquiries (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES crm.leads(id),
  source TEXT NOT NULL,
  destination TEXT NOT NULL,
  travellers INTEGER NOT NULL CHECK (travellers > 0),
  nights INTEGER NOT NULL CHECK (nights > 0),
  travel_date DATE NOT NULL,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  estimate_low_minor BIGINT,
  estimate_high_minor BIGINT,
  estimate_currency CHAR(3) REFERENCES finance.currencies(code),
  exchange_rate_id UUID REFERENCES finance.exchange_rates(id),
  consent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS inquiries_organisation_lead_idx ON crm.inquiries (organisation_id, lead_id);
COMMIT;
