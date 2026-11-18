-- Apply to the existing dedicated TTNGH PostgreSQL database after backup/review.
-- Enquiry data is private: do not expose this schema through Sanity or public SQL endpoints.
BEGIN;
CREATE SCHEMA IF NOT EXISTS ttngh_contact;
CREATE TABLE ttngh_contact.enquiries (
  id uuid PRIMARY KEY,
  fingerprint char(64) NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  email text NOT NULL CHECK (char_length(email) <= 160),
  topic text NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 80),
  message text NOT NULL CHECK (char_length(message) BETWEEN 20 AND 2000),
  consent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ttngh_contact.notification_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enquiry_id uuid NOT NULL REFERENCES ttngh_contact.enquiries(id) ON DELETE CASCADE,
  recipient_kind text NOT NULL CHECK (recipient_kind IN ('staff','visitor')),
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','sending','sent','review')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  first_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  provider_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enquiry_id,recipient_kind),
  CHECK (state <> 'sent' OR sent_at IS NOT NULL)
);
CREATE INDEX ttngh_contact_outbox_due ON ttngh_contact.notification_outbox (next_attempt_at,id)
  WHERE state IN ('queued','sending');
COMMIT;
