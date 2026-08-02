# Form experience standards

Status: adopted for new forms and incremental migration as of 2026-07-26.

This document defines a consistent form lifecycle across public sites, portals,
and ERP applications. Validation rules remain in `@faako/validation` or the
owning domain; presentation follows
[`shared-ui-standards.md`](./shared-ui-standards.md), and state behavior follows
[`application-state-standards.md`](./application-state-standards.md).

## Standard lifecycle

```text
initial → editing → validating → submitting → success
                         ↘ field/form error → editing
                               submitting → server error → editing/retry
                               submitting → session/permission/offline state
```

Only one submit request may be active for a form. A failed request returns to
an editable state with values intact. A successful request clears dirty state
and either resets the form or shows a clear next step.

## Form structure

- Use a real `<form>` and native submit behavior.
- Every control has a persistent visible label. Placeholder text is an example,
  not a label.
- Group related controls with `fieldset` and `legend` where appropriate.
- Required status appears in text or with a symbol that has a screen-reader
  equivalent.
- Instructions precede the fields they govern.
- Keep the primary action close to the final field and reachable without
  horizontal scrolling on mobile.
- Use the existing `TextField`, `TextareaField`, `SelectField`, date/time
  fields, or reviewed ERP equivalents before creating local primitives.

## Input behavior

- Use the correct input type, `inputMode`, and `autoComplete` token.
- Apply sensible length limits in the client and server.
- Do not prevent paste into ordinary identity, contact, or password fields.
- Normalize values only when semantics are unchanged: trim boundary
  whitespace, normalize email case, and preserve meaningful punctuation.
- Do not silently rewrite phone numbers, names, identifiers, or monetary
  values into a different meaning.
- Disabled controls communicate why they are unavailable. Use read-only when a
  value must still be submitted or copied.

## Validation

### Timing

- Validate on submit for untouched fields.
- After a failed submit, clear or recompute a field error as that field changes.
- Use blur validation only when it genuinely helps and does not interrupt
  typing.
- Debounced server validation must cancel or ignore stale responses.

### Error placement

- Put the field error immediately after the control.
- Set `aria-invalid="true"` only while invalid.
- Connect hint and error IDs with `aria-describedby`.
- On failed submission, show a concise form summary and focus the first invalid
  control after the DOM updates.
- Server validation errors map to fields when the response identifies them;
  otherwise use a form-level error.
- Never replace a specific server validation message with a generic network
  error when the message is safe for users.

### Schema ownership

- Reuse schemas from `@faako/validation` for shared inputs.
- Infer types from the schema instead of separately maintaining a conflicting
  form interface.
- Browser and server validation use the same accepted-input contract where
  possible, but the server is authoritative.
- Server-only fields, role decisions, prices, ownership, and audit data never
  come from editable public form inputs.

## Submission

- Set the form region to `aria-busy="true"` while submitting.
- Disable the submit action against duplicate requests and show a verb-based
  loading label such as “Sending…” or “Saving…”.
- Keep other controls usable unless changing them would invalidate the active
  operation.
- Support `AbortSignal` for cancellable requests.
- Do not automatically retry unsafe mutations.
- For idempotent mutations, generate and preserve the idempotency key across a
  deliberate retry.
- Distinguish “draft saved,” “queued,” “email app opened,” “request received,”
  and “completed.”

## Success

- State what completed and what happens next.
- Clear errors and dirty state after authoritative success.
- Reset fields only when retaining them would confuse the next action.
- Move focus to a success heading when the form is replaced by a confirmation.
- Keep consequential references such as request, booking, invoice, or receipt
  IDs visible and copyable.
- A toast may supplement but does not replace a critical inline confirmation.

## Failure and retry

- Preserve all non-sensitive values.
- Explain whether the submission reached the service when known.
- Provide a manual retry for a safe operation or an alternate channel such as
  phone/email.
- Keep the retry label specific and prevent parallel retries.
- On 401, use session-expired behavior and never silently resubmit after login.
- On 403, show permission denied and do not encourage repeated retry.
- On rate limiting, show when retry is allowed if the server supplies it.
- Include a request ID for support only when returned by the API.

