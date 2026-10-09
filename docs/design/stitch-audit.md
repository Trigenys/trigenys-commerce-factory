# Stitch landing audit

Source: Stitch desktop + mobile export supplied on 2026-10-08.

## Decision

Use the Stitch visual direction as the landing foundation, but do not ship its generated commercial claims verbatim.

The strongest parts are:
- the green/slate/soft-lilac visual system;
- Space Grotesk + Plus Jakarta Sans typography;
- split hero with storefront and phone preview;
- four-step onboarding;
- category showcase;
- WhatsApp conversation visualization;
- merchant dashboard preview;
- dark final CTA.

## Corrections required before production

### Remove fabricated traction

Do not publish:
- “Trusted by 4,200+ merchants”;
- “185M FCFA processed monthly”;
- “Join thousands of merchants…”;
- network-active / regional settlement claims.

Commerce Factory is still an MVP.

### Do not turn WhatsApp clicks into sales

The product can observe:
- store views;
- product views;
- WhatsApp CTA clicks;
- derived click-through rate.

It cannot automatically claim:
- completed orders;
- closed WhatsApp dialogues;
- revenue;
- payment state;
- delivery state.

Those require additional product mechanisms.

### Keep payments out of MVP positioning

Stitch introduced:
- Orange Money/Wave payment confirmation;
- mobile-money gateways;
- currency settlement/reconciliation;
- escrow/compliance language.

These are not part of the current MVP and are removed from the landing.

### Move Meta features to roadmap

Meta catalog sync, Pixel/CAPI, Instagram shopping and ad creation are future integrations. They should be shown as roadmap architecture, not “live” capabilities.

### Do not invent final pricing

The desktop and mobile Stitch exports even disagree on plan prices. The implementation keeps plan tiers but explicitly leaves Pro/Business pricing for merchant validation.

## Implementation notes

The React implementation preserves the Stitch direction without copying its raw Tailwind-CDN HTML into the product codebase.

It uses:
- semantic React sections;
- repository-owned responsive CSS;
- no Tailwind CDN;
- no fake testimonials/logos;
- no fake performance/revenue claims;
- one responsive implementation rather than separate desktop/mobile pages.

## Landing media production strategy

The approved Stitch demo images are now self-hosted as build assets under `public/landing/` and delivered by the Cloudflare Pages CDN. The landing no longer depends on Stitch/AIDA/Google image URLs at runtime.

Each approved image has:
- a 480 px WebP derivative;
- a 480 px AVIF derivative;
- a high-density derivative capped at the source width (512 px) in both WebP and AVIF;
- explicit intrinsic width/height metadata in the React markup;
- responsive `srcset` and `sizes` hints.

The R2 bucket remains reserved for tenant-owned product/store media. ADR-001 selects R2 for merchant media; static marketing artwork belongs to the Pages build boundary and does not need tenant metadata, authenticated upload routes or database records.

All six landing images are treated as decorative/redundant because the adjacent product/category text carries the same semantic information. They intentionally use empty alt text rather than repeating visible labels.
