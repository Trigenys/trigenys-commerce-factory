# ADR-002 — Multi-sector storefront themes

Status: proposed for issue #55; implementation available in the accompanying PR.

## Decision

A merchant chooses a stable theme ID and declarative `themeSettings`. The same React renderer presents merchant previews, published stores and the public `/themes` showroom. Store/product URLs, catalog ownership and WhatsApp handoff remain independent of presentation.

`shared/store-themes.ts` owns the frontend/backend contract: 24 named presets across 12 sectors plus the existing `clean` fallback. Presets compose six layouts (`spotlight`, `editorial`, `panels`, `lookbook`, `catalog`, `menu`) with palettes, typography and image framing. They are style presets, not 24 independent applications. All presets accept any sector's catalog.

Settings allow only a six-digit hexadecimal accent, a font family key, and `contain`/`cover`. Arbitrary merchant CSS, HTML and image URLs are rejected. Accent button text selects a contrasting black or white foreground. Unknown theme IDs on read fall back to `clean`; writes accept registered IDs only.

The merchant picker supports sector filtering, resettable customization and an interactive private preview with an explicit option to include draft products. Drafts remain excluded from public API responses. The preview explains saved/unsaved settings, publication state and product visibility; catalog loading failures have a retry action. A newly selected theme starts with its own defaults, and merchants can customize it afterwards. Changing a theme does not rewrite products, slugs, variants, media or analytics. Empty catalogs render a branded introduction without invented products.

The showroom uses a clearly marked fictional, mixed-sector catalog with existing local imagery. Sector-specific demo photography remains follow-up work in #55; the six composition families now have separate art direction across hero, catalog and product routes. The selection is a first library, not a conversion-performance claim.

Its introduction and creation link render in the initial application shell. The interactive workspace loads separately on showroom routes, so opening `/themes` does not delay the first text paint or the functional CTA until the storefront renderer is downloaded.

## Persistence and rollout

Migration `0006_store_theme_library.sql` expands the theme constraint and adds `theme_settings jsonb NOT NULL DEFAULT '{}'`. It is additive and rerunnable; existing stores retain `clean` and empty settings. The API normalizes and validates settings before saving them, and public responses include only the allowed configuration.

Apply the reviewed migration to the dedicated Commerce Factory database before deploying the changed Worker. Verify a stored theme/settings round trip in staging, then ship the frontend. The current AppFactory provisioning workflow does not itself establish that migrations ran; merging this PR without that schema step would break repository queries. This PR must remain a draft until the migration/deployment gate is resolved.

No database migration or production Worker deployment is performed by the theme showroom. Its preview works independently of merchant authentication.

On Pages preview hosts, creation links open the canonical production merchant application. Direct preview `/app` URLs redirect there before initializing authentication. The preview does not gain production CORS/Auth permissions, and its draft themes are not presented as activated in production.

## Validation

- Frontend typecheck and production build.
- Backend check: creation/reload for all IDs, theme patch preservation, settings reset, malformed settings rejection, public configuration and WhatsApp compatibility, existing tenant/media/catalog tests.
- `npm run test:themes` uses Playwright on a local Vite server with mocked public API data. It exercises all 25 IDs at 1440px/390px on store/product routes, category filtering and readable active-filter styles, variants, image selection, handoff, empty catalogs, showroom selection/deep links, a functional creation link while the workspace download is paused, and PNG-to-WebP transparency after resizing.
- `npx playwright install --with-deps chromium` installs the test browser. CI runs the same command before the theme checks.
- Build with `npm run build` before `npm run test:themes`: its preview-origin navigation checks use the production assets in `dist`. They verify all merchant links and old preview `/app` URLs reach the canonical origin, with a mocked destination so no account is created during CI.
- AppFactory visual QA additionally visits `/themes` for all six compositions and one product route at desktop/mobile sizes; the marketing `/` route stays covered.

## RAIDER

- **Risks:** mixed-sector sample imagery is insufficient to approve each sector's finished art direction; the schema must be applied before Worker rollout; large/missing merchant images require continued visual checks.
- **Assumptions:** active-product order provides the initial hero selection; one shared app remains the tenant boundary; fonts are the existing system/loaded font families.
- **Issues:** full cart/checkout, sector-specific demo assets and merchant-selected hero ordering are outside this increment.
- **Dependencies:** existing catalog/API/media pipeline, reviewed Postgres migration, reusable AppFactory visual QA.
- **Evidence:** see the PR checks and browser verification output; no production success is inferred from a local build.
- **Results:** a configurable multi-sector presentation contract and six actual layout compositions, shared between previews and public stores.

