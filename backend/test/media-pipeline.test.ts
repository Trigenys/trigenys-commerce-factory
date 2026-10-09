import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.ts";
import type {
  CommerceRepository,
  MediaBucket,
  MediaBucketObject,
  MediaCreateInput,
  MediaObject,
  ProductInput,
  PublicEventMetadata,
  PublicEventName,
  PublicMediaObject,
  PublicStorefront,
  StoreAnalytics,
  StoreCreateInput,
  StorePatch
} from "../src/types.ts";

const storeId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";

class FakeMediaBucket implements MediaBucket {
  objects = new Map<string, {
    bytes: Uint8Array;
    contentType: string;
  }>();

  async put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | Blob | ReadableStream | string,
    options?: {
      httpMetadata?: {
        contentType?: string;
        cacheControl?: string;
      };
      customMetadata?: Record<string, string>;
    }
  ) {
    let bytes: Uint8Array;
    if (value instanceof Uint8Array) {
      bytes = value;
    } else if (value instanceof Blob) {
      bytes = new Uint8Array(await value.arrayBuffer());
    } else if (value instanceof ArrayBuffer) {
      bytes = new Uint8Array(value);
    } else if (typeof value === "string") {
      bytes = new TextEncoder().encode(value);
    } else if (ArrayBuffer.isView(value)) {
      bytes = new Uint8Array(
        value.buffer,
        value.byteOffset,
        value.byteLength
      );
    } else {
      throw new Error("unsupported fake bucket input");
    }

    this.objects.set(key, {
      bytes: new Uint8Array(bytes),
      contentType: options?.httpMetadata?.contentType || "application/octet-stream"
    });
  }

  async get(key: string): Promise<MediaBucketObject | null> {
    const value = this.objects.get(key);
    if (!value) return null;
    return {
      body: new Blob([value.bytes]).stream(),
      httpMetadata: {
        contentType: value.contentType,
        cacheControl: "public, max-age=31536000, immutable"
      }
    };
  }

  async delete(key: string) {
    this.objects.delete(key);
  }
}

class FakeMediaRepository implements CommerceRepository {
  media = new Map<string, MediaObject>();
  publicAttached = new Set<string>();

  async listOwnedStores() { return []; }
  async createOwnedStore(_subject: string, _input: StoreCreateInput) {
    return { kind: "owner_exists" as const };
  }
  async getOwnedStore() { return null; }
  async updateOwnedStore(_subject: string, _storeId: string, _patch: StorePatch) {
    return { kind: "not_found" as const };
  }
  async publishOwnedStore() { return { kind: "not_found" as const }; }
  async getPublicStorefront(): Promise<PublicStorefront | null> { return null; }
  async listOwnedProducts() { return []; }
  async createOwnedProduct(_subject: string, _storeId: string, _input: ProductInput) {
    return { kind: "store_not_found" as const };
  }
  async updateOwnedProduct() { return { kind: "not_found" as const }; }
  async archiveOwnedProduct() { return false; }
  async duplicateOwnedProduct() { return null; }
  async recordPublicEvent(
    _eventId: string,
    _eventName: PublicEventName,
    _storeSlug: string,
    _productSlug: string | null,
    _metadata: PublicEventMetadata
  ) { return false; }
  async getOwnedStoreAnalytics(): Promise<StoreAnalytics | null> { return null; }

  async createOwnedMediaObject(
    subject: string,
    input: MediaCreateInput
  ): Promise<MediaObject | null> {
    const allowed =
      subject === "merchant-1" &&
      input.storeId === storeId &&
      (
        (input.kind === "logo" && input.productId === null) ||
        (input.kind === "product" && input.productId === productId)
      );
    if (!allowed) return null;

    const media: MediaObject = {
      id: input.id,
      publicId: input.publicId,
      storeId: input.storeId,
      productId: input.productId,
      kind: input.kind,
      objectKey: input.objectKey,
      contentType: input.contentType,
      byteSize: input.byteSize,
      publicUrl: null
    };
    this.media.set(media.publicId, media);
    return media;
  }

  async getOwnedMediaObject(
    subject: string,
    requestedStoreId: string,
    mediaId: string
  ) {
    if (subject !== "merchant-1" || requestedStoreId !== storeId) return null;
    return [...this.media.values()].find((media) => media.id === mediaId) || null;
  }

  async getOwnedMediaObjectByPublicId(
    subject: string,
    requestedStoreId: string,
    publicId: string
  ) {
    if (subject !== "merchant-1" || requestedStoreId !== storeId) return null;
    return this.media.get(publicId) || null;
  }

  async deleteOwnedMediaObject(
    subject: string,
    requestedStoreId: string,
    mediaId: string
  ) {
    const media = await this.getOwnedMediaObject(
      subject,
      requestedStoreId,
      mediaId
    );
    if (!media) return false;
    this.media.delete(media.publicId);
    this.publicAttached.delete(media.publicId);
    return true;
  }

  async deleteOwnedMediaObjectByPublicId(
    subject: string,
    requestedStoreId: string,
    publicId: string
  ) {
    const media = await this.getOwnedMediaObjectByPublicId(
      subject,
      requestedStoreId,
      publicId
    );
    if (!media) return false;
    this.media.delete(publicId);
    this.publicAttached.delete(publicId);
    return true;
  }

  async getPublicMediaObject(
    publicId: string
  ): Promise<PublicMediaObject | null> {
    if (!this.publicAttached.has(publicId)) return null;
    const media = this.media.get(publicId);
    if (!media) return null;
    return {
      objectKey: media.objectKey,
      contentType: media.contentType,
      byteSize: media.byteSize
    };
  }
}

