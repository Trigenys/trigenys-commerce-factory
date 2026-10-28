# Branded authentication emails

Implemented by Codex at the user's explicit request to reuse Roadmap Mentor's email mechanism.

## Existing mechanism and choice

Inspected `EagleFox31/RoadmapMentor` at `03ab038d8ccd1d2085add92657beb7bd3931b076`:

- `server/services/emailService.ts`: Resend, `RESEND_API_KEY`, `MAIL_FROM`;
- `server/services/emailLayout.ts`: pure layout, `escapeHtml`, inline CTA;
- `server/services/emailTemplates.ts`: purpose-specific pure templates;
- `docs/walkthrough-branded-emails.md`: separation of rendering and transport.

Commerce Factory reuses that structure and delivery provider. Its existing Worker uses the Resend HTTP API with native `fetch`, avoiding another SDK for one endpoint. The templates adapt the Roadmap layout to Commerce Factory's cream, green and coral brand. Roadmap Mentor itself is unchanged; its users, authentication, database and secrets are not copied.

Custom SMTP alone would keep Neon's email content. A branch-scoped `send.magic_link` webhook is necessary to control both sender and templates. Keep Managed Better Auth and the installed Neon client. Neon still generates and redeems each single-use token; our Worker only verifies the signed delivery event and sends its existing `link_url`.

## Implementation

- `POST /v1/webhooks/neon-auth` in the existing API; no generic public email-send endpoint.
- `auth-email-webhook.ts`: raw body limited to 32 KiB, detached Ed25519/JWS verification through the configured branch's cached JWKS, matching key IDs and event headers, five-minute past/one-minute future timestamp window, endpoint and Auth URL scoping. `jose` is already a dependency.
- `email-layout.ts` and `auth-email-templates.ts`: escaped recipient/name, inline table layout, branded logo and accessible CTA, security/expiry note, matching HTML and plain text. The giant raw link appears only in the text alternative; the HTML fallback is a labeled hyperlink.
- `email-delivery.ts`: Resend HTTPS API, secret server-side key, no redirects, 2.5-second abort timeout, success only after a valid accepted message ID. Failure returns a generic retryable 503, never the provider's raw body.
- Idempotency is delegated to Resend's durable 24-hour idempotency facility, keyed by endpoint + event type + event UUID. Retry payloads are deterministic, including expiry and footer year, even across clocks/year boundaries. No token/OTP ledger or new database migration is needed.
- No payloads, recipients, tokens, OTPs or API keys are logged. Authentication events are not marketing subscriptions.
- Link requests carry `lang=fr|en` in their app callback alongside the correlation UUID. No invitation token is sent. The webhook accepts that locale only for `/app/email-link` on this environment's configured web origin.
- Templates also handle email verification/password-reset links and six-digit email OTPs. OTP events have no locale in the documented Neon envelope, so they use `AUTH_EMAIL_DEFAULT_LANGUAGE` (`fr` by default). Do not claim automatic locale detection for those events. SMS events fail explicitly and must not be subscribed to this email-only handler.

## Configuration and activation

New server-only bindings:

- `RESEND_API_KEY`: secret; provision through Cloudflare's secret input. Reuse the existing Resend account and verified `trigenys.com` domain. An app-specific sending key can be used; do not publish or extract Roadmap's runtime key.
- `AUTH_EMAIL_ENABLED`: `true` only once the transport is configured. Absent/false returns 503 without contacting JWKS or Resend.
- `MAIL_FROM`: optional; default `Commerce Factory <commercefactory@trigenys.com>`.
- `AUTH_EMAIL_DEFAULT_LANGUAGE`: optional `fr` or `en`; default `fr`.

Uses the existing environment-specific `TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL` and `TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN`. `/v1/config` does not expose any new binding. Existing password/Google flows, tenant access, stores and product data are unchanged.

Start with staging only:

