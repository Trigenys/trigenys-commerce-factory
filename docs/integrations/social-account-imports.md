# Google account access and social business information

Related: #59, #12. Implemented 2026-10-11.

Commerce Factory keeps Managed Neon Auth as its identity system. Google creates or opens an account; business information comes from a separate, owner-authorized social connection. A social connection never grants membership or platform support access.

## Available information

- Facebook Login for Business: select a managed Page, then preview available name, description/about, location and Page contact email.
- Instagram through Facebook Login: select a professional Instagram account linked to an authorized Page; preview its name and biography. Personal Instagram accounts and professional accounts without a linked Page are outside this increment.
- TikTok Login Kit: preview the authorized profile name and, when granted, biography. `user.info.profile` can be declined independently. No email is inferred.

Posts, pictures, products, orders and advertising are not imported. Facebook catalogs and TikTok Shop need separate permissions and commerce adapters; profile access is not catalog access.

The merchant creates their Commerce Factory store first and connects accounts from **Connected accounts**. An import cannot create or publish products. A confirmed profile change on an already published store becomes visible to customers; the preview states this explicitly.

## Google setup

Use the existing Neon Auth configuration on the Commerce branch, not another application's default branch.

1. Use separate Google Cloud projects for test and production, as required by [Google's production-readiness policy](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance). Separate clients in one project are not the documented project separation. Keep `commerce-factory-511320` for production and create a distinct project for the isolated test site. A production Google client must not include test origins or callbacks.
2. Register the provider callback `{NEON_AUTH_BASE_URL}/callback/google`. This is different from the application callback `/app/auth-callback`.
3. Configure the custom Google client in the branch's Neon Auth settings. Supply secrets through the provider configuration, never `VITE_*`, source control or public runtime JSON.
4. Register the frontend origin for the matching Google client and trust that application origin in the matching Neon Auth branch. The isolated staging branch trusts its own Pages origin; use that branch for development. Do not copy the test origin into the production Google client.
5. Verify Google consent, account creation, sign-out/sign-in, page reload, a signed JWT and an existing store with the real provider. Verify invitation email claims separately.
6. Set Worker binding `TRIGENYS_COMMERCE_FACTORY_GOOGLE_SIGN_IN=enabled` only once the custom production application and real consent flow are verified.

Neon's shared Google credentials are for isolated development/testing. Do not enable the production flag using the shared application.

Current activation status (2026-10-12): both dedicated Commerce Auth branches have custom Google credentials. Real first account creation and sign-out/sign-in on staging were confirmed by the merchant, who returned to onboarding because no store exists. Both branches still use the same Google client; move staging to the separate test project before public activation. Google UI is enabled on staging and disabled in production. Reload, protected JWT, existing-store and invitation checks remain to be recorded.

The isolated test client uses only:

- JavaScript origin: `https://commerce-factory-journeys.pages.dev`
- Provider callback: `https://ep-soft-river-b2at40xx.neonauth.c-6.eu-central-1.aws.neon.tech/commerce_factory/auth/callback/google`

The production client uses only:

- JavaScript origin: `https://trigenys-commerce-factory.pages.dev`
- Provider callback: `https://ep-plain-wave-b23ip5pe.neonauth.c-6.eu-central-1.aws.neon.tech/commerce_factory/auth/callback/google`

Configure the test client on `br-dry-cell-b2hsrgii` first. Once verified, remove the test origin and callback from the existing production Google client; its current production client ID and secret can be retained. Credential setup must target one explicit Neon branch at a time, never update both with the same Google JSON. The Windows setup helper defaults to staging, rejects the production project there, validates the matching origin/callback and keeps CLI credential output private.

Google's [audience documentation](https://support.google.com/cloud/answer/15549945?hl=en) exempts sign-in requests limited to basic identity (`openid`, email, profile) from Testing's test-user restriction and seven-day authorization expiry. Do not treat Testing alone as evidence that this basic flow is blocked, or treat that exception as permission to add other scopes. Verify actual audience, branding and requested permissions before a public release.

The installed Neon SDK owns redirects and its iframe popup/session-verifier handling. The Commerce callback stores only a validated merchant destination in tab storage for 15 minutes. Invitation secrets stay in that tab and are never sent to Google/Neon. No account is linked by client-side email matching.

The Google button can create an account when used from the Login tab. That screen explicitly explains automatic creation and displays the terms and privacy links; the Create account tab requires its terms checkbox. This is the implemented UX behavior, not proof of server-side versioned acceptance records or legal compliance.

## Social application setup

All providers require `SOCIAL_TOKENS_KEY`, a base64-encoded random 32-byte AES key held in Worker secrets, and `SOCIAL_RATE_LIMITER` (native binding declared in Wrangler).

Meta:

- `SOCIAL_META_APP_ID`, `SOCIAL_META_APP_SECRET`.
- `SOCIAL_META_GRAPH_VERSION`: the reviewed Graph version, explicitly configured; no implicit version fallback.
- `SOCIAL_FACEBOOK_CONFIG_ID`: Facebook Login for Business configuration for `pages_show_list,pages_read_engagement`.
- `SOCIAL_INSTAGRAM_CONFIG_ID`: configuration for `pages_show_list,pages_read_engagement,instagram_basic`.
- Exact registered redirect URIs: `{API_ORIGIN}/v1/social/callback/facebook` and `{API_ORIGIN}/v1/social/callback/instagram`.

TikTok:

- `SOCIAL_TIKTOK_CLIENT_KEY`, `SOCIAL_TIKTOK_CLIENT_SECRET`.
- Approved Login Kit web scopes: `user.info.basic,user.info.profile`.
- Exact registered redirect URI: `{API_ORIGIN}/v1/social/callback/tiktok`.

Before listing a provider in comma-separated `SOCIAL_APPROVED_PROVIDERS`, verify its application ownership, exact Graph fields/version, granted permissions, review/access requirements and actual business account with the official APIs. Review the consent dialog to ensure the Meta configuration does not request unrelated permissions. Application credentials and app review have not been supplied; all three production connectors remain unavailable. No developer/test access is presented as public merchant access.

Keep callback query strings out of logs and traces (Cloudflare `observability.redact_query_string`). Neither application code nor exception responses log access tokens, authorization codes, app secrets or database strings. Authorization URLs returned to the browser contain only short-lived one-use tickets, not provider tokens.

## Authorization boundary

1. An authenticated owner starts a connection. A ten-minute attempt binds the subject, store, provider and exact Worker callback.
2. A one-use Worker start route sets a Secure, HttpOnly, SameSite=Lax cookie during a top-level visit, then redirects to the provider. This works without depending on third-party cookies in a cross-origin dashboard fetch.
3. The callback requires that browser cookie and single-use state. It exchanges the code and stores only encrypted pending token material.
4. Only the returning browser receives a new completion ticket in a URL fragment. The dashboard removes the fragment and redeems the ticket with a fresh Neon JWT. The same original owner and store must still be authorized.
5. The credential becomes usable only after that final check. Lost completion responses can be retried. Disconnect invalidates attempts and previews, erases tokens locally and preserves already imported shop information. Users can additionally revoke permission in the social service.

AES-GCM binds each credential to the store, provider and connection revision. Provider tokens never reach the frontend. This increment retains an access token until its expiry and requests a new authorization afterwards; it does not retain refresh tokens or run background synchronization. Key rotation must deliberately disconnect/re-authorize affected connections; do not overwrite the key expecting old ciphertext to remain usable.

## Preview and confirmation

The server fetches only authorized assets; Page tokens remain server-side. Provider pagination uses a fixed host and validated cursors, not returned `paging.next` URLs. Requests have bounded timeouts and response sizes. Provider failures affect the optional connection only.

A server-held ten-minute preview contains the proposed fields, their current baseline and the connection revision. Only the owner can see or apply it. The client submits field names, never replacement values. Selected fields are compared with their current baseline before the atomic update. A newer store edit, reconnect, disconnect or expiry blocks stale imports. Repeated confirmation with the same selection returns `already_applied`; a different selection on a used preview is rejected.

Descriptions and names exceeding store limits are visibly shortened in the preview. No fields are selected by default. The merchant can edit imported text in settings. Credentials/attempts that expire are purged on subsequent connection reads/starts; previews older than their expiry plus 24 hours are purged then. This is request-driven cleanup, not a scheduled erasure guarantee.

## Verification

- Root typecheck and production build.
- Backend checks: unit contracts, AES tampering/store binding, scope denial, hostile pagination and authorized asset selection.
- Persisted integration checks: owner/staff/store isolation, cookie/state replay, provider denial, final ticket ownership, import baseline conflicts, concurrent confirmations/disconnect, expiry, optional-provider failure and rate limits. CI runs against PostgreSQL 17; local fallback uses PGlite.
- `npm run test:social`: installed Neon SDK with service fixtures, Google consent/errors/destination/invitation/session restoration, owner previews/import/reload/lost responses, provider failure, staff restrictions, unconfigured services and mobile/desktop accessibility checks.

Fixtures are not proof of real Google consent or approved Meta/TikTok business access. Automated accessibility checks are not a full WCAG certification or user study. Keep #59 open until the applications are configured and those real-provider checks are recorded.

Official references: [Neon OAuth setup](https://neon.com/docs/auth/guides/setup-oauth), [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Facebook Login for Business](https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business), [Pages API](https://developers.facebook.com/documentation/pages-api), [Instagram API with Facebook Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login), [TikTok Login Kit web](https://developers.tiktok.com/docs/en/login-kit-web), [TikTok user information](https://developers.tiktok.com/docs/en/tiktok-api-v2-get-user-info).
