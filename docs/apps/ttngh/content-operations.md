# TTNGH content operations

Updated 13 October 2026. Sanity Studio and the static publishing boundary are implemented locally. Accounts and content migration are not yet configured.

## Who controls what

Editors control structured content. Developers control templates, navigation, styles, security and schemas. No drag-and-drop page builder, private enquiry records, donor records or generally publishable testimonials are included.

The organisation must name a CMS administrator and backup administrator, editorial approver, mental-health/safeguarding reviewer, event owner and calendar owner. Do not invent names or grant all editors administrator access.

## Collections and publication gates

| Type | Website usage | Required publication checks |
| --- | --- | --- |
| siteSettings | Organisation/contact/social details, SEO defaults, approved registration details | Organisation name, summary, tagline, contact email and safe public URLs |
| homePage | Hero text, introduction, featured programmes/event/updates, impact, CTAs and partners | Headline/subtitle/introduction, safe CTA destinations |
| programme | /programmes and /programmes/[slug] | Audience, format, availability, owner, safeguarding approval, image/alt, summary/body, slug and SEO |
| event | /events, homepage calendar, /events/[slug], .ics | Owner, ordered dates, IANA timezone, format, public venue/joining information, registration state, accessibility, image/alt, SEO; capacity only with approval |
| newsArticle | /news and /news/[slug] | Author/date, title, summary/body, image/alt, slug and SEO |
| resource | /resources and /resources/[slug] | Author/owner/reviewer, approved review/date, linked sources, answer-first summary, urgent-support notice when relevant, slug and SEO |
| teamMember | /team | Approved biography, name/role, image/alt, publication consent; separately approved public links |
| impactStat | Homepage and /impact | Verified value/label, measurement period, source and responsible owner |
| partner | Homepage partner section | Name, logo/alt, safe link; approved context only |

Both Studio and the build validate content. Studio errors block normal publishing; the build rejects invalid published records even if a token/API bypassed Studio. Draft/version namespaces and publishState other than published are excluded. Duplicate slugs/singletons fail the build. SEO descriptions are 50–160 characters; titles max 120 and slugs max 96. Images must resolve to Sanity CDN assets with dimensions. Text is rendered escaped, not interpreted as CMS HTML.

## Initial migration

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
8. To withdraw, unpublish or change state away from published, trigger a rebuild, verify removal and handle any old cached copies. Escalate consent/safeguarding withdrawals promptly.

This static site does not provide draft-preview sessions or timed publication scheduling. Date fields describe the publication, not a scheduler. Use approved previews and deliberate publication.

## Events and Google Calendar

Sanity is the public source of truth. Upcoming and past groups, descriptive event pages, schema, registration links and calendar downloads work without JavaScript. The native month-switching control enhances that content. Current/past state is evaluated at build time: configure a daily rebuild.

Google Calendar is secondary and loads only after interaction. The calendar owner supplies an approved public calendar ID and ensures it contains no private appointments. Event-level Google links are outbound; .ics downloads are local. No OAuth or two-way sync is introduced. A future one-way CMS → Google Calendar integration requires a separate owner/credential/reconciliation plan.

## Editor accounts

Visit /cms or the approved Studio URL. Sign in with the same method used to accept the invitation. Account creation does not grant TTNGH access. For email/password accounts use Sanity's recovery flow; Google/GitHub accounts recover through that provider. Require MFA where available, keep a backup organisational administrator, revoke leavers and audit roles. See [Sanity account management](https://www.sanity.io/docs/platform-management/manage-your-account).

## Monthly review

Review resource dates, programme availability, event registrations, contact details, photo consent and impact sources. Check failed builds/webhooks and record approval evidence. No contact-message retention or case management belongs in the CMS.
