# Branded auth emails through Trigenys Notify

Implemented at the user's request to reuse Roadmap Mentor's branded template structure, then centralize email delivery in **Trigenys Notify**.

## Current architecture

Neon Auth → signed Commerce Factory webhook → branded HTML/text → private Notify email API → Spacemail SMTP.

Commerce Factory owns its existing logo, FR/EN content, return context, verified branch identity and Neon link. Notify owns the SMTP credentials, per-product sender policy, durable D1 receipts and failure handling. Neon continues to generate and redeem tokens. No new Commerce database, SMTP library, SMTP password or Resend key is needed.

The template/layout separation from Roadmap Mentor remains. The transport now uses Trigenys Notify's existing server-authenticated dispatch pattern, rather than copying a provider client into each product. The Notify change extends its existing D1/claim boundaries for short-lived transactional email; it does not reuse its staff/group event schema for auth links.

## Existing webhook guarantees

POST /v1/webhooks/neon-auth still verifies the exact raw body (32 KiB limit), detached Ed25519/JWS signature through this branch's cached JWKS, matching event/key headers, timestamp freshness, endpoint identity, recipient and Auth URL. Only a validated event can reach Notify. No raw token field is forwarded separately, and no email body, recipient, OTP or link is logged.

Link requests carry the UI language in their configured app callback. Templates retain the logo, green/cream/coral colors, inline CTA, readable expiry, security text, HTML fallback hyperlink and complete text alternative. OTP locale is absent from Neon's documented envelope, so OTP events use AUTH_EMAIL_DEFAULT_LANGUAGE (fr by default). Never subscribe SMS events to this email-only handler.

## Notify contract

POST {NOTIFY_EMAIL_BASE_URL}/v1/dispatch/commerce-factory/email with x-notify-auth and JSON:

- version 1, fixed project commerce-factory;
- id: SHA-256 of the existing endpoint/type/event UUID delivery identity;
- occurredAt and expiresAt: immutable dates from the signed Neon event;
- one recipient;
- message: subject, HTML and text from our existing pure renderer.

The sender is configured in Notify, never supplied by a browser or this payload. Retries keep the same event ID and content. The client accepts only HTTP 202 with accepted:true, matching project, channel=email and eventId. Redirects are handled manually and rejected, so the service key is never forwarded. Timeout is 6.5 seconds. Errors and ambiguous responses produce a sanitized retryable webhook failure, never a delivery-success claim.

Notify performs an atomic D1 claim per product/event. Accepted events are not resent; changed content conflicts; confirmed pre-acceptance failures can retry up to three times. An interrupted DATA transaction or lost receipt write is left unresolved rather than blindly resent. SMTP Message-ID is not treated as provider idempotency. See the Notify runbook for these practical limits.

## Configuration

Commerce Worker server-only bindings:

- AUTH_EMAIL_ENABLED: absent/false until the full chain is ready;
- NOTIFY_EMAIL_BASE_URL: HTTPS root origin of the matching Notify environment;
- NOTIFY_EMAIL_SERVICE: optional Cloudflare HTTP service binding to the matching Notify Worker. Prefer it for Worker-to-Worker delivery. When present, it is the only delivery transport and retains x-notify-auth; a failed private call never falls back to a public host;
- NOTIFY_EMAIL_INGEST_KEY: secret scoped to Commerce email;
- optional AUTH_EMAIL_DEFAULT_LANGUAGE: fr or en;
- optional AUTH_EMAIL_PARENT_ENDPOINT_ID: one explicitly verified parent context label for a cloned branch. It applies only to signed magic-link events whose original verification URL remains on this Worker's configured Auth origin and database path; parent-origin links, other context labels and parent-labeled OTPs remain rejected. It is absent by default and is not exposed in public config;
- existing Auth base URL and web origin remain unchanged.

RESEND_API_KEY and MAIL_FROM are no longer read by Commerce Factory. Configure sender Commerce Factory <commercefactory@trigenys.com> and Spacemail's SMTP_USER/SMTP_PASSWORD **in Notify**, not here. The SMTP login uses the actual parent mailbox behind the alias. Do not publish or copy mailbox passwords into a repository or chat.

The browser's /v1/config response is unchanged and exposes neither the Notify service key nor SMTP credentials.

## Staging rollout

