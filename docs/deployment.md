# Deployment, environments and custom-domain path

Status: MVP production baseline  
Related: #13, ADR-001

## Current production topology

```text
GitHub main
   |
   +-- CI --------------------------------------------------------+
   |                                                             |
   +-- AppFactory Infrastructure (GitHub OIDC)                   |
          |                                                       |
          +--> Cloudflare Pages: trigenys-commerce-factory       |
          |      React/Vite static application                    |
          |      https://trigenys-commerce-factory.pages.dev      |
          |                                                       |
          +--> Cloudflare Worker: trigenys-commerce-factory-api   |
          |      Hono + TypeScript, Workers Builds                |
          |                                                       |
          +--> AppFactory Neon control plane                      |
                 branch: commerce-factory                         |
                 database: commerce_factory                       |
                 Managed Better Auth                              |
```

The product repository owns declarative intent. AppFactory owns provider credentials and performs infrastructure mutations after validating the exact repository, protected `main` ref and canonical workflow identity with GitHub Actions OIDC.

No Cloudflare token, Neon API key or PostgreSQL password is stored in this repository.

## Environments

### Local development

Frontend:
- Vite on `http://localhost:5173`;
- localhost is allowlisted as a Managed Better Auth trusted domain.

Backend:
- Wrangler local development from `/backend`;
- developer-only values belong in ignored local environment files, never source control.

### Preview

Cloudflare Pages preview deployments are created from non-main branches.

Preview is intentionally read-only with respect to production infrastructure provisioning. Pull requests do not receive permission to create/reconcile Neon targets through AppFactory.

Merchant creation/login links on this project's Pages preview hosts point to the canonical production `/app` origin. Direct visits to a preview `/app` also redirect there before loading the merchant client. The preview origin is not added to production API CORS or Managed Auth trusted domains. Local development and the canonical site retain relative `/app` navigation.

The theme showroom remains a presentation preview until its migration and Worker rollout are complete. Opening the production merchant app does not enable draft-only themes.

When isolated API/database previews become necessary, use AppFactory's existing `staging` Worker/Hyperdrive identity instead of sharing production credentials with PR builds.

### Production

`main` is the production ref.

The canonical `.github/workflows/appfactory-infrastructure.yml` workflow performs, in order:

1. Pages reconciliation;
2. TypeScript Worker reconciliation;
3. allowlisted Neon database + Managed Better Auth reconciliation.

The workflow sends repository identity and non-secret declarative files only. Provider credentials remain inside AppFactory.

## Reproducible deployment

Frontend:
- build command: `npm run build`;
- output: `dist`;
- Cloudflare Pages production branch: `main`.

API:
- source root: `/backend`;
- Node: 24;
- validation: `npm install --ignore-scripts --no-audit --no-fund && npm run check`;
- deployment: local Wrangler through Cloudflare Workers Builds;
- Worker identity: `trigenys-commerce-factory-api`.

Database/Auth:
- AppFactory target is server-side allowlisted;
- PostgreSQL role/database creation is idempotent;
- Managed Better Auth is branch-scoped;
- connection URL and Auth base URL are written directly to the Worker as secret bindings.

The initial SQL schema is versioned under `db/migrations/`. The current MVP applies reviewed migrations to the dedicated Commerce Factory database after infrastructure provisioning. A reusable Node/Postgres migration gate can be added to AppFactory when schema cadence justifies it.

## Production evidence

The first production infrastructure reconciliation proved:

- Pages reconciliation succeeded;
- TypeScript Worker build/deploy succeeded;
- Worker `/health` reports both database and Auth configured;
- Neon contains the dedicated `commerce_factory` database and `commerce_factory_owner` role;
- Managed Better Auth is enabled against `commerce_factory`;
- the committed tenant schema exists in the dedicated database.

The first Neon bootstrap also exposed a short provider propagation race between role creation and database creation. AppFactory recorded that failure memory and now retries only the transient database-create state conflict with a bounded backoff.

## Secrets

Server-side only:

- AppFactory: `NEON_API_KEY`, Cloudflare resource/build credentials, `APPFACTORY_NEON_TARGETS`;
- Commerce Worker: `TRIGENYS_COMMERCE_FACTORY_DATABASE_URL`, `TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL`, `TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN`.

The browser receives only the public Auth base URL through `GET /v1/config`. It never receives PostgreSQL or provider-control credentials.

## Rollback

Frontend:
- redeploy a previously known-good Pages commit/deployment.

Worker:
- Cloudflare keeps versioned Worker deployments; restore a known-good version or revert the Git commit and let Workers Builds redeploy.

Database:
- prefer additive, backward-compatible migrations;
- a failed migration must not be hidden by a frontend/API rollback;
- for a destructive future migration, create a Neon restore point/branch before the change and document a forward-fix or restore plan.

Infrastructure:
- AppFactory ownership markers prevent silent adoption of unrelated resources;
- repeated reconciliation is idempotent.

## Custom domains — later increment

Custom merchant domains do not block MVP.

Initial MVP:
- Commerce Factory marketing/admin stays on the platform domain;
- storefronts resolve by merchant slug under the shared application.

Later custom-domain path:
1. merchant submits a hostname;
2. ownership is verified;
3. hostname → store mapping is stored server-side;
4. Cloudflare custom-hostname/edge routing maps the host to the same storefront runtime;
5. TLS provisioning/renewal remains provider-managed;
6. the canonical storefront URL is updated for SEO and sharing.

Do not create one full Pages project per merchant. Custom domains should route to the shared storefront application.

## Expected low-traffic cost

As of October 2026, the current beta is expected to remain **approximately $0/month in incremental hosting/database cost** while usage stays inside existing free allowances:

- Cloudflare Pages static asset requests are free; Workers Free includes up to 100,000 requests/day.
- Neon Free currently includes 1 GB storage and 100 CU-hours per project, up to 10 branches per project, and Managed Better Auth allowance suitable for an early beta.

This estimate excludes:
- domain registration;
- future product media storage/transform costs from #10;
- paid email/SMS providers;
- traffic or compute above provider free allowances.

Provider pricing is external and can change. Re-check current limits before public launch or a paid pilot.
