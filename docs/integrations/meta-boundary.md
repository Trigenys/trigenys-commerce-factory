# Meta integration boundary

Status: Accepted for MVP architecture  
Date: 2026-10-08  
Related: #12, ADR-001

## Decision

Meta is an optional adapter around Commerce Factory, not part of the core commerce runtime.

A merchant must still be able to:
- manage products;
- publish a storefront;
- receive WhatsApp order intent;
- view first-party merchant analytics;

when Meta is disconnected, under review, rate-limited, unavailable or returning an API error.

Automated ad creation remains post-MVP.

## Integration entity

The relational `integrations` record stores non-secret connection state only.

Recommended Meta fields:

- `id`
- `store_id`
- `provider = 'meta'`
- `status`: disconnected | pending | connected | degraded | revoked
- `business_id`
- `catalog_id`
- `instagram_account_id` when relevant
- `token_ref`
- `token_expires_at`
- `sync_cursor`
- `last_synced_at`
- `last_error_code`
- `webhook_subscription_id`
- `metadata jsonb` for non-secret provider state only

The canonical product remains the Commerce Factory `Product`. Meta IDs are remote references, never the source of truth for product data.

## OAuth and token boundary

OAuth begins and ends at the Cloudflare Worker API.

Flow:

1. Merchant starts connection from the authenticated dashboard.
2. API creates a short-lived, single-use state value bound to the authenticated store.
3. Browser is redirected to Meta authorization.
4. Callback returns to the Worker.
5. Worker verifies state before exchanging the authorization code.
6. Token material is stored server-side.
7. Browser receives only connection status and safe provider metadata.

Rules:

- access/refresh tokens never enter application logs;
- tokens are never returned to the browser after exchange;
- tokens are never committed to GitHub or stored in public environment variables;
- `Integration.metadata` must not contain raw tokens;
- every callback resolves the authenticated store independently of any client-supplied `store_id`;
- disconnect/revocation marks the integration unusable before any further sync.

### Token storage

Per-merchant tokens are dynamic secrets, so they must not be modelled as ordinary Cloudflare Worker environment secrets.

For MVP, store an encrypted token payload server-side and keep the encryption key in the Worker secret store. `integrations.token_ref` points to that secret record. Use authenticated encryption, rotate the application key deliberately, and keep enough metadata to re-authorize merchants if rotation cannot safely re-encrypt an old token.

A dedicated managed secrets vault can replace this later without changing the integration contract.

## Permission strategy

Request the minimum permissions for the feature the merchant is enabling.

### Catalog synchronization

Required/expected boundary:

- `catalog_management` — create/read/update/delete business-owned product catalogs and catalog items.
- `business_management` — business asset discovery/management where the selected catalog/business flow requires it.

Do not request advertising permissions just to synchronize a catalog.

### Instagram surfaces

Instagram permissions depend on the exact later feature and login model. Do not request publishing scopes in the MVP merely because Instagram is on the roadmap.

If Commerce Factory later publishes Instagram media/content, evaluate the then-current Instagram permissions for the selected login model (for example basic account access plus content-publishing scopes) during that feature's implementation and App Review preparation.

### Ads automation — explicitly post-MVP

Only when Commerce Factory implements campaign creation:

- `ads_management` for ad-account campaign management;
- the then-current Marketing API access tier/feature required for production-scale access.

This is intentionally absent from the MVP permission request.

## Permission review gate

Meta permissions and App Review requirements can change independently of Commerce Factory.

Before shipping any Meta capability:

1. verify the permission names in the current Meta App Dashboard;
2. verify which permissions require Advanced Access/App Review;
3. verify the exact Graph API version and endpoint requirements;
4. record the approved use case and screencast/test-business requirements;
5. update this document if the platform contract changed.

No production feature is allowed to rely on an unreviewed permission assumption.

## Catalog sync port

Core product code talks to a provider-neutral interface.

Conceptual contract:

```ts
interface CatalogPublisher {
  connect(storeId: string): Promise<ConnectionStatus>;
  upsertProducts(storeId: string, productIds: string[]): Promise<SyncResult>;
  removeProducts(storeId: string, productIds: string[]): Promise<SyncResult>;
  getStatus(storeId: string): Promise<IntegrationHealth>;
}
```

The Meta adapter owns:
- provider field mapping;
- remote IDs;
- batching;
- pagination;
- retry/backoff;
- rate-limit handling;
- provider-specific error translation.

The product/catalog domain must not import Meta SDK types.

## Product mapping

Minimum canonical mapping:

- Commerce Factory product ID → provider retailer/content ID
- name → title
- description → description
- canonical storefront product URL → link
- optimized public image URL → image link
- price + currency → price
- active/draft state → provider availability/publication behavior

Variants remain Commerce Factory domain objects. The adapter decides whether a provider requires separate items or grouped variants.

Draft/inactive Commerce Factory products must never be published by the adapter.

## Sync behavior

- manual sync is sufficient for the first integration increment;
- later background sync may consume product-change events;
- sync is idempotent by Commerce Factory product/variant ID;
- remote failures are retried with bounded exponential backoff;
- repeated failures mark the integration `degraded`;
- a Meta failure never blocks saving a product locally;
- merchant UI shows last sync time and actionable error state;
- deleting/disconnecting an integration does not delete Commerce Factory products.

## Event mapping

Merchant analytics remain first-party and provider-neutral:

- `store_view`
- `product_view`
- `whatsapp_order_click`

If Pixel/Conversions API is enabled later, an adapter may map eligible first-party events to Meta events. That forwarding must:

- be configurable per store;
- exclude unnecessary PII;
- fail asynchronously;
- never become the source of truth for merchant reporting;
- never convert a WhatsApp click into a completed purchase event without stronger evidence.

## Webhooks

Future Meta webhooks terminate at the Worker.

Requirements:
- verify provider signatures;
- reject unknown app/provider contexts;
- deduplicate deliveries;
- persist only the minimal event state needed;
- resolve the integration/store from server-held identifiers;
- return quickly and process heavier work asynchronously when introduced.

## Failure isolation

All core routes and storefronts must work with no Meta integration.

Provider failures may affect:
- catalog sync status;
- provider-specific analytics forwarding;
- future ads features.

They must not affect:
- authentication to Commerce Factory;
- merchant product CRUD;
- storefront rendering;
- WhatsApp order handoff;
- first-party analytics ingestion.

## Secrets checklist

Never expose:
- app secret;
- merchant access/refresh token;
- token encryption key;
- webhook verification/signing secret.

Safe to expose when needed:
- app/client ID;
- connected/disconnected status;
- selected business/catalog names and IDs if they are already merchant-authorized display metadata.

## Implementation order

1. Core Commerce Factory MVP.
2. Meta connection state + OAuth boundary.
3. Catalog sync.
4. Optional event forwarding / product surfaces.
5. Only after evidence: ads automation.

This ordering is deliberate: Meta cannot become a launch blocker.
