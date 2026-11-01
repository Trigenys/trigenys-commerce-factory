# Visual merchant setup

Implemented for Jennifer's 2026-11-01 onboarding request, tracked in #86.

## Experience and reuse

The same authenticated merchant application now keeps first-time owners in a five-stage creation assistant: identity/activity, WhatsApp, style, first product, review/publication. It uses the existing storefront renderer, shared theme registry, ThemePicker, ProductCatalog, private media loader and API methods. No sample product is sent to the API. No database, OAuth application or infrastructure is added. Shared location/phone inputs use the small libraries documented below.

Only the name is required on the identity screen. Activity cards suggest a theme family; all sectors/themes remain available and activity does not become another mandatory business field. The slug is derived from the name and editable. Description, business location and a clearly public contact email are optional. A new account's login email is not automatically published; previously entered valid draft values remain available. Country/currency defaults are editable. Currency follows a country change only while it still equals the previous country's default.

The preview starts with an explicitly labeled illustrative item, then shows the merchant's saved/edited product. It uses the same renderer and disables ordering. Mobile opens the preview in a native dialog with Escape and focus restoration. Motion effects honor reduced-motion preferences. Step titles, field errors and actual draft/save status remain visible.

## Data and recovery boundaries

- The old validated pre-store draft key is retained. After a store is saved, its input draft is scoped to both the account and the selected store. Progress is versioned and validated; missing/corrupt progress cannot skip required creation.
- Creating/saving the store at stage three uses the existing endpoint and keeps it in draft. The resulting URL has the explicit setup marker and store ID, so reload resumes the assistant. Both identity and contact validation are retained in the settings form through the shared helper.
- Existing stores keep their normal workspace. An owner of a draft store can explicitly resume guided setup. Staff and published stores are never forced into it; server membership/role authorization is unchanged.
- The product editor remains mounted across backward navigation, retaining its in-memory selected files and its existing tab draft. File blobs and blob URLs are never persisted to draft/API data. Reload or tab closure requires choosing unsent files again; the UI says so.
- Guided product creation may first need a server-owned draft product ID to bind photos. Confirmed uploaded media URLs and that product ID are retained after a later failure. Retry reuses them, then applies the final product update. Completed uploads are not blindly repeated. No distributed transaction or exactly-once guarantee is claimed for a lost, unconfirmed initial creation response; the existing unique slug and explicit conflict/recovery remain authoritative.
- Publication is always a separate user action. Unsaved input, an open product edit, unavailable catalog or no active product blocks it. The server still checks owner rights and active products. A failure keeps draft access available, and confirmed publication exposes the actual storefront link.
- Exit/save-as-draft does not publish. The normal workspace and its existing launch checklist remain usable. Browser storage availability and actual server saves are described separately.

## Verification

The existing typecheck/build and frontend/backend CI remain required. The new installed-SDK browser suite, npm run test:onboarding, uses isolated provider/API/media fixtures and covers:

- French 1440/390px and English 320px; required-field validation, sector recommendations and preview dialog;
- identity and product draft reload, backward navigation, generated links and sample/inventory separation;
- photos selected before save, announced reload limits, a failed final media attachment and safe retry using the confirmed product/media;
- explicit publication, failed publication/retry, draft exit/resume, no active product and catalog outage;
- existing owner/staff/public-store boundaries and malformed progress with legacy draft preservation;
- browser runtime errors, reduced-motion layout, visible images, overflow and automated accessibility.

Existing account/social tests retain their managed identity flows with the new setup entry heading. The full user-journey suite still performs signup, store save, product draft reload, keyboard upload access, theme save and publication. CI retains screenshots and reports under commerce-guided-onboarding. Review rendered desktop/mobile images before merge.

These are fixture checks, not evidence of live authentication, a complete WCAG audit or improved merchant conversion. Persistent activation instrumentation and a customer study are outside this increment. Later measurement should distinguish first personalized preview, confirmed store/product save, publication and abandoned stages, without recording entered customer content.

## RAIDER

Reusable: existing renderer, editor, media/API and tab-draft contracts. Agnostic: declarative theme/sector choices and native React/CSS/dialog. Idempotent: submission locks and retry of known product/media identities; no automatic publication. Durable: validated account/store-scoped drafts and existing server persistence. Engineering-grade: failure states, role boundaries, explicit saved-vs-local feedback and browser/CI evidence. Retroactive: old draft compatibility and normal navigation for existing stores.

## Research checked 2026-11-01

- https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/ — logical grouping, expectations and contextual support.
- https://www.nngroup.com/articles/onboarding-tutorials/ — contextual task help instead of a separate mandatory tutorial.
- https://www.w3.org/WAI/tutorials/forms/multi-page/ — logical stages, progress, optional stages and retained answers.
- https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions — support motion preferences.
- https://help.shopify.com/en/manual/intro-to-shopify/initial-setup — optional industry personalization.

These references inform the design; they are not evidence that this particular implementation improves conversion.

## Compact setup and international phone field (#90)

The wizard uses one persistent bottom action group, including the existing product save/cancel controls. Its measured height reserves page space through `useChromeHeight`, so wrapped labels and small/zoomed screens can still scroll fields above the actions. Previous/next navigation is blocked during product mutations. Moving back retains the mounted editor and selected unsent photos. The global marketing footer is omitted during setup only. There is no document overflow lock or fixed-height form.

The progress header, headings, activity tiles and theme gallery use less space; duplicate instructions are removed. The sample conversation and advanced customization are expandable. The storefront preview height follows the viewport and action bar. The default Beauty style screen is checked at 1366×768 and 1536×834; smaller screens and expanded options may still scroll naturally. This is deliberately not a promise of zero scrolling for arbitrary content, browser zoom or translated labels.

`WhatsAppInput` is shared by setup and store settings. `react-phone-number-input` 3.4.18 handles country detection, national/international formatting and caret interactions. A native country select shows localized country names and calling codes with no remote flag requests. The business country supplies the default, while an existing international number or an explicit phone-country selection takes precedence. A foreign number does not change the business country. Changing the business country explicitly canonicalizes any legacy national draft using its previous country, so that number keeps its original calling code. New edits emit E.164 strings to the unchanged draft/API contract; older accepted Cameroon values are normalized for display without changing stored data merely on mount. Generic existing server-compatible validation is retained instead of freezing valid numbering allocations to library metadata. The library metadata should still be updated periodically for formatting changes.

Verification extends the existing fixture browser suite with national input, foreign numbers, paste, calling-code changes, business-country independence, settings save/reload, default style viewport bounds, reachable expanded controls, product back/file retention and busy navigation guards. Screenshots and automated accessibility checks cover FR/EN, desktop, mobile and a constrained 1024×600 viewport. They do not replace live identity checks or customer usability testing.

Primary sources checked 2026-11-01:
- https://github.com/catamphetamine/react-phone-number-input — supported component/country-select API and national/international entry; used instead of a custom country/number state machine.
- https://design-system.service.gov.uk/patterns/phone-numbers/ — accept international formats and make the expected input clear.
- https://service-manual.ons.gov.uk/design-system/patterns/phone-numbers — format examples and clear telephone input.

RAIDER: reuse the existing wizard, editor and height observer; no new account or backend boundary; avoid automatic saves on mount; keep legacy drafts and international numbers; pin the dependency and retain visual/CI evidence.
