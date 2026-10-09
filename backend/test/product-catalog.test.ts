import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.ts";
import type {
  CommerceRepository,
  ProductInput,
  ProductSummary,
  PublicStorefront,
  StoreCreateInput,
  StorePatch,
  StoreSummary,
  StoreUpdateResult
} from "../src/types.ts";

const store: StoreSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Catalog Store",
  slug: "catalog-store",
  status: "published",
  whatsappNumber: "+237670000001",
  countryCode: "CM",
  currencyCode: "XAF",
  description: null,
  businessLocation: "Douala",
  contactEmail: "merchant@example.com",
  theme: "clean",
  logoUrl: null
};

class ProductRepository implements CommerceRepository {
  products: ProductSummary[] = [];
  lastInput: ProductInput | null = null;

  async listOwnedStores(subject: string) {
    return subject === "merchant-1" ? [store] : [];
  }

  async createOwnedStore(_subject: string, _input: StoreCreateInput) {
    return { kind: "owner_exists" as const };
  }

  async getOwnedStore(subject: string, storeId: string) {
    return subject === "merchant-1" && storeId === store.id ? store : null;
  }

  async updateOwnedStore(
    _subject: string,
    _storeId: string,
    _patch: StorePatch
  ): Promise<StoreUpdateResult> {
    return { kind: "not_found" };
  }

  async listOwnedProducts(subject: string, storeId: string) {
    if (subject !== "merchant-1" || storeId !== store.id) return [];
    return this.products;
  }

  async createOwnedProduct(subject: string, storeId: string, input: ProductInput) {
    if (subject !== "merchant-1" || storeId !== store.id) {
      return { kind: "store_not_found" as const };
    }
    if (this.products.some((product) => product.slug === input.slug)) {
      return { kind: "slug_taken" as const };
    }
    this.lastInput = input;
    const product: ProductSummary = {
      id: crypto.randomUUID(),
      storeId,
      ...input
    };
    this.products.push(product);
    return { kind: "created" as const, product };
  }

  async updateOwnedProduct(
    subject: string,
    storeId: string,
    productId: string,
    input: ProductInput
  ) {
    const index = this.products.findIndex(
      (product) =>
        product.id === productId &&
        product.storeId === storeId &&
        subject === "merchant-1"
    );
    if (index < 0) return { kind: "not_found" as const };
    if (
      this.products.some(
        (product, candidate) =>
          candidate !== index && product.slug === input.slug
      )
    ) {
      return { kind: "slug_taken" as const };
    }
    const product: ProductSummary = {
      id: productId,
      storeId,
      ...input
    };
    this.products[index] = product;
    return { kind: "updated" as const, product };
  }

  async archiveOwnedProduct(
    subject: string,
    storeId: string,
    productId: string
  ) {
    const product = this.products.find(
      (candidate) =>
        candidate.id === productId &&
        candidate.storeId === storeId &&
        subject === "merchant-1"
    );
    if (!product) return false;
    product.status = "archived";
    return true;
  }

  async duplicateOwnedProduct(
    subject: string,
    storeId: string,
    productId: string
  ) {
    const product = this.products.find(
      (candidate) =>
        candidate.id === productId &&
        candidate.storeId === storeId &&
        subject === "merchant-1" &&
        candidate.status !== "archived"
    );
    if (!product) return null;
    const copy: ProductSummary = {
      ...product,
      id: crypto.randomUUID(),
      name: product.name + " copy",
      slug: product.slug + "-copy",
      status: "draft",
      sortOrder: product.sortOrder + 1
    };
    this.products.push(copy);
    return copy;
  }

  async publishOwnedStore(subject: string, storeId: string) {
    if (subject !== "merchant-1" || storeId !== store.id) {
      return { kind: "not_found" as const };
    }
    if (!this.products.some((product) => product.status === "active")) {
      return { kind: "active_product_required" as const };
    }
    store.status = "published";
    return { kind: "published" as const, store };
  }

  async recordPublicEvent() { return false; }

  async getOwnedStoreAnalytics() { return null; }

  async createOwnedMediaObject() { return null; }
  async getOwnedMediaObject() { return null; }
  async getOwnedMediaObjectByPublicId() { return null; }
  async deleteOwnedMediaObject() { return false; }
  async deleteOwnedMediaObjectByPublicId() { return false; }
  async getPublicMediaObject() { return null; }

