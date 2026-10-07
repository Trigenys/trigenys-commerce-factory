# ADR-001 — MVP platform architecture

Status: Accepted  
Date: 2026-10-07  
Scope: Commerce Factory MVP

## Context

Commerce Factory is a multi-tenant SaaS for merchants who already sell through WhatsApp, Instagram or Facebook. The MVP must let a merchant create a branded storefront, add products, publish it and hand a customer into WhatsApp with a prefilled order message.

The architecture should optimize for:
- low initial operating cost;
- fast product iteration;
- strong tenant isolation;
- mobile-first storefront performance;
- a credible path to Meta integrations and custom domains;
- portability where it matters;
- as few moving parts as possible before product-market validation.

It should not optimize for hypothetical enterprise scale before we have merchant evidence.

## Decision summary

### Recommended for MVP

- **Web application:** React 19 + TypeScript + Vite.
- **Hosting:** Cloudflare Pages for the web app.
- **Primary data platform:** Supabase Postgres.
- **Authentication:** Supabase Auth.
- **Product/store media:** Supabase Storage initially.
- **Sensitive server-side operations:** a thin server API boundary introduced only where browser-direct access is inappropriate. Cloudflare Workers/Hono is the preferred first server runtime when needed.
- **Analytics:** first-party event table in Postgres for MVP product metrics; PostHog can be added for product analytics, but it is not the source of truth for merchant-facing numbers.
- **Storefront model:** one multi-tenant application, not one deployment per merchant.
- **Public URLs:** `/shop/:storeSlug` and `/shop/:storeSlug/p/:productSlug` for MVP. Custom domains are deferred.

This uses managed services deliberately to reduce MVP operations, not as a default architecture rule.

## Options considered

### Option A — Cloudflare-first

React/Vite + Cloudflare Pages + Worker/Hono + D1 + R2.

**Possible:** yes.  
**Common:** increasingly common for edge-first products.  
**Strengths:** low infrastructure overhead, integrated platform, cheap at low traffic, excellent global delivery.  
**Weaknesses:** D1 adds SQLite-specific constraints and deeper Cloudflare coupling to the core relational model. Multi-tenant relational behavior is viable, but migrating later is more work than starting on Postgres.

**Verdict:** credible alternative, especially if operating cost becomes the dominant constraint.

### Option B — portable Postgres service

React/Vite + API service (FastAPI or TypeScript) + Neon/Postgres + R2/object storage.

**Possible:** yes.  
**Common:** very common.  
**Strengths:** strong portability, mature relational semantics, explicit API boundary, good fit for future integrations and background jobs.  
**Weaknesses:** more deployment and auth plumbing before the first merchant can use the product; at least three operational components from day one.

**Verdict:** strongest long-term portability option, but heavier than necessary before product validation.

### Option C — integrated BaaS

React/Vite + Supabase Postgres/Auth/Storage, with a thin server boundary for privileged operations.

**Possible:** yes.  
**Common:** common for MVP SaaS products.  
**Strengths:** Postgres from day one, integrated auth/storage, row-level security, low operational burden, fast delivery.  
**Weaknesses:** managed-platform coupling, RLS policies become security-critical, some future integrations will still require server-side code.

**Verdict:** **recommended for MVP** because it minimizes moving parts without sacrificing Postgres or a clean migration path.

## Key architectural rule: do not deploy one app per merchant

A merchant storefront is data plus theme configuration rendered by the shared application.

Creating a store must create database records, not a new repository, Vercel project or Cloudflare Pages project.

Why:
- avoids deployment explosion;
- makes fixes instant for every merchant;
- keeps analytics and security centralized;
- simplifies custom domains later;
- allows theme evolution without rebuilding hundreds of stores.

The term “Factory” describes the product experience, not the infrastructure topology.

## Application boundaries

### Marketing
Routes such as:
- `/`
- `/pricing`
- `/demo`

No merchant-private logic should be imported here.

### Merchant application
Routes such as:
- `/app`
- `/app/products`
- `/app/store`
- `/app/analytics`

Authentication required.

### Public storefront
Routes:
- `/shop/:storeSlug`
- `/shop/:storeSlug/p/:productSlug`

Only published/active data can be returned.

### Server-only boundary
Introduce server-side endpoints for operations such as:
- Meta OAuth/token exchange;
- webhook verification;
- signed upload policies if required;
- custom-domain automation;
- abuse-sensitive analytics ingestion;
- background synchronization.

Do not create a general backend endpoint merely because “apps need backends.”

## Domain model

