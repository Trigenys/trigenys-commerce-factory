# Commerce Factory user journeys

The release supports catalog sales agreed directly with the seller. Orange Money, MTN MoMo and cash are manual payment methods; the application never moves money or opens WhatsApp automatically after saving a request.

| Person | Entry and available journey | Permissions |
| --- | --- | --- |
| Visitor/buyer | Store → product and variants → persistent cart → saved request and retained receipt → WhatsApp agreement → private order tracking | No account required. The private tracking link omits buyer contact data. |
| Merchant owner | Sign up/log in → business and WhatsApp setup → appearance → first product → publication → dashboard, products, orders, settings, analytics and team | Own store only; confirms payments received outside the app. |
| Staff | Private invitation → invited account and email verification → store workspace | Catalog and fulfillment; no settings, publishing, payment confirmation, analytics or team control. |
| Trigenys support | Authenticated account with an explicit platform grant → support console → ticket reply and store metadata search | No customer-order access and no automatic promotion from merchant ownership. |
| Person needing help | Help/contact → saved support request → private support tracking | Draft and stable retry identity survive tab reload when storage is available. |

Setup also covers a persisted store/product draft, a theme preview and publication after activating a product. Logo/product media controls are keyboard focusable. Invalid cached drafts are rejected rather than trapping the workspace in a recovery loop.

Public pages are `/help`, `/contact`, `/privacy`, `/terms`, private support tracking, private order tracking and a recoverable missing-page state. Account forms include password visibility, code recovery, resend delay, email verification, meaningful error/loading states, and FR/EN. Navigation respects store roles. Merchant drafts and carts survive the documented interruptions; unavailable storage is disclosed.

Support grants are an operational action. First verify the intended support account and its Neon subject, then insert that subject with role `support` into `platform_members` on the intended environment. Do not grant every merchant, infer a role from an email domain, or ship a support fixture account into production. Removing that row removes platform access. The current platform schema grants ticket/store-metadata support only, not tenant administration.

Verification combines the backend suite, isolated PostgreSQL 17 integration checks, Playwright buyer/owner/staff/support flows with the installed Auth SDK, automated accessibility and viewport checks, and real staged Auth/JWT/Worker/database round trips. Browser mocks are labeled separately from live provider checks. Real email receipt, comprehensive manual accessibility testing and user studies remain explicit follow-up evidence; automated rules alone do not establish complete WCAG or UX conformity.
