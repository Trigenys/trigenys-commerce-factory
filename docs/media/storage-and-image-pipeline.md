# Media storage and image pipeline

Status: MVP implementation  
Related: #10, ADR-001

## Storage boundary

Commerce Factory stores merchant-controlled product/store media in a private Cloudflare R2 bucket:

`trigenys-commerce-factory-media`

The bucket is not exposed through `r2.dev`.

The product Worker receives the bucket as the `MEDIA_BUCKET` binding and is the only delivery boundary.

## Upload flow

1. Merchant selects JPEG, PNG or WebP.
2. The browser decodes the image and rejects invalid or extreme dimensions.
3. The browser resizes to at most 1600 px and encodes WebP at ~82% quality.
4. If the result exceeds 2 MiB, it retries at max 1200 px and ~72% quality.
5. The Worker accepts only `image/webp`, verifies the WebP RIFF signature and rejects anything above 2 MiB.
6. The Worker generates the object key; the browser never chooses the R2 key.
7. The object is written to R2 and its tenant-owned metadata is committed to Neon.
8. The product editor previews the uploaded object privately. Click Save to attach its stable public URL to the product; uploading alone does not save the product form. Successful files remain in the draft if a later file in the same selection fails.

Source files above 12 MiB are rejected before browser decoding.

## Object keys

Product image:

`stores/{storeId}/products/{productId}/{uuid}.webp`

Store logo:

`stores/{storeId}/logo/{uuid}.webp`

Object keys are never accepted from the client.

## Tenant isolation

Upload metadata is inserted only when:

- the authenticated subject is an owner of the store;
- product media references a product that belongs to that same store;
- logo media has no product ID.

Cross-tenant uploads are rolled back from R2.

Delete operations resolve the media record through the authenticated store membership before deleting the R2 object.

## Public delivery

Public URLs use an opaque UUID:

`/v1/media/{publicId}`

The Worker resolves that UUID server-side.

A media object is served only when:

- its store is published; and
- a logo is the store's currently referenced logo; or
- a product image belongs to an active product and is still referenced in that product's image list.

Responses are WebP, immutable-cacheable and include `X-Content-Type-Options: nosniff`.

The R2 object key is never exposed as a public URL.

## Authenticated merchant preview

`GET /v1/admin/stores/{storeId}/media/public/{publicId}` streams an existing media object after validating the merchant session and store membership. The owner can preview product media and logos; a collaborator can preview product media only. Draft, unpublished and not-yet-attached uploads stay unavailable through the public route.

Private responses use `Cache-Control: private, no-store` and vary on Authorization/Origin. The browser sends its JWT in the Authorization header, creates a temporary object URL from the WebP response, and revokes it on source/store/session change or unmount. Tokens and temporary URLs are never stored in product data. The editor, catalog thumbnails, logo and appearance preview share this path and expose loading/failure/retry states.

Validation covers real SQL membership checks (including collaborator restrictions and revocation), missing/invalid sessions, cross-store access, public-route denial, binary delivery, upload/save/reload, partial-upload recovery and object-URL cleanup. Browser cases use isolated fixtures, not a real merchant's products.

RAIDER — Risk: exposing private draft media or persisting a temporary URL. Assumption: an uploaded object can exist before the product form is saved. Issue: public delivery deliberately rejects those objects. Dependencies: existing Auth, membership lookup and R2 binding; no schema or dependency changes. Evidence: media API, PostgreSQL integration and rendered catalog checks. Result: private merchant previews with stable saved references and unchanged public visibility rules.

## Cleanup

Normal cleanup:

- replacing/removing a managed store logo deletes the old R2 object after the store reference is updated;
- removing a managed product image deletes the old R2 object after the product reference is updated;
- cross-tenant or failed metadata writes trigger best-effort R2 rollback.

Possible orphans can still exist when a browser uploads an image and abandons the editor before saving, or when storage deletion fails after the relational update.

The periodic orphan sweep should:

1. list `media_objects` older than a safety window (for example 24 h);
2. keep rows currently referenced by `stores.logo_url` or `products.image_urls`;
3. delete unreferenced R2 objects;
4. delete their `media_objects` rows;
5. emit only aggregate cleanup metrics, never object URLs or tenant secrets.

Do not automatically delete archived-product media until the retention policy is explicitly decided.

## Abuse and cost controls

MVP controls:

- accepted source types: JPEG, PNG, WebP;
- source limit: 12 MiB;
- stored-object limit: 2 MiB;
- WebP-only canonical storage;
- max 8 product images enforced by catalog validation;
- deterministic tenant namespacing;
- no direct public R2 domain;
- immutable browser caching for attached public images.

Before larger public rollout, add request-rate limits to the upload endpoint and storage-usage quotas per store.

## Cost posture

R2 was chosen because it fits the existing Cloudflare edge boundary and avoids maintaining a separate media credential path in the browser.

The main variable-cost risks are:

- abusive upload volume;
- merchants repeatedly uploading then abandoning images;
- image count growth per product;
- public egress/requests at scale.

The design therefore optimizes before upload and stores only the optimized derivative used by the storefront. Original giant files are not retained by default.

## Infrastructure dependency

AppFactory provisions the private R2 bucket through the canonical infrastructure workflow, then the Worker deployment binds it as `MEDIA_BUCKET`.

The AppFactory Cloudflare resource token must include:

`Workers R2 Storage Edit`

Without that permission, AppFactory fails closed before Worker deployment.

