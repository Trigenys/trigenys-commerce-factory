# Passwordless email links

Commerce Factory reuses the installed Neon Auth SDK (`signIn.magicLink`) and the existing identity/Worker authorization boundary. Google and email/password access remain available. No new OAuth client, account database, email service, package or token-verification endpoint is introduced.

## Controlled activation

The option is off by default (`VITE_MAGIC_LINK_ENABLED=false`). Enable the matching Neon branch before setting that frontend build variable to `true`; the UI flag does not enable the provider plugin.

Existing project: `little-frog-93793324`.

- Staging: `br-dry-cell-b2hsrgii` / `commerce-journeys-57-staging`, frontend `commerce-factory-journeys.pages.dev`.
- Production: `br-round-boat-b2wfvalr` / `commerce-factory`, frontend `trigenys-commerce-factory.pages.dev`.

For each intended environment, in Neon Console → project → correct branch → Settings → Better Auth → Magic Link:

1. Enable Magic Link. Choose a short validity period, initially 10 minutes.
2. Enable Allow New User Registration to support the signup UI. The existing signup form requires terms acceptance; the login form explains account creation and links to the terms/privacy policy, as the Google login flow does.
3. Verify that the exact frontend origin is trusted. Both current frontend origins were already configured on staging; check the production branch independently.
4. Verify the email sender. The inspected setup uses shared Neon SMTP for development. Configure the production sender using Neon's email settings before releasing public email-based access. Do not commit or copy SMTP credentials into issues.
5. Set `VITE_MAGIC_LINK_ENABLED=true` for the corresponding Cloudflare Pages production build and redeploy the same checked source. Preview builds remain off unless intentionally enabled and their origin is trusted.

The installed Neon connector can read the existing Auth integration and trusted domains, but its `update_auth_config` tool only exposes the application name. It does not expose Magic Link plugin settings. This change does not claim that enabling the frontend activates that provider setting.

## User journey

Choose “Lien par email” / “Email link”, enter an email (and name/terms for signup), then request a link. A neutral confirmation avoids disclosing whether an account exists. The form prevents concurrent submissions, offers a 30-second resend delay and keeps Google/password alternatives. Delivery errors are recoverable and never display a sent confirmation.

Neon creates and redeems the email token, establishes the session and redirects to `/app/email-link`. The installed SDK restores that session. The app resumes a validated internal destination and selected store; an invitation secret stays in the requesting tab and never enters the callback URL or provider request. With another tab/device, missing/expired return context falls back to `/app`; reopen an invitation in the authenticated tab if needed. Store-setup drafts remain in their existing browser storage.

Expired, reused or sessionless links return to account access with a request-new-link message. Provider errors are not echoed into HTML. Email tokens are never stored or redeemed by Commerce Factory. Tenant membership and role checks still use the verified Neon subject, not the email supplied to this form.

## Evidence and release limits

`npm run test:magic-link` runs browser interactions with the installed SDK and isolated provider/API fixtures: desktop/mobile, French/English, signup consent, send/pending/success/failure/retry, resend delay, session reload, existing-store/new-merchant destinations, invitation privacy, safe fallback and expired-link recovery. Reports explicitly label simulated email/provider responses.

Before enabling publicly, verify with an owned mailbox on staging: real email receipt, first redemption/session restoration, single-use rejection, expiry, sign-out/sign-in, new-account onboarding and Worker/database persistence. Repeat the login check against production after its provider/sender/domain configuration is complete. A green browser fixture suite is not proof of email delivery or live redemption.

RAIDER: reuse the managed provider and current SDK; keep email delivery and identity validation in Neon; prevent duplicate UI submission and retain provider-side limits; store only expiring return context in browser storage; gate rollout per environment; retain existing auth methods and explicitly separate mocked/live evidence.

Primary references: https://neon.com/docs/auth/guides/plugins/magic-link and https://github.com/neondatabase/neon-js/tree/main/examples/neon-auth-magic-link-example.