1. Merge and validate both repositories. Apply Notify's additive migration 0004_transactional_email.sql to its existing staging D1; retain existing group routes, assets, crons and provider flags.
2. Deploy Notify and Commerce's checked Worker bundles. Provision a shared product-specific ingest key on the two services and the email sender policy in Notify.
3. Securely configure Spacemail credentials in Notify. Verify SMTP acceptance and owned-mailbox delivery before enabling the auth webhook.
4. Enable Notify email and Commerce AUTH_EMAIL_ENABLED. On Neon project little-frog-93793324, branch br-dry-cell-b2hsrgii (commerce-journeys-57-staging), enable only send.magic_link, HTTPS URL https://commerce-factory-journeys-api.lawrynnjennifer.workers.dev/v1/webhooks/neon-auth, **10-second per-attempt timeout**. Total provider delivery budget is 15 seconds.
5. Request a fresh link from the existing staging login, check sender/content/receipt, then click and verify the session and correct merchant workspace. Do not record live link URLs in screenshots, logs or PRs. Existing email OTPs stay with Neon until separately verified/enabled.
6. Roll production out separately, against production Notify resources and credentials. Never point production auth at staging as an implicit fallback.

Rollback: first disable the affected Neon branch's Webhooks (enabled:false), restoring built-in delivery. Only then disable the product/Notify email flags if needed. A code-only rollback while Neon still requires the webhook would break mail delivery.

## Evidence and limits

- Backend tests sign real test-key Neon events and exercise the updated Notify wire contract, stable retry identity, branch/signature isolation, FR/EN templates, redirects, timeout, disabled/missing configuration and provider/acceptance failures.
- Existing backend and isolated PostgreSQL journey checks remain part of CI.
- `npm run test:runtime` bundles the deployment Worker and runs its signed-email route in workerd, with outbound requests restricted to fixtures. It covers real JWKS retrieval, signature verification, branded Notify dispatch, tampering and rejected JWKS redirects. It is included in `npm run check` and sends no real email.
- Existing email-rendering and SDK magic-link CI checks remain unchanged.
- Notify tests cover actual SQLite migrations, concurrent claims, uncertain SMTP outcomes and real Nodemailer/TLS/MIME against a local fixture SMTP server. Its workerd/D1 smoke exercises the actual bundled SMTP failure path and existing WhatsApp routes.
- These fixtures prove code behavior, not real Spacemail receipt or Neon redemption. Those remain unverified until SMTP secrets and a real owned-mailbox test are completed.

Notify's contract/runbook is docs/transactional-email.md in Trigenys/trigenys-notify. No direct SMTP implementation or additional ledger is added to Commerce Factory.

### Runtime regression found during staging verification (2026-10-29)

The first real Neon request failed before Notify and left no D1 email receipt. The custom JWKS fetch override used `redirect:"error"`, which Node accepts but workerd rejects while constructing the request. As a result, no JWKS network request could run and the webhook returned `WEBHOOK_VERIFICATION_UNAVAILABLE`.

The override now uses `manual`. JOSE already requires an HTTP 200 response, so redirected key sets are rejected without following their target. The new workerd check reproduces the original failure against the old deployment bundle and covers the fixed path; Node mocks alone are insufficient for this platform boundary. If a delivery test fails, first disable the Neon staging webhook to restore its built-in mail before diagnosing transport or credentials.

The next live request verified its signature but reported the configured parent endpoint (`ep-plain-wave-b23ip5pe`) in its context while being requested through staging (`ep-soft-river-b2at40xx`). The parent relationship and both Auth URLs were verified in the console; production Webhooks remained disabled. Staging can opt into the single explicit parent label with AUTH_EMAIL_PARENT_ENDPOINT_ID. This does not authorize production verification links: their origin/path still fails the existing strict link check. OTPs retain exact context matching. Failed signed requests log only fixed error/phase codes and bounded public endpoint identifiers, never email addresses, payloads, links, tokens or credentials.

Once the signed staging link passed validation, public Worker-to-Worker delivery failed before a Notify receipt was claimed. The staging consumer therefore binds NOTIFY_EMAIL_SERVICE directly to trigenys-notify-staging-api, using Cloudflare's supported internal HTTP transport. The API URL remains a routing/contract value; product-scoped authentication is still required. Production must receive its own matching binding during its separate rollout, never a staging fallback. The workerd smoke exercises a real service binding in addition to the external HTTP fixture.

## RAIDER

Reuse: Roadmap rendering and Notify's per-project dispatch/D1 conventions, plus Nodemailer in Notify. Agnostic boundary: Commerce requests transactional delivery without owning a provider. Idempotency/durability: Notify's central receipt. Engineering: strict signed-event checks, secret isolation, verified TLS, bounded calls and explicit ambiguous-state handling. Retroactive adoption: flags off by default; password/Google, store data and existing Notify channels stay on their established flows.