  async getPublicStorefront(slug: string): Promise<PublicStorefront | null> {
    if (slug !== store.slug || store.status !== "published") return null;
    return {
      store: {
        name: store.name,
        slug: store.slug,
        whatsappNumber: store.whatsappNumber,
        countryCode: store.countryCode,
        currencyCode: store.currencyCode,
        description: store.description,
        businessLocation: store.businessLocation,
        theme: store.theme,
        logoUrl: store.logoUrl
      },
      products: this.products
        .filter((product) => product.status === "active")
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((product) => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          currencyCode: product.currencyCode,
          category: product.category,
          stockLabel: product.stockLabel,
          imageUrls: product.imageUrls,
          variants: product.variants
        }))
    };
  }
}

const env = {
  TRIGENYS_COMMERCE_FACTORY_DATABASE_URL: "postgresql://fake",
  TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL:
    "https://auth.example.neon.tech/neondb/auth",
  TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN: "https://commerce.example"
};

function productApp(repository: ProductRepository) {
  return createApp({
    repositoryFactory: () => repository,
    verifyIdentity: async (token) => {
      if (token === "merchant-1") return { subject: token };
      if (token === "merchant-2") return { subject: token };
      throw new Error("invalid");
    }
  });
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Casque Bluetooth",
    slug: "Casque Bluetooth",
    description: "Réduction de bruit active.",
    price: "230000",
    currencyCode: "xaf",
    category: "Audio",
    stockLabel: "En stock",
    status: "draft",
    sortOrder: 20,
    imageUrls: ["https://images.example.com/headphones.jpg"],
    variants: [
      { name: "Couleur", value: "Noir" },
      { name: "Couleur", value: "Blanc" }
    ],
    ...overrides
  };
}

test("merchant creates a normalized product inside own store", async () => {
  const repository = new ProductRepository();
  const app = productApp(repository);
  const response = await app.request(
    "/v1/admin/stores/" + store.id + "/products",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer merchant-1",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload())
    },
    env
  );

  assert.equal(response.status, 201);
  assert.equal(repository.lastInput?.slug, "casque-bluetooth");
  assert.equal(repository.lastInput?.price, "230000.00");
  assert.equal(repository.lastInput?.currencyCode, "XAF");
  assert.equal(repository.lastInput?.imageUrls.length, 1);
  assert.equal(repository.lastInput?.variants.length, 2);
});

test("unsafe or excessive product images are rejected", async () => {
  const repository = new ProductRepository();
  const app = productApp(repository);

  for (const imageUrls of [
    ["http://images.example.com/nope.jpg"],
    ["https://user:pass@images.example.com/nope.jpg"],
    ["https://images.example.com/nope.jpg#fragment"],
    Array.from({ length: 9 }, (_, i) => "https://images.example.com/" + i + ".jpg")
  ]) {
    const response = await app.request(
      "/v1/admin/stores/" + store.id + "/products",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer merchant-1",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload({ imageUrls }))
      },
      env
    );
    assert.equal(response.status, 400);
  }
});

test("cross-tenant create and edit fail closed", async () => {
  const repository = new ProductRepository();
  const app = productApp(repository);

  const createResponse = await app.request(
    "/v1/admin/stores/" + store.id + "/products",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer merchant-2",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload())
    },
    env
  );
  assert.equal(createResponse.status, 404);

  const owned = await repository.createOwnedProduct(
    "merchant-1",
    store.id,
    {
      name: "Owned",
      slug: "owned",
      description: null,
      price: "1000.00",
      currencyCode: "XAF",
      category: null,
      stockLabel: null,
      status: "draft",
      sortOrder: 0,
      imageUrls: [],
      variants: []
    }
  );
  assert.equal(owned.kind, "created");
  if (owned.kind !== "created") return;

  const updateResponse = await app.request(
    "/v1/admin/stores/" + store.id + "/products/" + owned.product.id,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer merchant-2",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload({ slug: "stolen" }))
    },
    env
  );
  assert.equal(updateResponse.status, 404);
});

