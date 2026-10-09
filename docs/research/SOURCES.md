# Research and competitive intelligence protocol

For substantial product, architecture, UX/UI/CX, security or infrastructure decisions, conduct fresh, **targeted** research before recommending a solution.

Sources in priority order: official standards/specifications → primary technical publications → reproducible independent research → vendors' documentation → public user/community experience (clearly labeled).

Each research note in `docs/research/` records:
- task/question and date checked;
- source, URL, version/date and direct observation;
- comparator products and relevant pricing or features, with uncertainty;
- country/market context, accessibility and low-bandwidth constraints where relevant;
- trade-offs, recommended differentiation, testable hypothesis and decision linkage.

Never fabricate a source, competitor feature, certification or recent price. If browsing is unavailable, mark `RESEARCH_BLOCKED` and avoid claims requiring fresh verification. Avoid unnecessary web research for typo fixes or one-line trivial tasks. Cache stable references but recheck security advisories, prices and volatile API limits before decisions.

Starting points: ISO/IEC/IEEE 42010, ISO/IEC 25010, PMBOK, IIBA BABOK, OWASP ASVS/API Top 10, NIST SSDF/CSF, WCAG 2.2, ISO 9241-210, DORA/SRE and applicable official framework docs. Confirm current editions and applicability; referencing a standard does not imply formal compliance.
