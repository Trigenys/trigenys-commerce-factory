# RAIDER — Commerce Factory MVP

Last reviewed: 2026-10-07

RAIDER means **Risks, Assumptions, Issues, Dependencies, Evidence, Results**.

## Risks

- Scope expands into payments, logistics, ERP or advertising before the core storefront is validated.
- A WhatsApp click may be mistaken for a completed sale.
- Incorrect RLS/authorization could expose data across merchants.
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
- Supabase for MVP Postgres/Auth/Storage per ADR-001.
- Cloudflare Pages for web delivery.
- WhatsApp deep-link behavior.
- Meta platform APIs only for later integrations.

## Evidence

- Repository baseline: React 19, TypeScript, Vite and Node 24.
- The product can deliver value without a payment gateway by improving product discovery and WhatsApp handoff.
- Architecture explicitly avoids one deployment per merchant.
- MVP backlog has verifiable Proof of Done on each issue.

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
