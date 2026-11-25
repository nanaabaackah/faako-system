-- Reuse existing tenant-scoped templates and their independent revision history.
-- Do not rewrite existing general acknowledgement or staff invitation records.
ALTER TABLE twe.email_templates
  DROP CONSTRAINT email_templates_slug_check;
ALTER TABLE twe.email_templates
  ADD CONSTRAINT email_templates_slug_check
  CHECK (slug IN (
    'enquiry-acknowledgement', 'staff-invitation',
    'enquiry-service-readiness', 'enquiry-service-full-planning',
    'enquiry-service-premium', 'enquiry-service-group',
    'enquiry-package', 'enquiry-gift', 'enquiry-group', 'enquiry-celebration'
  ) OR slug ~ '^enquiry-package-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$');
