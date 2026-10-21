# TTNGH content operations

Updated 18 October 2026. Studio and published-content reads are live. The production
dataset is PUBLIC; team/event publication filters returned zero records in the
[audit](production-status-2026-10-18.md). Editor access, migration completeness and
publish/withdrawal rebuilds are not yet verified.

## Who controls what

Editors control structured content. Developers control templates, navigation, styles, security and schemas. No drag-and-drop page builder, private enquiry records, donor records or generally publishable testimonials are included.

The organisation must name a CMS administrator and backup administrator, editorial approver, mental-health/safeguarding reviewer, event owner and calendar owner. Do not invent names or grant all editors administrator access.

## Collections and publication gates

| Type | Website usage | Required publication checks |
| --- | --- | --- |
| siteSettings | Organisation/contact/social details, SEO defaults, approved registration details | Organisation name, summary, tagline, contact email and safe public URLs |
| homePage | Hero text, introduction, featured programmes/event/updates, impact, CTAs and partners | Headline/subtitle/introduction, safe CTA destinations |
| programme | /programmes and /programmes/[slug] | Audience, format, availability, owner, safeguarding approval, image/alt, summary/body, slug and SEO |
| event | /events listings, homepage feature, /events/[slug], .ics | Owner, ordered dates, IANA timezone, format, public venue/joining information, registration state, accessibility, image/alt, SEO; capacity only with approval |
| newsArticle | /news and /news/[slug] | Author/date, title, summary/body, image/alt, slug and SEO |
| resource | /resources and /resources/[slug] | Author/owner/reviewer, approved review/date, linked sources, answer-first summary, urgent-support notice when relevant, slug and SEO |
| teamMember | /team | Approved biography, name/role, image/alt, publication consent; separately approved public links |
| impactStat | Homepage and /impact | Verified value/label, measurement period, source and responsible owner |
| partner | Homepage partner section | Name, logo/alt, safe link; approved context only |

Both Studio and the build validate content. Studio errors block normal publishing; the build rejects invalid published records even if a token/API bypassed Studio. Draft/version namespaces and publishState other than published are excluded. Duplicate slugs/singletons fail the build. SEO descriptions are 50–160 characters; titles max 120 and slugs max 96. Images must resolve to Sanity CDN assets with dimensions. Text is rendered escaped, not interpreted as CMS HTML.

## Initial migration

### Team draft preparation — 19 October 2026

At the user's request, seven missing team profiles were created as Sanity drafts:
Emefa Adonu, Frances Acquaye, Basilila Nanbigne Adu-Wusu, Maame Ebe Ackah,
Marian Roberts, Ruby Adeley and Vivienne Aklasi. Dzifa Tay Ansah already had a
record and was left untouched. Names, roles and portrait mappings came from
`apps/ttngh/src/content/team.js` and the documented approved image inventory.
Portrait copies were uploaded to Sanity; originals were unchanged.

All seven records were read back with `drafts.` IDs, `publishState: draft` and
image references. No profiles were published. Approved biographies were not in
the repository source, so biography fields were deliberately left blank rather
than invented. Profile consent remains pending editorial confirmation; this does
not revoke the previously confirmed photography-library permission.

To complete them in Studio: open Team Member, verify names/roles/portraits, supply
approved biographies, confirm profile publication consent, set publishState to
published and publish only after approval. Verify the resulting rebuild and team
page on mobile/desktop. Draft preparation is not an end-to-end publishing test.

Follow-up on 19 October: the user approved concise role-based biography copy.
That copy was saved to all seven existing drafts and read back successfully.
These are role descriptions, not independently verified credentials or career
histories. Dzifa's existing record and all consent/publication states were left
unchanged. Biographies are no longer blank; profile consent confirmation and
publication review remain outstanding. Nothing was published by this update.

Populate approved content from the company profile/proposal and the consent-confirmed Drive library. Preserve source/photo context, never infer diagnoses, participation as a counselling client, names or dates. Use the [image inventory](phase-1-image-inventory.md). Optimised local photography remains available; the Drive originals are unchanged.

Create siteSettings and homePage singletons. Populate and approve programme, team, partner and verified impact entries before switching on CMS mode. An empty live collection is intentionally empty; deleted/withdrawn records must not silently return from local fallbacks. Static mission/vision/history and editorial programme-pillar templates remain developer-managed company-profile content.

## Publishing workflow

1. Create a draft and record its responsible owner and approved source.
2. Check facts, links, dates, alt text, image rights/context, accessibility and review metadata.
3. For resources, obtain the named reviewer's approval; do not fabricate an urgent-support contact.
4. Set publishState to published and publish in Studio. Publishing a draft-state document does not make it public.
5. The signed webhook requests an Astro rebuild. Check build completion and the preview output, not just webhook acceptance.
6. Review mobile/desktop and links before approving production. Keep preview noindex.
7. Preserve the slug after launch. A changed public URL needs a developer-reviewed tested redirect.
8. To withdraw public access, unpublish the record where required, trigger a rebuild, verify website and public API removal and handle assets/cached copies. Changing publishState alone hides website output but does not make a published public-dataset record private. Escalate consent/safeguarding withdrawals promptly. Never store private consent evidence, enquiries or health details in published records.

This static site does not provide draft-preview sessions or timed publication scheduling. Date fields describe the publication, not a scheduler. Use approved previews and deliberate publication.

## Events and Google Calendar

Sanity remains the editorial source for upcoming/past listings, full event pages, schema, registration, accessibility and local calendar downloads. These work without JavaScript. Current/past listing state is evaluated at build time: retain the scheduled rebuild. Google Calendar drives the separate live month grid and selected-day agenda.

The calendar owner maintains an events-only public Google Calendar with approved titles and locations, never private appointments or counselling details. Railway retrieves and caches its ICS feed; the browser sees only TTNGH’s UI. Scheduling updates need no website rebuild. Explicit Google add links and local .ics downloads remain. No OAuth, title matching or synchronisation is introduced. Future editorial enrichment must use an explicit UID link. See [calendar architecture and setup](calendar-data-source.md).

## Editor accounts

Visit /cms or the approved Studio URL. Sign in with the same method used to accept the invitation. Account creation does not grant TTNGH access. For email/password accounts use Sanity's recovery flow; Google/GitHub accounts recover through that provider. Require MFA where available, keep a backup organisational administrator, revoke leavers and audit roles. See [Sanity account management](https://www.sanity.io/docs/platform-management/manage-your-account).

## Monthly review

Review resource dates, programme availability, event registrations, contact details, photo consent and impact sources. Check failed builds/webhooks and record approval evidence. No contact-message retention or case management belongs in the CMS.
