UPDATE twe.notification_outbox
SET delivery_payload = NULL
WHERE status IN ('sent', 'failed')
  AND delivery_payload IS NOT NULL;

CREATE FUNCTION twe.clear_terminal_notification_payload()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('sent', 'failed') THEN
    NEW.delivery_payload := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notification_outbox_clear_terminal_payload
BEFORE INSERT OR UPDATE OF status, delivery_payload
ON twe.notification_outbox
FOR EACH ROW
EXECUTE FUNCTION twe.clear_terminal_notification_payload();

ALTER TABLE twe.notification_outbox
  ADD CONSTRAINT notification_outbox_terminal_payload_cleared
  CHECK (status IN ('pending', 'processing') OR delivery_payload IS NULL);
