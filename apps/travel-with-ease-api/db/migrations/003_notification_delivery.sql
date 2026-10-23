ALTER TABLE twe.notification_outbox
  ADD COLUMN lease_token UUID,
  ADD COLUMN first_attempt_at TIMESTAMPTZ,
  ADD COLUMN provider_id TEXT,
  ADD COLUMN last_error TEXT,
  ADD COLUMN delivery_payload JSONB CHECK (delivery_payload IS NULL OR jsonb_typeof(delivery_payload) = 'object');