## Product visibility and small-catalog presentation

The catalog exposes Activate / Move to draft alongside every editable product, with public visibility explained separately from store publication. Changing visibility sends only `{status}` to the existing product PATCH endpoint. The server accepts exactly `draft` or `active` in this narrow form and updates only status and the timestamp. Existing full product edits keep their validation; archived products cannot be reactivated, and the owner/staff tenant predicates are unchanged. An open editor disables the list action for the same product so its draft cannot later silently reverse a visibility change.

Small catalogs get an explicit composition rather than an expanded empty gallery. Single-product lookbooks place the store introduction beside a product scene with a separate name, price, stock and product action; text never covers the product image. Empty catalogs retain the selected palette. Template sector labels do not pretend to describe a merchant's products. Public and private storefronts use the same container-responsive layout rules, including in a narrow desktop preview.

Proof of Done: catalog browser checks cover owner/staff activation, hiding, failed writes/retry, pending locks, unsaved-editor protection, status filters and a confirmed write followed by a failed refresh. Appearance checks cover private drafts, active-only emptiness, disabled ordering, changing theme defaults, save/reload and catalog-load recovery in French/English at desktop/mobile widths. Theme checks retain 12 single-product screenshots across six compositions, check first-viewport price/action for the celebration lookbook, and exercise all 25 store/product themes. A real Postgres test verifies status-only preservation of all product fields, immediate public inclusion/exclusion, owner/staff access, foreign-store denial, revocation, invalid input and archive protection.

RAIDER: **Risks:** layout changes touch all six compositions and need rendered review; a new narrow API write must reach both existing Workers before the frontend. **Assumptions:** the catalog order still chooses the initial feature; the merchant controls their imagery and theme choice. **Issues:** curated sector photography and a dedicated feature selector remain separate work. **Dependencies:** existing media authorization, store membership, shared renderer and CI browser/Postgres runners; no new dependency or migration. **Evidence:** PR typecheck/build, browser screenshots and SQL integration checks. **Results:** recorded in the PR after checks and existing-site deployment; no merchant data is changed to demonstrate the feature.


## Storefront art direction

The six layout families now have distinct composition rules rather than sharing a rounded split card: a sculptural product stage; a photograph-first editorial spread; a graphic panel wall; an asymmetric collection gallery; a structured, price-led catalog; and a plate-led visual menu. Sector rules add botanical arches, jewelry rings, sports pitch lines, technical grids, gallery mounts, market framing and playful geometry. The stable 25 presets still compose these families; they are not 25 separately implemented storefronts.

`themes.css` owns shared renderer structure and container-responsive behavior; `art-directions.css` owns sector identity and continuity through header, catalog cards, product galleries, variants, forms and checkout controls. The shared shell exposes only the resolved sector and validated image-fit keys. Theme thumbnails reflect the same six compositions. No data-model, backend, asset source or dependency changes are required.

Product imagery uses the merchant's existing media. Names, prices and actions occupy separate areas from photographs. `contain` artwork is inscribed inside organic frames so a decorative arch or plate does not crop its corners. The spotlight selector shows real product thumbnails and updates the real product link. Catalog cards expose an explicit product link. Empty and single-product shops retain their dedicated behavior. Existing product status, private draft preview and theme customization remain independent of art direction.

Proof of Done: the browser suite exercises all 25 store/product presets at 1440px and 390px, and retains full-store and product-route screenshots for seven representative presets covering all six families. It checks product metadata never overlaps photography, the editorial reading order, working spotlight selection and its destination, single-product first-screen price/action, and the custom pink/sans/contain combination. The existing rendered QA routes continue checking responsive overflow, accessibility, reduced motion and performance budgets. Screenshots must be reviewed before merge; build success alone is insufficient visual approval.

RAIDER: **Risks:** shared presentation changes affect every preset and merchant photo proportions vary; geometric decorations must not clip image content or create overflow. **Assumptions:** the merchant controls actual photos, product order, palette and font; the mixed-sector showroom remains explicitly fictional. **Issues:** dedicated sector photography and merchant-selected hero ordering remain outside this change. **Dependencies:** existing renderer, validated theme contract, local images and remote browser CI; no new runtime package. **Evidence:** PR checks and retained desktop/mobile images, including customized one-product and empty states. **Results:** recorded after rendered review and deployment to the two existing Pages projects; no merchant records are rewritten for the demonstration.
