-- Preserve all intake drafts and versions while allowing a second form.
ALTER TABLE twe.enquiry_form_drafts DROP CONSTRAINT enquiry_form_drafts_form_id_check;
ALTER TABLE twe.enquiry_form_drafts ADD CONSTRAINT enquiry_form_drafts_form_id_check
  CHECK (form_id IN ('twe-initial-enquiry', 'twe-detailed-questionnaire'));
