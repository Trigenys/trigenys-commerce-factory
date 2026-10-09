# Quality gates (risk-based)

All nontrivial executable changes require **applicable** tests, never invented test results. Gate order:

0. Static validation: format, lint, typecheck, schema checks.
1. Unit tests: domain logic, boundary values, negative cases, permissions where relevant.
2. Integration tests: database/queue/adapter interactions and transaction behavior.
3. API & contract tests: OpenAPI, response shape, auth/authz, consumers, compatibility.
4. E2E tests: critical user journeys, real assertions and isolated test data.
5. Security and nonfunctional: vulnerability, accessibility, resilience/performance when affected.

## Reporting
Every gate is `PASSED`, `FAILED`, `BLOCKED`, `N/A` (with justification), or `NOT RUN`. Include test command, environment and evidence. Run cheap targeted gates first; do not expend expensive E2E resources when a blocking unit test has already failed. Repeat impacted suites after fixes.

Use the repository's existing frameworks where feasible (Pytest, Vitest/Jest, Node test, Playwright, Pact/Schemathesis, etc.). Never perform production-connected or real-payment tests without authorization.

Trace `requirement → acceptance criterion → test(s) → result`. CI must fail if a mandatory applicable gate fails.
