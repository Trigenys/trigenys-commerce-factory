# Merchant workspace layout

The app uses the Commerce Factory palette with an operational hierarchy: a persistent header for global utilities, a left navigation for merchant tasks, then a compact page heading and its actions. Commerce (dashboard, orders, products, analytics) is separated from store administration (appearance, connections, team, settings). Roles determine which destinations are exposed; server authorization remains authoritative.

On narrow screens the same destinations are available through a native modal navigation dialog. Escape closes it, Tab stays inside it, and focus returns to its trigger. Resizing to desktop closes the dialog and releases the body scroll lock. Navigation links keep their normal link semantics.

Dashboard counters and recent orders use the existing catalog and order endpoints. Failed reads show unavailable values and a retry action, rather than zeros. Launch completion is derived from saved store identity, active products and published status. No revenue is inferred from WhatsApp clicks. The primary add action opens the product editor; an existing saved draft takes precedence. Search and status filters operate on loaded products and orders. Product reordering is disabled while a filter is active to keep the global order unambiguous.

Page titles and primary actions share a consistent row. Settings have a sticky save action connected to the actual form, with its height included in focus scroll offsets. Product editing keeps the save/cancel bar inside the form. Product and settings confirmations use the existing fixed upper-left notification. Long tables scroll inside their own region. Storefront previews retain their independent theme.

## References

- [Carbon UI shell header](https://www.carbondesignsystem.com/building-blocks/core/components/ui-shell-header/guidelines): persistent global utilities and product orientation.
- [Carbon UI shell left panel](https://www.carbondesignsystem.com/building-blocks/core/components/ui-shell-left-panel/guidelines): product navigation under the header.
- [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): focus containment, Escape, restoration and inert background.

These are interaction conventions and accessibility references, not a claim of SaaS or WCAG certification.

## Proof of Done and RAIDER

- Risks: route changes, hidden mobile navigation, accidental draft replacement, focus obscured by sticky controls, role leakage, dashboard reads mistaken for successful empty results.
- Assumptions: the current merchant tasks and backend permissions are the product scope; real billing, global search and notification inbox are not introduced by this layout change.
- Issues addressed: oversized dashboard typography/cards, launch steps occupying the primary working space, repeated page titles, poorly grouped navigation, inconsistent action placement and undersized management text.
- Dependencies: existing auth, catalog, orders, analytics, team and connections endpoints; native React/CSS/dialog; no additional runtime package.
- Evidence: `test:workspace` renders all merchant destinations in FR/EN on desktop/mobile, checks 320–1920px layouts, modal keyboard behavior, role restrictions, search/filter behavior, direct product creation, preserved drafts, publication, sticky settings save, SDK sign-out and automated accessibility. Existing journey/catalog/social suites preserve mutations, recovery and permission checks. CI retains screenshots and reports.
- Results: publish only after typecheck/build, the external browser suites and the existing frontend/backend checks pass for the reviewed commit. Human usability testing and full accessibility certification remain separate activities.
