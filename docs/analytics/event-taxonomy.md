# Commerce Factory event taxonomy

Status: MVP analytics contract  
Related: #8, #7

## Purpose

Commerce Factory analytics measures observable customer intent. It does not infer revenue, payment, delivery or completed orders.

The MVP event names are deliberately small and stable:

| Event | Fired when | Product required |
| --- | --- | --- |
| `store_view` | A published storefront is viewed | No |
| `product_view` | A published active product detail page is viewed | Yes |
| `whatsapp_order_click` | The server accepts a product WhatsApp handoff and returns its `wa.me` URL | Yes |

A WhatsApp click is a lead/intent signal only. It is never named `order`, `purchase`, `sale` or `revenue` in reporting.

## Stored event shape

Events are persisted in `commerce_events`:

- `id`: client-generated UUID used as the idempotency key;
- `event_name`: one of the three names above;
- `store_id`: server-resolved published store ID;
- `product_id`: server-resolved active product ID when applicable;
- `metadata`: small provider-neutral context;
- `created_at`: server timestamp.

The public client sends store/product **slugs**, not database IDs. The Worker resolves those slugs against published/active data before persistence.

## PII rule

Public analytics payloads must not contain:

- customer name;
- phone number;
- email;
- IP address copied into metadata;
- WhatsApp message contents;
- merchant authentication subject;
- arbitrary free-form browser/user profile data.

Current `store_view` and `product_view` metadata is only:

```json
{"source":"storefront"}
```

`whatsapp_order_click` may additionally record the selected variant label, language and the channel name. The WhatsApp phone and generated message are not stored in analytics metadata.

## Duplicate control

Every event request carries a UUID. `commerce_events.id` is the primary key and inserts use `ON CONFLICT DO NOTHING`.

For page views, the storefront adds a second lightweight guard:

- an in-memory key prevents duplicate React-effect calls in the same page lifetime;
- `sessionStorage` suppresses another view event for the same store/product route during the browser session.

This is reasonable MVP deduplication, not person-level identity tracking.

## Failure behavior

Analytics is non-critical to storefront rendering.

`store_view` and `product_view` are sent fire-and-forget. Network/provider errors are swallowed by the storefront and do not prevent a customer from browsing products.

The WhatsApp handoff is different because #7 requires the click to be recorded before opening WhatsApp. If that tracked handoff fails, the UI shows a retryable error instead of silently claiming the event happened.

## Merchant metrics

The authenticated dashboard supports 7, 30 and 90 day windows.

Metrics:

- storefront views;
- product views;
- WhatsApp clicks;
- view → WhatsApp click-through rate: `whatsapp_order_click / product_view`;
- top products by WhatsApp clicks, then product views.

Every dashboard query first verifies the authenticated owner's `store_members` relationship. Another tenant receives the same 404 boundary used elsewhere in the API.

## Future changes

New events require:

1. a concrete observable user action;
2. a documented business meaning;
3. no unnecessary PII;
4. tenant-safe aggregation;
5. explicit distinction between observed intent and inferred commercial outcomes.

Do not add `purchase` until Commerce Factory has reliable evidence that a transaction actually completed.
