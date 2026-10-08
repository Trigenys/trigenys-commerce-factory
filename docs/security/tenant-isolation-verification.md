# Tenant isolation verification plan

Issue: #9

Commerce Factory uses Neon PostgreSQL behind a Cloudflare Worker/Hono API.

The browser must never connect with a privileged Neon connection string.

## Security boundary

Every tenant-scoped request must follow:

`authenticated subject → API authorization → store membership → parameterized Neon query`

The API derives the authenticated subject from the verified session/token. It must never trust a client-supplied user id as authorization.

## Required automated scenarios

1. User A owns Store A.
2. User B owns Store B.
3. User A can read/update Store A.
4. User A cannot read/update/delete Store B by guessing its UUID.
5. User B cannot add themselves to Store A.
6. An unauthenticated request cannot access merchant-private endpoints.
7. A public storefront endpoint returns only published storefront fields.
8. Changing a client-supplied `store_id` to another tenant fails at the API authorization boundary.
9. Database queries are parameterized.
10. The browser bundle/environment contains no Neon database credential.

## Database defense

The first migration provides relational constraints and store membership records. Provider-specific RLS is intentionally not coupled to a third-party auth schema.

When Neon Auth/Data API wiring is finalized, database-level RLS can be added as defense in depth, but API authorization remains mandatory.

## Secrets

Browser-safe:
- `VITE_API_BASE_URL`

Server-only:
- Neon database URL / role credentials;
- Neon Auth server secrets;
- future Meta access tokens;
- R2 write credentials.

## Status

Schema foundation exists in the repository. #9 remains open until the dedicated Neon project exists and cross-tenant negative tests pass against a real development branch.
