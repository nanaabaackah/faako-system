# Search discovery foundation implementation note

Date: 2026-10-18

Implemented:

- audited public, private and foundation web surfaces;
- added the framework-neutral `@faako/discovery` package and unit coverage;
- integrated shared URL and JSON-LD safety into the Astro public sites and Stroane route finalizer;
- reused exact FAQ/breadcrumb and robots builders in TTNGH;
- made Travel With Ease fail closed until a real origin and explicit indexability approval exist;
- removed accidental REEBS Portal public indexing metadata and sitemap;
- added layered noindex controls to active operational Vite applications;
- documented classification, geography and agent-security decisions.
- added conditional Search Console HTML verification to every public surface;
- confirmed existing consent-gated Google Analytics integrations and added the same model to Travel With Ease;
- fixed TTNGH cookie-notice validation so malformed or incomplete saved choices cannot suppress the notice;
- added public-site CSP and automated contract/browser coverage for measurement and verification.

No deployment, secret change, migration, new AI service, MCP server or production API exposure was performed.

Validation evidence and any pre-existing failures are recorded in the completion report for this change.
