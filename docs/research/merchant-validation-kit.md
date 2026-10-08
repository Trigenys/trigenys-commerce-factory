# Merchant validation kit

Issue: #2  
Goal: validate the problem before expanding the build.

## Hypothesis to test

Small and medium merchants who already sell through WhatsApp, Instagram or Facebook lose time and trust because products, prices and ordering are scattered across chats/posts. A lightweight branded catalog with a direct WhatsApp order handoff should be valuable even without online payment.

## Who to interview

Target 5–10 merchants across:
- electronics/accessories;
- fashion/beauty;
- gifts/flowers;
- general retail;
- Instagram/WhatsApp-first sellers.

Avoid interviewing only friends who will be polite. At least half should already sell regularly online.

## Interview rules

Do not pitch the product for the first 10 minutes. Ask about the merchant's current workflow and concrete recent examples.

Prefer:
- “Show me how you handled your last order.”
- “What happens when a customer sees a product on Instagram?”
- “Where do you update prices?”
- “What do customers ask you repeatedly?”
- “What do you do when an item is unavailable?”

Avoid:
- “Would you use an app that…?”
- “Do you think this is useful?”
- leading yes/no questions.

## Core questions

### Current selling flow

1. Where do customers usually discover your products?
2. Where do you keep the current product list and prices?
3. Walk through the last order you received from discovery to payment/delivery.
4. How often do customers ask for information that was already posted?
5. What happens when a price or stock status changes?
6. How do customers choose variants such as size, color or model?

### Existing tools

7. Do you already have a website, catalog link or online store?
8. If yes, what do you actually use it for?
9. If no, what stopped you from setting one up?
10. Have you tried Shopify, WooCommerce, Selar, a link-in-bio tool, WhatsApp Catalog or another solution? What happened?

### WhatsApp

11. What information do you need in the first WhatsApp message to process an order quickly?
12. How many back-and-forth messages usually happen before an order is clear?
13. Do you need the customer to pay online before chatting, or is chat-first normal for you?

### Analytics and growth

14. Do you know which products generate the most customer inquiries?
15. Do you currently run Facebook/Instagram ads?
16. If yes, who creates them and how do you know whether they produced sales?
17. Would catalog-to-Meta synchronization solve a real current problem or merely be “nice to have”?

### Money

18. Which of these would be worth paying for: custom domain, unlimited products, analytics, no platform branding, social catalog sync?
19. What are you paying today for any website/catalog/ads tooling?
20. At what monthly price would this feel obviously worth it? At what price would it become difficult to justify?

## Prototype test

After the discovery interview, show a simple mock or demo and ask the merchant to complete this task without guidance:

> “Imagine this is your business. Add one product, publish the store and show me how a customer would order it on WhatsApp.”

Observe:
- where they hesitate;
- terminology they misunderstand;
- what they expect to happen after “Publish”;
- whether “Buy on WhatsApp” matches their mental model;
- whether they expect payment, delivery or inventory features automatically.

## Evidence log

For each merchant record:

| Field | Value |
| --- | --- |
| Merchant code | M01, M02… |
| Vertical | |
| Main sales channel | |
| Approx. catalog size | |
| Existing website/catalog | |
| Repeated pain #1 | |
| Repeated pain #2 | |
| Current workaround | |
| Must-have requested | |
| Nice-to-have requested | |
| WhatsApp-first acceptable? | Yes / No / Conditional |
| Willingness to pay | |
| Strong objection | |
| Quote/paraphrase | |
| Outcome | Strong fit / Maybe / Weak fit |

Do not store sensitive customer information or merchant credentials in this research file.

## Decision thresholds

### Proceed

Proceed with the current MVP if at least 5 interviews produce all of:
- 3+ merchants independently describe catalog/update friction;
- 3+ merchants already close sales in WhatsApp;
- at least 2 merchants are willing to trial the product with their real catalog;
- no dominant blocker requires payments/logistics before the catalog has value.

### Narrow

Narrow the product if one vertical has a much stronger repeated pain than the others.

Example: electronics merchants may care more about fast price/catalog changes, while fashion sellers may care more about visual presentation and variants.

### Pivot

Reconsider the proposition if most merchants already solve the problem adequately with WhatsApp Catalog/Instagram and would not pay for a separate storefront.

## Output required to close #2

Create `docs/research/merchant-validation-results.md` containing:
- interview count and merchant mix;
- repeated pains ranked by frequency;
- strongest objections;
- confirmed must-haves;
- features to remove/defer;
- willingness-to-pay evidence;
- recommendation: proceed / narrow / pivot;
- any required backlog changes.

The issue is not complete merely because the interview script exists. It closes only after real evidence is captured.
