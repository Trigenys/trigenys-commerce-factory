# ADR-002 — Multi-sector storefront themes

Status: proposed for issue #55; implementation available in the accompanying PR.

## Decision

A merchant chooses a stable theme ID and declarative `themeSettings`. The same React renderer presents merchant previews, published stores and the public `/themes` showroom. Store/product URLs, catalog ownership and WhatsApp handoff remain independent of presentation.

`shared/store-themes.ts` owns the frontend/backend contract: 24 named presets across 12 sectors plus the existing `clean` fallback. Presets compose six layouts (`spotlight`, `editorial`, `panels`, `lookbook`, `catalog`, `menu`) with palettes, typography and image framing. They are style presets, not 24 independent applications. All presets accept any sector's catalog.

Settings allow only a six-digit hexadecimal accent, a font family key, and `contain`/`cover`. Arbitrary merchant CSS, HTML and image URLs are rejected. Accent button text selects a contrasting black or white foreground. Unknown theme IDs on read fall back to `clean`; writes accept registered IDs only.

The merchant picker supports sector filtering, resettable customization and an interactive preview using active products. Changing a theme does not rewrite products, slugs, variants, media or analytics. Empty catalogs render a branded introduction without invented products.

The showroom uses a clearly marked fictional, mixed-sector catalog with existing local imagery. Sector-specific demo photography and further art direction remain follow-up work in #55. The selection is a first library, not a conversion-performance claim.

Its introduction and creation link render in the initial application shell. The interactive workspace loads separately on showroom routes, so opening `/themes` does not delay the first text paint or the functional CTA until the storefront renderer is downloaded.

## Persistence and rollout

Migration `0006_store_theme_library.sql` expands the theme constraint and adds `theme_settings jsonb NOT NULL DEFAULT '{}'`. It is additive and rerunnable; existing stores retain `clean` and empty settings. The API normalizes and validates settings before saving them, and public responses include only the allowed configuration.

Apply the reviewed migration to the dedicated Commerce Factory database before deploying the changed Worker. Verify a stored theme/settings round trip in staging, then ship the frontend. The current AppFactory provisioning workflow does not itself establish that migrations ran; merging this PR without that schema step would break repository queries. This PR must remain a draft until the migration/deployment gate is resolved.

No database migration or production Worker deployment is performed by the theme showroom. Its preview works independently of merchant authentication.

## Validation

- Frontend typecheck and production build.
- Backend check: creation/reload for all IDs, theme patch preservation, settings reset, malformed settings rejection, public configuration and WhatsApp compatibility, existing tenant/media/catalog tests.
- `npm run test:themes` uses Playwright on a local Vite server with mocked public API data. It exercises all 25 IDs at 1440px/390px on store/product routes, category filtering and readable active-filter styles, variants, image selection, handoff, empty catalogs, showroom selection/deep links, a functional creation link while the workspace download is paused, and PNG-to-WebP transparency after resizing.
- `npx playwright install --with-deps chromium` installs the test browser. CI runs the same command before the theme checks.
- AppFactory visual QA additionally visits `/themes` for all six compositions and one product route at desktop/mobile sizes; the marketing `/` route stays covered.

## RAIDER

- **Risks:** mixed-sector sample imagery is insufficient to approve each sector's finished art direction; the schema must be applied before Worker rollout; large/missing merchant images require continued visual checks.
- **Assumptions:** active-product order provides the initial hero selection; one shared app remains the tenant boundary; fonts are the existing system/loaded font families.
- **Issues:** full cart/checkout, sector-specific demo assets and merchant-selected hero ordering are outside this increment.
- **Dependencies:** existing catalog/API/media pipeline, reviewed Postgres migration, reusable AppFactory visual QA.
- **Evidence:** see the PR checks and browser verification output; no production success is inferred from a local build.
- **Results:** a configurable multi-sector presentation contract and six actual layout compositions, shared between previews and public stores.
