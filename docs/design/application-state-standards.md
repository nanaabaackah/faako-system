# Application state standards

Status: adopted for new work and incremental migration as of 2026-07-26.

These standards define behavior, copy, accessibility, and recovery for
application states. They complement
[`shared-ui-standards.md`](./shared-ui-standards.md) and do not require every
existing screen to change in one release.

## Principles

1. A state must describe what happened, what was affected, and what the user
   can do next.
2. Loading, empty, and error are mutually exclusive data states. An empty
   result is shown only after a successful request.
3. Never claim success before the authoritative operation succeeds. Queued,
   drafted, opened in another app, and submitted are different outcomes.
4. Preserve valid user input after recoverable failures.
5. Color, animation, and toast messages are supplementary; text and semantic
   roles carry meaning.
6. Permissions and session state are server-enforced. Client state controls
   presentation, not authorization.
7. Retry policy follows operation safety. Reads and idempotent operations may
   retry; unsafe mutations do not retry automatically.
8. State belongs at the smallest surface affected. Do not replace a whole page
   when only one panel failed.

## State precedence

When more than one condition exists, resolve or present them in this order:

1. session expired or authentication required;
2. permission denied;
3. destructive confirmation or unsaved-navigation decision;
4. blocking loading or load error;
5. offline, degraded, or warning banner;
6. valid empty result;
7. operation success or non-blocking information.

An offline indicator does not replace a permission error, and a stale cached
list must not hide a failed refresh. When cached content remains usable, label
it as potentially outdated.

## Behavior matrix

| State | Required behavior | Recovery/action | Accessibility and copy |
| --- | --- | --- | --- |
| Loading | Preserve layout where practical; expose the affected surface as busy; prevent duplicate submission; ignore or cancel stale requests | Allow cancellation only when supported; do not show retry until failure | Use `AnimatedLoadingState` or a loading notice; `aria-busy="true"`; name the item or action |
| Empty | Render only after a successful response; distinguish first use, no filtered results, and no records | Offer one relevant action such as create, clear filters, or change search | Use `EmptyState`; give the state a heading; do not call an error “empty” |
| Success | Confirm the exact completed outcome; clear dirty state only after authoritative success; update the visible data | Offer the logical next action where useful | Use a persistent inline notice for form/critical success and optional toast for supplementary acknowledgement; announce politely |
| Error | Keep entered data and usable content; show a safe explanation; log technical detail outside the UI | Provide retry only when safe, plus an alternate path where available | Use `role="alert"` for actionable failures; never expose stack traces, raw provider responses, secrets, or sensitive data |
| Warning | Keep the workflow usable unless proceeding is unsafe; explain the consequence | Provide a specific action or link when the warning can be resolved | Do not rely on yellow/color alone; avoid assertive live regions for low-urgency guidance |
| Permission denied | Stop the protected action; do not render confidential data; distinguish from signed-out state | Navigate to a safe page or request access; retry only after access changes | Use `SecurityState` with `forbidden`; say which capability is unavailable without revealing protected data |
| Session expired | Stop protected requests; clear invalid credentials through the auth owner; preserve non-sensitive drafts where policy permits | Sign in again and return to the intended safe route | Use `SecurityState` with `session-expired`; do not describe this as a permission problem |
| Offline | Do not claim a network mutation succeeded; keep local read-only/cached work available; queue only workflows explicitly designed for offline sync | Reconnect, use a safe alternate channel, or manually retry after reconnect | Use `useOnlineStatus` and the relevant offline notice; announce connectivity changes politely |
| Retry | Deduplicate attempts; reset stale error state; show progress; attach a request ID when supported | Reads may retry manually or with bounded backoff; mutations require idempotency or explicit user action | Label the target, such as “Retry customer list”; keep error copy until retry starts |
| Unsaved changes | Become dirty after a meaningful user change; remain dirty through failed saves; clear after save, reset, or deliberate discard | Warn on browser unload and in-app navigation where router support is proven; let the user stay or discard | Name the affected form; never use the browser warning as the only protection |
| Destructive confirmation | Require explicit activation; name the target and consequence; keep the dialog open on failure; disable duplicate confirmation | Cancel is always available unless the server mutation is already in flight; success updates the source view | Use a danger-labelled button such as “Archive customer”; do not bind container-level Enter to confirmation |

## Component mapping