1. Deploy the checked Worker bundle to `commerce-factory-journeys-api`, retaining its existing secret and R2/rate-limit bindings. Deploy frontend from the same checked commit.
2. Securely add `RESEND_API_KEY` to that Worker; validate that `trigenys.com` is verified for sending in the existing Resend account. An alias in Spacemail is not proof of Resend domain/key configuration. Incoming replies still arrive in Spacemail; this path does not need its SMTP password.
3. Set `AUTH_EMAIL_ENABLED=true`. Confirm unsigned requests are rejected with 401. Do not enable a Neon webhook while the endpoint reports missing configuration.
4. On Neon project `little-frog-93793324`, **branch `br-dry-cell-b2hsrgii` (`commerce-journeys-57-staging`)**, configure HTTPS URL `https://commerce-factory-journeys-api.lawrynnjennifer.workers.dev/v1/webhooks/neon-auth`, select **only `send.magic_link`** initially, timeout 5 seconds. Do not select user lifecycle or phone events. This event subscription replaces Neon's built-in link emails.
5. Request a fresh magic link in the staging login with an owned mailbox. Verify sender/subject/content, inbox receipt, click, restored session and correct merchant workspace. Do not save real magic-link URLs in screenshots, PRs or logs. A 200 from Resend proves acceptance, not inbox delivery or token redemption.
6. `send.otp` can be enabled after verifying existing verification/password-reset journeys and choosing the default language. Until then Neon retains those built-in emails.
7. Activate production separately after staging evidence, using production branch `br-round-boat-b2wfvalr` and its own Worker/secret/configuration. Never change the project's default branch or other applications.

Rollback: disable Webhooks on the affected Neon branch (`enabled:false`) to restore built-in delivery immediately. Then unset/disable `AUTH_EMAIL_ENABLED` if necessary. Rolling back code alone while a webhook is subscribed would break that branch's email delivery.

## Verification and evidence

- Backend tests sign real detached Ed25519/JWS events with a test key; HTTP providers are fixtures. Cases cover branch isolation, exact raw bytes, invalid/missing signatures, wrong algorithms/key IDs, stale/future timestamps, altered event headers, unsupported/SMS events, unsafe links/recipients, expiry, limits, stable idempotent retries, FR/EN selection, OTPs, provider errors and timeout.
- `npm run test:magic-link`: installed SDK fixture journey also checks callback language propagation.
- `npm run test:auth-emails`: four desktop/mobile HTML previews, plain-text artifacts, real repository logo, overflow and serious/critical WCAG checks. Artifacts use fictional addresses/codes/tokens exclusively.
- Run the full backend typecheck/tests, PostgreSQL integrations and Worker bundle check in CI before release.

At implementation time the live Workers have **no `RESEND_API_KEY` binding**, and Neon staging is delivering through its default provider (user screenshot confirms receipt). No webhook was enabled by this source change. Real branded delivery and token redemption remain unverified until the secure configuration and staging test above are completed.

## RAIDER review

- **Risks:** a subscribed delivery webhook is blocking; deployment/secrets must precede the branch toggle. Resend acceptance is not inbox delivery.
- **Assumptions:** use the existing Resend account/domain from Roadmap Mentor, not its application server as an email relay.
- **Issues:** no Resend secret is currently bound to Commerce Factory. OTP locale is absent from Neon's documented event.
- **Dependencies:** existing Neon Auth, existing `jose`, existing Cloudflare Worker, Resend delivery. No new service, dependency, migration, OAuth app or Neon branch.
- **Evidence:** pinned Roadmap sources, backend signature/delivery tests, SDK journey checks, rendered CI artifacts; live proof must be recorded separately.
- **Results:** branded-email capability with explicit activation and rollback. Reusable rendering/transport boundaries, environment-scoped events, durable provider idempotency and backward-compatible opt-in behavior.

Primary references checked 2026-10-28:

- https://neon.com/docs/auth/guides/webhooks
- https://neon.com/docs/auth/guides/customize-emails
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/dashboard/emails/idempotency-keys
- https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/
