# Travel With Ease editing guide

This describes the current workspace, not features still under construction.

For section photographs, responsive crops, shared footer/CTA imagery, ordered
galleries, Workspace Activity and navigation, see the
[CMS extension guide](./cms-access-imagery-activity-2026-11-04.md).
Superadmin changes Owner/Editor roles with an approval reference; Owners manage
Editors. At least one active Owner must remain. No portal control assigns
Superadmin.

1. Open your staff portal and sign in with the Google account invited to the
   workspace. Complete Cloudflare verification/MFA and account activation.
2. Open Website Content and choose the page or collection to edit.
3. Update text, choose approved library images and check alternative text.
4. Drafts autosave after you pause typing. Wait for Saved before leaving. Save
   Draft is also available. If saving fails, your input remains: use Save Draft
   to check/retry safely. On a conflict, copy your work before reloading; never
   overwrite another editor's changes blindly. Autosave never publishes.
5. Preview saved content builds the actual website layout privately. Choose
   desktop/tablet/mobile; on smaller screens switch Editor/Website preview.
   Previews expire after ten minutes and are read-only; enquiry submission and
   analytics do not run there. Rebuild a preview after changing a draft.
6. Owner and Superadmin can publish. Choose one record or explicitly the whole
   collection. Wait through Pending/Building/Deploying/Verifying until Live.
   Initial hosted worker/baseline acceptance is still pending; local code checks
   do not prove your website has changed. Keep a request reference on failure.

## Packages, Journal and Tips

Choose Packages to edit a package, tiers, reference month, disclaimer, itinerary
and images. Prices in the editor are GHS, per person sharing. Use Price coming
soon where pricing has not been supplied. Do not publish hotel names, star
ratings, payment numbers or invented prices.

Journal contains the story fields, category, author, series and approved images.
For the Journal listing, choose **Featured lead story** for one article in Website
Content → Journal; the site shows that article alongside three recent supporting
stories. Otherwise the latest published Trip Story is featured. The **All stories**
grid always includes every published article and uses the existing Category,
Series and Search filters. The section headings, introductory text and browse
link are editable under Journal editorial fields. The article detail page uses
the same underlying content.

Tips contain category, feature/order settings and optional related Journal links.
Use Publication scope to publish/unpublish one saved record without including
other drafts. Whole collection intentionally includes all saved records. Load
approved copy starts from the supplied company document, not invented samples;
select managed images separately. Revision restoration creates a draft, not a
publication. Actual hosted acceptance is tracked in the
[CMS runtime guide](./cms-runtime-2026-11-03.md).

## Brand, fonts and assets

The **Media** navigation item is the central asset library. Staff with media
permissions can upload JPG, PNG or WebP images (maximum 8 MiB), import supported
images from the approved Google Drive folder, preview, replace and archive them.
A replacement is a new revision; existing published content is not overwritten.
Images are held privately until a permitted editor selects them and publishes a
saved content revision.

In Website Content → **Brand & appearance**, select from the curated heading
and body fonts or assign uploaded images to the header wordmark, scrolled logo,
footer logo, favicon and default social preview. The approved defaults remain
Poiret One for headings, Quicksand for body, and the existing TWE logos. The same
section contains the shared image-placement controls for the footer background
and device mockups. Other page and article images remain editable on their
respective CMS sections.

Only licensed, preapproved font families are selectable; uploading arbitrary
font, SVG, executable or document files is intentionally not supported by the
image-only asset pipeline. Brand edits are drafts until previewed and published,
like other content. Changing a logo or font does not bypass the verified
Cloudflare deployment process.

## Travel footprint

Countries explored uses the supplied countries and visit wording. Keep About,
Exact and + counts accurate; leave unknown counts blank. Source is retained for
internal accuracy, not displayed as a combined-business/founder heading. Verified
agency trip totals remain separate data; do not add personal visits into them.

## Enquiries and access

Authorised staff can open enquiries and update their status. Website enquiry
confirmation is not a booking confirmation. Do not copy personal details into
public articles or analytics. Inbox lists show only the traveller name and an
operational summary; email, phone and questionnaire details load only after an
authorised staff member opens the individual enquiry.

Use Account to manage available personal preferences and Tutorial Mode. Ask your
Owner about staff access; application roles do not grant Cloudflare, Railway,
database credentials or access to another Faako client.

If a save or publication fails, keep your text and the displayed request reference
and contact support. Never share passwords, session cookies, tokens or database URLs.