```mermaid
erDiagram
  USER ||--o{ STORE_MEMBER : belongs_to
  MERCHANT ||--o{ STORE : owns
  STORE ||--o{ STORE_MEMBER : has
  STORE ||--o{ PRODUCT : contains
  STORE ||--|| STORE_THEME : configures
  STORE ||--o{ EVENT : records
  STORE ||--o{ WHATSAPP_LEAD : generates
  STORE ||--o{ INTEGRATION : connects
  PRODUCT ||--o{ PRODUCT_VARIANT : has
  PRODUCT ||--o{ PRODUCT_IMAGE : has
  PRODUCT ||--o{ EVENT : receives

  USER {
    uuid id PK
    string email
    timestamptz created_at
  }

  MERCHANT {
    uuid id PK
    string display_name
    timestamptz created_at
  }

  STORE {
    uuid id PK
    uuid merchant_id FK
    string name
    string slug UK
    string whatsapp_number
    string country_code
    string currency_code
    string status
    timestamptz created_at
  }

  STORE_MEMBER {
    uuid id PK
    uuid store_id FK
    uuid user_id FK
    string role
  }

  PRODUCT {
    uuid id PK
    uuid store_id FK
    string name
    string slug
    text description
    numeric price
    string currency_code
    string status
    integer sort_order
  }

  PRODUCT_VARIANT {
    uuid id PK
    uuid product_id FK
    string name
    numeric price_override
    string status
  }

  PRODUCT_IMAGE {
    uuid id PK
    uuid product_id FK
    string object_key
    integer sort_order
  }

  STORE_THEME {
    uuid id PK
    uuid store_id FK
    string theme_key
    jsonb tokens
  }

  EVENT {
    bigint id PK
    uuid store_id FK
    uuid product_id FK
    string event_name
    timestamptz occurred_at
    jsonb context
  }

  WHATSAPP_LEAD {
    uuid id PK
    uuid store_id FK
    uuid product_id FK
    uuid variant_id FK
    timestamptz created_at
    string source
  }

  INTEGRATION {
    uuid id PK
    uuid store_id FK
    string provider
    string status
    jsonb metadata
  }
```

## Tenant boundary

The security boundary is **store membership + store_id**.

Rules:
1. every tenant-owned record must resolve to exactly one `store_id`;
2. authenticated merchant queries must be restricted to stores where the user has membership;
3. public reads must use dedicated policies/views that expose only published fields;
4. client-supplied `store_id` is never trusted as authorization;
5. cross-tenant negative tests are mandatory;
6. storage object keys must be namespaced by store.

Suggested media key:
`stores/{storeId}/products/{productId}/{imageId}.webp`

## Authentication

MVP:
- email magic link or OTP;
- owner role only is acceptable initially;
- the schema keeps `STORE_MEMBER.role` so staff roles can be introduced without redesigning ownership.

Do not build a complex RBAC matrix before there is a real requirement.

## Storefront data strategy

The public storefront queries published store/product data by slug.

MVP should prefer runtime data loading over generating static builds per merchant.

Later optimization paths:
- CDN caching;
- route-level pre-rendering;
- edge cache invalidation;
- custom-domain routing.

These are performance optimizations, not MVP requirements.

## WhatsApp handoff

The customer journey is:

`product_view → whatsapp_order_click → WhatsApp`

The product records the click/lead **before** opening WhatsApp.

A WhatsApp click is not called an order or sale. Completed sales remain merchant-confirmed until a stronger attribution mechanism exists.

## Analytics

Merchant-facing MVP metrics:
- storefront views;
- product views;
- WhatsApp CTA clicks;
- top products;
- click-through rate.

No phone number, message body or other unnecessary PII should be stored in event payloads.

## Media

Supabase Storage is recommended for MVP because it is already adjacent to Auth/Postgres and reduces infrastructure count.

Constraints:
- validate MIME and file size;
- optimize images before serving them on storefronts;
- store generated object keys, not arbitrary external URLs as the canonical source;
- namespace all objects by store;
- document deletion/orphan cleanup.

If media volume becomes material, moving public product media to R2 is a credible later optimization.

## Meta integration

Meta is an adapter, not a core dependency.

The `Integration` boundary must support:
- provider state;
- OAuth metadata;
- token references/secrets stored server-side;
- catalog sync cursor/state;
- webhook state.

Automated ad creation remains post-MVP.

## Custom domains

Not an MVP blocker.

Initial stores use platform paths/subdomains. Later custom-domain support should be implemented centrally, not by creating merchant-specific deployments.

Cloudflare for SaaS or an equivalent managed custom-hostname product can be evaluated when paying merchants require it.

## Migration strategy

1. Keep SQL migrations committed in the repository.
2. Never make production schema changes manually without a migration.
3. Treat RLS policies as versioned schema.
4. Use additive migrations where possible.
5. Keep domain repositories/adapters independent of Supabase-specific UI code.
6. If leaving Supabase, migrate Postgres first; Auth and Storage are separate migration concerns.

## Cost posture

MVP should stay inside free/low-cost tiers while traffic is small.

Cost is reviewed before adding:
- background jobs;
- image transforms at scale;
- custom domains;
- high-volume analytics;
- Meta sync workers.

Free tier is a launch constraint, not a permanent architecture promise.

## Revisit triggers

Revisit this ADR when one of these becomes true:
- storage/egress cost becomes material;
- RLS complexity blocks development speed;
- background jobs become central;
- merchant count requires dedicated caching;
- custom domains become a paid core feature;
- Meta synchronization becomes high-volume;
- regulatory/customer requirements demand stricter infrastructure isolation.
