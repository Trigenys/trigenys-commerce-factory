# Authentication and tenant isolation

Status: MVP baseline  
Related: #9, ADR-001

## Trust boundary

Commerce Factory uses Managed Better Auth on the approved Neon branch for identity and a Cloudflare Worker/Hono API as the authorization boundary.

The browser never receives a PostgreSQL connection string. Private merchant operations are performed only through the Worker.

## Authentication flow

1. The React application authenticates the merchant with Managed Better Auth.
2. For the separate Worker API, it obtains a short-lived Managed Better Auth JWT.
3. The Worker verifies that JWT with the branch-specific public JWKS endpoint.
4. Verification checks EdDSA signature, issuer, audience, expiration and a non-empty `sub`.
5. The API uses only that verified `sub` as the external identity key.

The database stores that value as `store_members.auth_subject`. Core commerce tables do not foreign-key into provider-owned auth tables.

## Authorization rule

The store roles are `owner` and `staff`. Owners retain settings, publishing, payments, analytics and team control. Staff can manage catalog products and order preparation. A separate explicit `platform_members` grant gives Trigenys support access to support tickets and store metadata, without merchant-order access.

Private store reads and writes join `stores` to `store_members` and require both:

- `store_members.auth_subject = verified JWT subject`;
- the role permitted for that operation (`owner`, or `owner`/`staff` for catalog and fulfillment).

A client-supplied `store_id` locates a candidate resource; it never grants access.

Cross-tenant access returns the same 404 used for a missing store, so the API does not disclose whether another merchant owns that identifier.

Invitations expire after 48 hours, are single-use and match the email in the signed JWT. Acceptance requires a signed verified-email claim. Tokens are hashed in storage; removing membership revokes store access immediately even when the identity JWT remains valid. An owner cannot remove the store's owner membership.

## Public storefront boundary

Public storefront routes query only:

- stores with `status = 'published'`;
- products with `status = 'active'`.

The public response is explicitly shaped to storefront fields. It never returns membership rows, auth subjects, merchant IDs, internal role state or database metadata.

## Secrets

Server-only Worker bindings:

- `TRIGENYS_COMMERCE_FACTORY_DATABASE_URL`;
- `TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL`;
- `TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN`.

The Auth base URL is not a credential, but AppFactory transports it with the same Worker-secret mechanism so product repositories do not own infrastructure configuration.

`GET /v1/config` may return the Auth base URL because the browser must know where to authenticate. It never returns the database URL.

## CORS

The Worker accepts browser API calls from the AppFactory-managed Pages production origin and localhost during development.

CORS is not an authorization mechanism. Every private route still verifies the bearer token and store membership.

## Abuse controls

Application authorization and platform rate limiting are separate controls.

Before public beta, configure Cloudflare rate limits at minimum:

- `/v1/admin/*`: 60 requests/minute/IP;
- `/v1/public/*`: 120 requests/minute/IP;
- tighter limits later for analytics ingestion, upload signing and Meta callbacks.

Order and support submissions use native Cloudflare Rate Limiting bindings, configured in `backend/wrangler.production.jsonc`. Missing bindings fail closed with 503; throttled calls return 429 and `Retry-After: 60` without writing. Keys are hashed, and staging uses separate namespace IDs. These are approximate per-location limits, not global quotas or an accounting mechanism. Edge-isolate memory is not used as a security counter.

## Failure behavior

- missing bearer token → 401;
- invalid/expired token → 401;
- Auth not provisioned → 503;
- authenticated user outside the store tenant → 404;
- draft/archived storefront → 404;
- missing database/Auth Worker configuration fails closed.

## Automated proof

`backend/test/auth-tenant-isolation.test.ts` verifies:

- unauthenticated admin rejection;
- invalid token rejection;
- owner access to own store;
- cross-tenant read rejection;
- cross-tenant write rejection with no mutation;
- explicit public response surface;
- unpublished stores are not public.