## Offline forms

- Detect connectivity with `useOnlineStatus` where the app already depends on
  `@faako/offline-sync`.
- Disable network submission while offline and explain the recovery path.
- Preserve the entered values.
- Queue only workflows designed for offline operation, with idempotency,
  conflict handling, actor/organisation scope, expiry, and audit behavior.
- An offline queue acknowledgement says “queued for sync,” not “submitted.”

## Unsaved changes and drafts

- Dirty means a meaningful value differs from its canonical initial or last
  saved value. Ignore honeypots and untouched prefill values.
- Install `beforeunload` only while dirty; remove it after save, reset, or
  unmount.
- Add router-specific navigation blocking after confirming that it works with
  the app's router mode.
- Closing a modal or drawer containing a dirty form requires the same
  stay/discard decision.
- Local drafts require an expiry and must be cleared after successful
  submission.
- Never store passwords, access codes, tokens, payment credentials, or
  high-risk personal data as drafts.

## Destructive form actions

- Keep destructive actions visually and spatially distinct from Save.
- Open a reviewed confirmation dialog that names the record and consequence.
- Use a precise action label, for example “Archive customer.”
- Do not use `window.confirm` in adopted workflows.
- Do not make unmodified Enter at the dialog container confirm destruction.
- Disable repeat activation while pending and keep the dialog open if the
  request fails so the error and recovery remain understandable.

## Mobile and accessibility

- Target a minimum 44 by 44 CSS-pixel touch area for primary controls.
- Use a single-column layout at narrow widths unless two fields are genuinely
  easier together.
- Do not trigger unexpected zoom with undersized input text.
- Ensure the focused field remains visible above the software keyboard.
- Preserve logical DOM, reading, and tab order.
- Error and success meaning does not depend on icons or color.
- Respect reduced-motion preferences.
- Test keyboard-only completion, screen-reader names/descriptions, 200% zoom,
  and common mobile viewport widths.

## Privacy and security

- Collect only data needed for the stated purpose.
- Link the relevant privacy notice near public submissions.
- Never log form bodies containing secrets or sensitive personal information.
- Protect public forms with server-side validation, rate limits, abuse
  controls, size limits, and safe error responses.
- Honeypots are supplementary and are never the only abuse protection.
- Escape rendered values and reject client-supplied authorization or ownership
  fields.

## Pilot adoption

The first incremental adoption is deliberately narrow:

| Application | Pilot form/workflow | Adoption |
| --- | --- | --- |
| Faako Website | Contact form | Accurately labels the mail-app hand-off and does not claim the email was sent |
| Faako ERP | Demo access form | Shared accessible success/error notices and busy form state |
| Dev ERP | Alert settings | Shared save/error feedback and a distinct session-expired action |
| REEBS Website | Planning brief | Expiring draft, dirty unload warning, retained errors, and shared feedback |
| REEBS Portal | Customer archive | Explicit shared destructive confirmation and pending protection |
| Stroane Web | Contact enquiry | Offline blocking, retained input, and direct-email fallback |
| By Nana Portfolio | Contact form | Shared error notice, first-invalid focus, and dirty unload warning |

Future PRs should adopt one bounded workflow at a time, add tests, and avoid
mass search-and-replace. TTNGH adopts these standards when its source scaffold
is recreated.

## Definition of done for a migrated form

- Labels, hints, required status, and field errors are programmatically
  associated.
- The first invalid control is focused after submit.
- Duplicate submission is blocked.
- Loading, success, error, permission/session, and offline paths relevant to
  the workflow have deterministic behavior.
- Values survive recoverable failures.
- Success wording matches the authoritative outcome.
- Dirty state is cleared only after success/reset.
- Unsafe retries are not automatic.
- Destructive actions require an explicit, specific confirmation.
- Keyboard, mobile, reduced-motion, and automated accessibility checks pass.
- Analytics records outcome categories without capturing sensitive field data.
