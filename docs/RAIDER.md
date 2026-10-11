# RAIDER — Commerce Factory MVP

Last reviewed: 2026-10-09

RAIDER means **Risks, Assumptions, Issues, Dependencies, Evidence, Results**.

## Risks

- Scope expands into payments, logistics, ERP or advertising before the core storefront is validated.
- A WhatsApp click may be mistaken for a completed sale.
- Incorrect API authorization or a missing `store_members` filter could expose data across merchants.
- Image uploads can become an abuse and cost vector.
- Meta review/permissions can delay social integrations independently of engineering.
- Custom domains can introduce operational complexity too early.
- Too many themes/templates can consume design time without improving conversion.

## Assumptions

- Merchants already use WhatsApp/social media to close sales.
- A professional catalog reduces repetitive questions and improves trust.
- Merchants accept manual payment/delivery coordination after WhatsApp handoff.
- Mobile is the dominant merchant/customer experience.
- FCFA and local commerce conventions should work from the first release.
- One strong storefront theme is enough to validate the product.

## Issues to resolve

- Validate the problem with 5–10 real sellers (#2).
- Confirm public brand/name.
- Validate willingness to pay.
- Decide the first merchant vertical to target.
- Approve the Stitch design before implementation (#11).

## Dependencies

- AppFactory-generated React/Vite baseline.
- AppFactory Project Automation.
- Neon PostgreSQL for relational data and branch-scoped Managed Better Auth for merchant identity.
- Cloudflare Pages + Worker/Hono for web delivery and the trusted API boundary.
- Private Cloudflare R2 media bucket, provisioned through AppFactory and bound only to the Worker.
- WhatsApp deep-link behavior.
- Meta platform APIs only for later integrations.

## Evidence

- The installed Neon Auth 0.5 adapter routes `/token` through its session cache. JWT and fresh session calls use the adapter's force-fetch option; staging verifies sign-up, sign-in, sign-out, signed claims and protected Worker access with the actual provider.
- The isolated Commerce staging branch verifies all 25 theme settings round trips and a persistent order through manual payment and fulfillment. Email delivery and usability studies remain separate verification items.
- Browser checks require each merchant route's expected heading, so a recovery page cannot satisfy a functional route check. Support retries persist the original payload and private tracking identity; payload conflicts return 409.

- Repository baseline: React 19, TypeScript, Vite and Node 24.
- The product can deliver value without a payment gateway by improving product discovery and WhatsApp handoff.
- Architecture explicitly avoids one deployment per merchant.
- MVP backlog has verifiable Proof of Done on each issue.
- Tenant-owned API queries bind the verified auth subject to `store_members` server-side; client-supplied store IDs never grant access.
- Cross-tenant read/write negative tests and the public-storefront response-surface test are committed under `backend/test/`.
- Database and Auth runtime values are provisioned through AppFactory into the Worker; the browser never receives the PostgreSQL credential.
- Product/store images are resized in-browser, stored canonically as WebP, capped at 2 MiB, and delivered through opaque Worker media URLs rather than a public R2 domain.
- Media metadata is tenant-owned in Neon and cross-tenant upload/delete tests are part of the backend test suite.

## Results to measure

Product:
- time from sign-up to published first product;
- percentage of created stores that publish;
- product views per store;
- WhatsApp CTA click-through rate;
- merchants still active after initial setup.

Engineering:
- cross-tenant authorization tests stay green;
- storefront performance remains acceptable on mobile;
- docs-only changes avoid heavy CI;
- production deploy is reproducible.

## Decision discipline

When adding a feature, answer:
1. Which verified merchant problem does this solve?
2. Is it required before the first paying merchant?
3. What new dependency or operational burden does it introduce?
4. What evidence will prove it worked?

If those answers are weak, keep it out of the MVP.