function webpBlob(size = 64): Blob {
  const bytes = new Uint8Array(Math.max(12, size));
  bytes.set([
    0x52, 0x49, 0x46, 0x46,
    0x00, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50
  ]);
  return new Blob([bytes], { type: "image/webp" });
}

function mediaApp(repository: FakeMediaRepository, bucket: FakeMediaBucket) {
  const app = createApp({
    repositoryFactory: () => repository,
    verifyIdentity: async (token) => {
      if (token === "merchant-1" || token === "merchant-2") {
        return { subject: token };
      }
      throw new Error("invalid");
    }
  });

  const env = {
    TRIGENYS_COMMERCE_FACTORY_DATABASE_URL: "postgresql://fake",
    TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL:
      "https://auth.example.neon.tech/neondb/auth",
    TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN:
      "https://trigenys-commerce-factory.pages.dev",
    MEDIA_BUCKET: bucket
  };

  return { app, env };
}

async function upload(
  app: ReturnType<typeof mediaApp>["app"],
  env: ReturnType<typeof mediaApp>["env"],
  token: string,
  file: Blob,
  kind: "logo" | "product" = "product"
) {
  const form = new FormData();
  form.set("kind", kind);
  if (kind === "product") form.set("productId", productId);
  form.set("file", file, "image.webp");

  return await app.request(
    "/v1/admin/stores/" + storeId + "/media",
    {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: form
    },
    env
  );
}

test("owner uploads an optimized WebP with a generated private key", async () => {
  const repository = new FakeMediaRepository();
  const bucket = new FakeMediaBucket();
  const { app, env } = mediaApp(repository, bucket);

  const response = await upload(app, env, "merchant-1", webpBlob());
  assert.equal(response.status, 201);
  const body = await response.json() as { media: MediaObject };
  assert.equal(body.media.kind, "product");
  assert.equal(body.media.productId, productId);
  assert.match(
    body.media.objectKey,
    new RegExp(
      "^stores/" + storeId + "/products/" + productId +
      "/[0-9a-f-]{36}\\.webp$",
      "i"
    )
  );
  assert.match(body.media.publicUrl || "", /\/v1\/media\/[0-9a-f-]{36}$/i);
  assert.equal(bucket.objects.size, 1);
});

test("cross-tenant upload is rolled back from storage", async () => {
  const repository = new FakeMediaRepository();
  const bucket = new FakeMediaBucket();
  const { app, env } = mediaApp(repository, bucket);

  const response = await upload(app, env, "merchant-2", webpBlob());
  assert.equal(response.status, 404);
  assert.equal(bucket.objects.size, 0);
  assert.equal(repository.media.size, 0);
});

test("unsupported and oversized files are rejected before R2", async () => {
  const repository = new FakeMediaRepository();
  const bucket = new FakeMediaBucket();
  const { app, env } = mediaApp(repository, bucket);

  const pngForm = new FormData();
  pngForm.set("kind", "product");
  pngForm.set("productId", productId);
  pngForm.set(
    "file",
    new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
    "image.png"
  );

  const unsupported = await app.request(
    "/v1/admin/stores/" + storeId + "/media",
    {
      method: "POST",
      headers: { Authorization: "Bearer merchant-1" },
      body: pngForm
    },
    env
  );
  assert.equal(unsupported.status, 415);

  const oversized = await upload(
    app,
    env,
    "merchant-1",
    webpBlob(2 * 1024 * 1024 + 1)
  );
  assert.equal(oversized.status, 413);
  assert.equal(bucket.objects.size, 0);
});

test("public media is served only after repository marks it attached", async () => {
  const repository = new FakeMediaRepository();
  const bucket = new FakeMediaBucket();
  const { app, env } = mediaApp(repository, bucket);

  const uploadResponse = await upload(app, env, "merchant-1", webpBlob());
  const uploadBody = await uploadResponse.json() as { media: MediaObject };
  const publicId = uploadBody.media.publicId;

  const hidden = await app.request("/v1/media/" + publicId, {}, env);
  assert.equal(hidden.status, 404);

  repository.publicAttached.add(publicId);
  const visible = await app.request("/v1/media/" + publicId, {}, env);
  assert.equal(visible.status, 200);
  assert.equal(visible.headers.get("content-type"), "image/webp");
  assert.match(
    visible.headers.get("cache-control") || "",
    /immutable/
  );
  assert.equal(visible.headers.get("x-content-type-options"), "nosniff");
});

test("owner can delete by stable public id while another tenant cannot", async () => {
  const repository = new FakeMediaRepository();
  const bucket = new FakeMediaBucket();
  const { app, env } = mediaApp(repository, bucket);

  const uploadResponse = await upload(app, env, "merchant-1", webpBlob());
  const uploadBody = await uploadResponse.json() as { media: MediaObject };
  const publicId = uploadBody.media.publicId;

  const denied = await app.request(
    "/v1/admin/stores/" + storeId + "/media/public/" + publicId,
    {
      method: "DELETE",
      headers: { Authorization: "Bearer merchant-2" }
    },
    env
  );
  assert.equal(denied.status, 404);
  assert.equal(bucket.objects.size, 1);

  const deleted = await app.request(
    "/v1/admin/stores/" + storeId + "/media/public/" + publicId,
    {
      method: "DELETE",
      headers: { Authorization: "Bearer merchant-1" }
    },
    env
  );
  assert.equal(deleted.status, 204);
  assert.equal(bucket.objects.size, 0);
  assert.equal(repository.media.size, 0);
});
