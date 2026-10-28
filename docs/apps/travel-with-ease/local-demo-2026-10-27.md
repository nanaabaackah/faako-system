# Local staff workspace demo

## Dashboard and website design update

The Overview now provides recent-enquiry counts, draft counts, publication status,
an enquiry queue and permission-aware workspace actions. Counts describe the loaded
list, not unbounded business totals. No revenue or booking figures are fabricated.

The local website demo is `http://127.0.0.1:4328/demo`, linked from the dashboard.
It uses the TWE navy/cream/gold palette and approved supplied photography, with
sample journeys, journal, process and a no-send enquiry preview. Analytics are
disabled on this demo; production builds redirect its route to the homepage.
This is a companion design demo, not a live CMS connection: portal draft edits
remain in memory and do not update the website. No dependencies were added.

### Portal component and mobile follow-up

### Visual refinement follow-up

Action buttons compose the existing Faako Button with explicit decorative icons;
desktop retains icon and text, while mobile preserves text and touch targets.
The portal uses lighter neutral surfaces, modest 7–8px corners, clearer action
hierarchy and quieter list dividers without gradients or decorative shadows.
The website demo now hydrates only its interactive enquiry form as a React island,
using Faako SelectField and Button. Public editorial content remains Astro HTML.
The form still collects no personal information, makes no request and persists
nothing. It is not connected to portal drafts or the real enquiry pipeline.
No new dependencies or authentication changes were introduced.
The latest Chrome verification request was declined; this refinement still needs
visual acceptance, despite the earlier iteration's completed browser checks.

Overview now uses Faako KpiCard; enquiry filters and content selectors use
SelectField; staff provisioning uses TextField, Button and StatusPill. The shared
ErpMobileBottomNavFrame hosts labelled navigation icons, with a gold Overview
action, safe-area padding and permission-filtered destinations. The approved TWE
logo is imported from the existing website asset rather than recreated.
There are no editable date fields in these current portal workflows; future date
inputs should use the shared DateField instead of adding a separate date library.
Enquiry counters describe only the currently loaded filtered page. No synthetic
revenue, conversion or lifetime totals are presented as real metrics.

Chrome checks covered 390px mobile Overview, Enquiries and Staff access without
horizontal overflow. Portal build, lint, typecheck and five unit tests passed;
Astro typecheck passed with one existing inline-script hint. Changes are local,
not deployed. Authentication, tenant enforcement and role boundaries are unchanged.

Run `pnpm run dev:twe`, then open
`http://127.0.0.1:5188/?demo=1`. The portal root also offers an explicit demo link.

This is a browser-only Owner fixture, not authentication. It is enabled only by
the development server on loopback with an explicit query opt-in. Production
builds remove the demo adapter and entry UI, even when the URL contains demo=1.
There are no database connections, staff tokens, hosted calls or persistent storage.

Available: synthetic enquiry list/filter/detail/status, page draft editing and
saved-draft preview. Changes reset on reload. Media and staff screens can be
inspected, but uploads, real provisioning, publication and revision restoration
are intentionally unsupported and never report success.

Use staging for Google/Cloudflare Access, MFA, permissions, actual persistence,
uploads and publication acceptance. Do not put real client data into the demo.

The API preview launcher ignores .env/.env.development and hosted credentials.
It binds to loopback and does not authenticate staff. This is intentional.

The updated portal source has been copied into the main working folder without
switching branches or touching unrelated edits. The combined-hosting/backend
implementation remains on feat/twe-staff-mvp in the isolated worktree pending
review and staging deployment.