test("edit, reorder, duplicate and archive are supported", async () => {
  const repository = new ProductRepository();
  const app = productApp(repository);
  const created = await repository.createOwnedProduct(
    "merchant-1",
    store.id,
    {
      name: "Original",
      slug: "original",
      description: null,
      price: "5000.00",
      currencyCode: "XAF",
      category: "Demo",
      stockLabel: null,
      status: "draft",
      sortOrder: 10,
      imageUrls: [],
      variants: []
    }
  );
  assert.equal(created.kind, "created");
  if (created.kind !== "created") return;

  const edited = await app.request(
    "/v1/admin/stores/" + store.id + "/products/" + created.product.id,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer merchant-1",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload({
        name: "Original edited",
        slug: "original-edited",
        sortOrder: 2,
        status: "active"
      }))
    },
    env
  );
  assert.equal(edited.status, 200);
  const editedBody = await edited.json() as { product: ProductSummary };
  assert.equal(editedBody.product.sortOrder, 2);
  assert.equal(editedBody.product.status, "active");

  const duplicated = await app.request(
    "/v1/admin/stores/" + store.id + "/products/" + created.product.id + "/duplicate",
    {
      method: "POST",
      headers: { Authorization: "Bearer merchant-1" }
    },
    env
  );
  assert.equal(duplicated.status, 201);
  const duplicateBody = await duplicated.json() as { product: ProductSummary };
  assert.equal(duplicateBody.product.status, "draft");

  const archived = await app.request(
    "/v1/admin/stores/" + store.id + "/products/" + created.product.id,
    {
      method: "DELETE",
      headers: { Authorization: "Bearer merchant-1" }
    },
    env
  );
  assert.equal(archived.status, 204);
});

test("draft and archived products are never exposed publicly", async () => {
  const repository = new ProductRepository();
  const app = productApp(repository);
  await repository.createOwnedProduct("merchant-1", store.id, {
    name: "Draft",
    slug: "draft",
    description: null,
    price: "1000.00",
    currencyCode: "XAF",
    category: null,
    stockLabel: null,
    status: "draft",
    sortOrder: 1,
    imageUrls: [],
    variants: []
  });

  const active = await repository.createOwnedProduct("merchant-1", store.id, {
    name: "Active",
    slug: "active",
    description: null,
    price: "2000.00",
    currencyCode: "XAF",
    category: null,
    stockLabel: null,
    status: "active",
    sortOrder: 2,
    imageUrls: [],
    variants: []
  });
  assert.equal(active.kind, "created");

  const response = await app.request("/v1/public/stores/catalog-store", {}, env);
  assert.equal(response.status, 200);
  const body = await response.json() as PublicStorefront;
  assert.deepEqual(body.products.map((product) => product.slug), ["active"]);
});


test("store publication requires at least one active product", async () => {
  const repository = new ProductRepository();
  store.status = "draft";
  const app = productApp(repository);

  const blocked = await app.request(
    "/v1/admin/stores/" + store.id + "/publish",
    {
      method: "POST",
      headers: { Authorization: "Bearer merchant-1" }
    },
    env
  );
  assert.equal(blocked.status, 409);
  assert.deepEqual(await blocked.json(), { error: "ACTIVE_PRODUCT_REQUIRED" });

  await repository.createOwnedProduct("merchant-1", store.id, {
    name: "Ready",
    slug: "ready",
    description: "Ready to publish",
    price: "15000.00",
    currencyCode: "XAF",
    category: "Demo",
    stockLabel: "En stock",
    status: "active",
    sortOrder: 10,
    imageUrls: ["https://images.example.com/ready.jpg"],
    variants: []
  });

  const published = await app.request(
    "/v1/admin/stores/" + store.id + "/publish",
    {
      method: "POST",
      headers: { Authorization: "Bearer merchant-1" }
    },
    env
  );
  assert.equal(published.status, 200);
  const body = await published.json() as { store: StoreSummary };
  assert.equal(body.store.status, "published");

  const publicResponse = await app.request(
    "/v1/public/stores/" + store.slug,
    {},
    env
  );
  assert.equal(publicResponse.status, 200);
  const publicBody = await publicResponse.json() as PublicStorefront;
  assert.deepEqual(publicBody.products.map((product) => product.slug), ["ready"]);
});
