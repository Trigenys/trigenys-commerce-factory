# Location assistance

Issue #88 follows Jennifer's request for a location dropdown that helps with spelling while accepting personal neighbourhoods and landmarks.

The shared LocationInput is used by setup and store settings. It offers cities from the currently selected country, normalizes accents for matching and tolerates small misspellings/transpositions. After a comma, the neighbourhood/landmark is kept verbatim when selecting a corrected city. A final option explicitly retains the entered text. Empty values remain optional. Neither blur, Escape nor a country change accepts a correction or clears the field. The existing string/API/draft contract is retained, including the server's 180-character limit; old longer drafts receive a field error rather than silent truncation.

Suggestions are local and deliberately incomplete: up to thirty GeoNames populated-place names for each supported country (CM, CI, SN, GA, CG). The field credits GeoNames; THIRD_PARTY_NOTICES.md records its CC BY 4.0 attribution, selection procedure and source digests. No location search is sent to GeoNames or another geocoder. This is spelling assistance, not verification of an address or business. An unknown country still accepts free text.

Reuse was checked in Commerce Factory and searched in the Trigenys repositories; no existing combobox/geocoder was found. A native datalist would preserve arbitrary input but its browser-controlled filtering cannot consistently display typo suggestions. Downshift 9.4.0 is used for ARIA, focus, keyboard and pointer interactions instead of another widget state machine. Its manual-selection reducer preserves text on blur/Escape. The small bounded city-ranking helper is product logic, not infrastructure. No geocoding backend, account, key, database field or migration is introduced.

Verification extends the existing guided browser suite: FR 1440/390px and EN 320px, typo and accent matching, selecting the same city twice, blur/Escape, comma suffix retention, free text through draft reload and store save, country filtering, touch selection in settings, settings save/reload and empty optional input. Existing axe/overflow/screenshots and full repository checks remain required before delivery. These checks use isolated API/auth fixtures and do not establish complete assistive-technology or real-merchant usability coverage.

RAIDER: reusable field and existing persistence; country-scoped declarative data; manual selection never mutates input twice or on blur; compatible drafts; tested keyboard/failure boundaries; retroactive support for pre-existing location strings.

References reviewed 2026-11-01:
- https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- https://github.com/downshift-js/downshift/tree/master/src/hooks/useCombobox
- https://download.geonames.org/export/dump/readme.txt