| Need | Existing implementation |
| --- | --- |
| Page/panel loading and skeleton | `AnimatedLoadingState` |
| Non-table empty result | `EmptyState` |
| Contextual success/error/warning/info | `InlineNotice` |
| Page-level state | `NoticeBanner` |
| ERP contextual state | `ERPNotice` or `ERPFormNotice` |
| Session/permission states | `SecurityState` and `SecurityActionButton` |
| ERP destructive decision | `ERPConfirmDialog` |
| Transient supplementary acknowledgement | `useToast` through `UiSystemProvider` |
| Connectivity detection and offline queues | `@faako/offline-sync` |

The application owns request state, retry safety, permission decisions,
navigation, mutation side effects, and domain-specific copy. Shared components
own presentation and accessible semantics.

## Detailed rules

### Loading and concurrent work

- A submit control uses a stable action label plus a loading label and remains
  disabled until the request settles.
- A route or panel should show a loading state after a short delay when a flash
  would otherwise be distracting, but must expose `aria-busy` immediately.
- Use `AbortSignal` or request sequencing to prevent an older response from
  replacing newer data.
- Do not erase already loaded content during a background refresh. Mark the
  affected control or region as refreshing.

### Empty and filtered results

- First-use copy explains why the area is useful and offers creation when
  permitted.
- Filter-empty copy offers “Clear filters” or a search adjustment.
- Permission-filtered content uses a permission state, not an empty state.
- Failed loads remain errors even when the local collection is empty.

### Success and errors

- Payment, booking, invoice, access, and other consequential success remains
  visible in the workflow; a toast alone is insufficient.
- A validation error points to the relevant field. A form-level summary
  explains that highlighted fields need attention and focuses the first invalid
  field after submission.
- A server error retains form values and presents a safe retry or alternative.
- Include a request ID in support-facing copy only when the API provides one;
  do not invent it.

### Session and permission

- HTTP 401 maps to signed-out/session-expired behavior. HTTP 403 maps to
  permission denied.
- Reauthentication must not silently resubmit a mutation.
- Return-path handling must reject open redirects and restore only routes the
  user may access.
- Draft preservation must follow the data-classification policy; passwords,
  tokens, payment credentials, and other secrets are never persisted.

### Offline and retry

- Automatic retry is permitted for safe reads with bounded attempts, jitter,
  and cancellation.
- POST, payment, booking, inventory, and other unsafe mutations are never
  automatically retried unless the contract has an idempotency key and the
  workflow was reviewed.
- A queued operation says “queued” or “waiting to sync,” not “saved.”
- A failed queue item remains reviewable with retry, cancel, conflict, and
  resolution history where the domain requires it.

### Unsaved changes

- Compare canonical values, excluding server-derived defaults and honeypots.
- Install `beforeunload` only while dirty and remove it after save/reset.
- Add a router-level blocker only after testing the actual router mode.
- Modal close, Escape, route navigation, sign-out, and app update prompts must
  all respect dirty state.
- If a local draft is stored, define its expiry, scope it by application and
  actor where relevant, and clear it after successful submission.

### Destructive actions

- Confirmation is reserved for consequential or difficult-to-reverse changes.
  Do not add it to routine reversible actions.
- The body states what remains and what is removed.
- The safe action comes first in keyboard order. Initial focus should go to the
  safe action when dialog focus management is hardened.
- Escape may cancel before a request begins. Closing is blocked while the
  mutation is in flight if cancellation is not supported.
- The backend rechecks authentication, permission, record state, and conflicts.

## Pilot scope

This PR intentionally pilots one workflow in each major user-facing product:

| Application | Workflow | States piloted |
| --- | --- | --- |
| Faako Website | Contact email hand-off | information and accurate success wording |
| Faako ERP | Demo access-code request and verification | loading, success, and error |
| Dev ERP | Alert settings | loading, success/error, and session expired |
| REEBS Website | Contact/planning brief | unsaved draft, success, and error |
| REEBS Portal | Customer archive | destructive confirmation and pending state |
| Stroane Web | Contact enquiry | offline, error, success, and alternate channel |
| By Nana Portfolio | Contact enquiry | validation/error and unsaved-change protection |

`faako-api` has no UI workflow. System Starter and UI Workbench are reference
applications, not product pilots. TTNGH has no tracked source workspace, so its
pilot remains deferred until its scaffold is deliberately recreated.

## Verification expectations

Each adopted workflow should test:

- initial, loading, success, and failure transitions that apply;
- no empty state during loading or error;
- duplicate submission prevention;
- retained input after failure;
- live-region semantics and keyboard access;
- offline behavior where network writes exist;
- dirty-state installation and cleanup where used;
- destructive cancel, confirm, pending, failure, and success paths.
