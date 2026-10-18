# `@faako/discovery`

Framework-neutral primitives for public search visibility and machine-readable discovery.

The package owns normalization and safety rules only. Applications continue to own titles, descriptions, organization facts, service and product content, event data, indexability decisions, and deployment origins.

Exports:

- `normalizeDiscoveryPath`, `canonicalUrl`, and `absoluteDiscoveryUrl`;
- `serializeJsonLd` for safe inline JSON-LD;
- exact-input `buildBreadcrumbList` and `buildFaqPage` schema helpers;
- `buildRobotsText`, which fails closed unless `indexable: true` is explicit;
- `validateDiscoveryPage` for output-oriented tests.

Do not use robots directives as authorization. Do not pass unapproved facts into schema builders. Do not generate location, FAQ, rating, price, availability, or event claims from inference.
