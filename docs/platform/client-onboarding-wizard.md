# Client Onboarding Intake Wizard

## Purpose

The Faako public signup path now acts as a client onboarding intake wizard. It collects business setup details for planning, produces a PDF summary, and emails copies to the client/contact email and the Faako admin inbox.

## Wizard Sections

- Company Details
- Primary Contact
- Business Operations
- Required Apps / Modules
- Payment Preferences
- Communication Preferences
- Domain & Email Details
- Admin Users
- Security & Compliance
- Review & Submit

## Sensitive Fields Intentionally Excluded

The intake must not collect Paystack secret keys, Resend API keys, WhatsApp/SMS tokens, private email passwords, bank login details, private keys, or other integration credentials. The backend rejects credential-like keys or pasted secret-looking values before persistence or email sending.

## PDF Summary

The `signup` Netlify Function generates a lightweight PDF attachment server-side from sanitized intake sections. The PDF includes Faako branding, submission date/reference, the submitted business sections, a setup checklist, and a security note. It intentionally excludes integration secrets and internal-only credentials.

## Email Copy Behavior

Email sending remains server-side through Resend. The same PDF summary is attached to:

- the client/contact email
- the configured Faako/admin onboarding email

Non-production forwarding still honors `EMAIL_FORCE_TO` and existing preview/staging forwarding behavior.

## Submission Reliability Notes

The website submits onboarding data as `application/x-www-form-urlencoded` to avoid unnecessary local cross-port CORS preflight failures while testing the Netlify Function. The backend parses structured `intake` and `setupChecklist` fields from JSON strings before validation, PDF generation, persistence, and email sending.

The wizard also stores a local browser draft so a refresh before submission does not clear entered onboarding details. Draft data is cleared after a successful submission.

## Environment Variables

- `RESEND_API_KEY`
- `FAAKO_ONBOARDING_FROM_NAME` or `RESEND_FROM_NAME`
- `FAAKO_ONBOARDING_FROM_EMAIL` or `RESEND_FROM_EMAIL`
- `FAAKO_ONBOARDING_ADMIN_EMAIL` or `INTAKE_ADMIN_EMAIL` / `ADMIN_EMAIL`
- `EMAIL_FORCE_TO` for non-production forwarding
- `RATE_LIMIT_SECRET`
- `DATABASE_URL_DEVELOPMENT`, `DATABASE_URL_LOCAL`, or `DATABASE_URL_PRODUCTION`

## Data And Privacy Notes

The intake uses the existing `SignupRequest`, `Organization`, `User`, and `Membership` compatibility path. No database schema change is required for this phase. The structured response is stored as a human-readable summary in `SignupRequest.additionalNotes` so older database deployments remain compatible.

## Next Recommended Step

Add an internal setup checklist/admin review surface that can read these intake summaries without automating Paystack, Resend, WhatsApp Business, SMS, domain, hosting, or user provisioning.
