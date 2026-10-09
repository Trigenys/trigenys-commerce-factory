import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.ts";
import type {
  CommerceRepository,
  PublicStorefront,
  StoreCreateInput,
  StorePatch,
  StoreSummary
} from "../src/types.ts";

const stores: StoreSummary[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Alice Store",
    slug: "alice-store",
    status: "published",
    whatsappNumber: "+237670000001",
    countryCode: "CM",
    currencyCode: "XAF",
    description: "Alice description",
    businessLocation: "Douala",
    contactEmail: "alice@example.com",
    theme: "clean",
    logoUrl: null
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Bob Store",
    slug: "bob-store",
    status: "draft",
    whatsappNumber: "+237670000002",
    countryCode: "CM",
    currencyCode: "XAF",
    description: null,
    businessLocation: "Yaoundé",
    contactEmail: null,
    theme: "clean",
    logoUrl: null
  }
];

const membership = new Map([
  ["alice", stores[0].id],
  ["bob", stores[1].id]
]);

class FakeRepository implements CommerceRepository {
  updates: Array<{ subject: string; storeId: string; patch: StorePatch }> = [];

  async listOwnedStores(subject: string) {
    const storeId = membership.get(subject);
    return stores.filter((store) => store.id === storeId);
  }

  async createOwnedStore(_subject: string, _input: StoreCreateInput) {
    return { kind: "owner_exists" as const };
  }

  async getOwnedStore(subject: string, storeId: string) {
    return stores.find(
      (store) => store.id === storeId && membership.get(subject) === storeId
    ) || null;
  }

  async updateOwnedStore(subject: string, storeId: string, patch: StorePatch) {
    const store = await this.getOwnedStore(subject, storeId);
    if (!store) return { kind: "not_found" as const };
    this.updates.push({ subject, storeId, patch });
    return { kind: "updated" as const, store: { ...store, ...patch } };
  }

  async listOwnedProducts(_subject: string, _storeId: string) { return []; }
  async createOwnedProduct() { return { kind: "store_not_found" as const }; }
  async updateOwnedProduct() { return { kind: "not_found" as const }; }
  async archiveOwnedProduct() { return false; }
  async duplicateOwnedProduct() { return null; }

  async publishOwnedStore(_subject: string, _storeId: string) {
    return { kind: "not_found" as const };
  }

  async recordPublicEvent() { return false; }

  async getPublicStorefront(slug: string): Promise<PublicStorefront | null> {
    const store = stores.find(
      (candidate) => candidate.slug === slug && candidate.status === "published"
    );
    if (!store) return null;

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
      products: [{
        id: "33333333-3333-4333-8333-333333333333",
        name: "Demo product",
        slug: "demo-product",
        description: null,
        price: "15000.00",
        currencyCode: "XAF",
        category: "Demo",
        stockLabel: null,
        imageUrls: ["https://images.example.com/demo.jpg"],
        variants: []
      }]
    };
  }
}

const fake = new FakeRepository();
const app = createApp({
  repositoryFactory: () => fake,
  verifyIdentity: async (token) => {
    if (token === "alice" || token === "bob") {
      return { subject: token };
    }
    throw new Error("invalid");
  }
});

const env = {
  TRIGENYS_COMMERCE_FACTORY_DATABASE_URL: "postgresql://fake",
  TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL:
    "https://auth.example.neon.tech/neondb/auth",
  TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN: "https://commerce.example"
};

test("unauthenticated admin access is rejected", async () => {
  const response = await app.request("/v1/admin/me/stores", {}, env);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "AUTH_REQUIRED" });
});

test("invalid bearer token is rejected", async () => {
  const response = await app.request(
    "/v1/admin/me/stores",
    { headers: { Authorization: "Bearer mallory" } },
    env
  );
  assert.equal(response.status, 401);
});

test("owner can read own store", async () => {
  const response = await app.request(
    "/v1/admin/stores/" + stores[0].id,
    { headers: { Authorization: "Bearer alice" } },
    env
  );
  assert.equal(response.status, 200);
  const body = await response.json() as { store: StoreSummary };
  assert.equal(body.store.name, "Alice Store");
});

test("cross-tenant read is indistinguishable from a missing store", async () => {
  const response = await app.request(
    "/v1/admin/stores/" + stores[1].id,
    { headers: { Authorization: "Bearer alice" } },
    env
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "STORE_NOT_FOUND" });
});

test("cross-tenant write is rejected and performs no mutation", async () => {
  const before = fake.updates.length;
  const response = await app.request(
    "/v1/admin/stores/" + stores[1].id,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer alice",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "Stolen store" })
    },
    env
  );
  assert.equal(response.status, 404);
  assert.equal(fake.updates.length, before);
});

test("public storefront exposes only publishable fields", async () => {
  const response = await app.request("/v1/public/stores/alice-store", {}, env);
  assert.equal(response.status, 200);
  const body = await response.json() as Record<string, unknown>;
  const serialized = JSON.stringify(body);

  assert.equal(serialized.includes("authSubject"), false);
  assert.equal(serialized.includes("merchantId"), false);
  assert.equal(serialized.includes("store_members"), false);
  assert.equal(serialized.includes("role"), false);
});

test("draft store has no public storefront", async () => {
  const response = await app.request("/v1/public/stores/bob-store", {}, env);
  assert.equal(response.status, 404);
});
