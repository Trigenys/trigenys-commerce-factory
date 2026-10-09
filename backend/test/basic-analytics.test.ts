import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.ts";
import type {
  CommerceRepository,
  ProductInput,
  PublicEventMetadata,
  PublicEventName,
  PublicStorefront,
  StoreAnalytics,
  StoreCreateInput,
  StorePatch
} from "../src/types.ts";

const storeId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";
const storeSlug = "analytics-store";
const productSlug = "analytics-product";

const publicStorefront: PublicStorefront = {
  store: {
    name: "Analytics Store",
    slug: storeSlug,
    whatsappNumber: "+237670000001",
    countryCode: "CM",
    currencyCode: "XAF",
    description: null,
    businessLocation: "Douala",
    theme: "clean",
    logoUrl: null
  },
  products: [{
    id: productId,
    name: "Analytics Product",
    slug: productSlug,
    description: null,
    price: "15000.00",
    currencyCode: "XAF",
    category: "Demo",
    stockLabel: "En stock",
    imageUrls: [],
    variants: []
  }]
};

type EventRecord = {
  eventName: PublicEventName;
  productSlug: string | null;
  metadata: PublicEventMetadata;
};

class AnalyticsRepository implements CommerceRepository {
  events = new Map<string, EventRecord>();

  async listOwnedStores() { return []; }
  async createOwnedStore(_subject: string, _input: StoreCreateInput) {
    return { kind: "owner_exists" as const };
  }
  async getOwnedStore() { return null; }
  async updateOwnedStore(_subject: string, _storeId: string, _patch: StorePatch) {
    return { kind: "not_found" as const };
  }
  async publishOwnedStore() { return { kind: "not_found" as const }; }
  async listOwnedProducts() { return []; }
  async createOwnedProduct(_subject: string, _storeId: string, _input: ProductInput) {
    return { kind: "store_not_found" as const };
  }
  async updateOwnedProduct() { return { kind: "not_found" as const }; }
  async archiveOwnedProduct() { return false; }
  async duplicateOwnedProduct() { return null; }

  async getPublicStorefront(slug: string) {
    return slug === storeSlug ? publicStorefront : null;
  }

  async recordPublicEvent(
    eventId: string,
    eventName: PublicEventName,
    requestedStoreSlug: string,
    requestedProductSlug: string | null,
    metadata: PublicEventMetadata
  ) {
    if (requestedStoreSlug !== storeSlug) return false;
    if (
      requestedProductSlug !== null &&
      requestedProductSlug !== productSlug
    ) return false;

    if (!this.events.has(eventId)) {
      this.events.set(eventId, {
        eventName,
        productSlug: requestedProductSlug,
        metadata
      });
    }
    return true;
  }

  async getOwnedStoreAnalytics(
    subject: string,
    requestedStoreId: string,
    days: number
  ): Promise<StoreAnalytics | null> {
    if (subject !== "merchant-1" || requestedStoreId !== storeId) return null;

    const events = [...this.events.values()];
    const storeViews = events.filter(
      (event) => event.eventName === "store_view"
    ).length;
    const productViews = events.filter(
      (event) => event.eventName === "product_view"
    ).length;
    const whatsappClicks = events.filter(
      (event) => event.eventName === "whatsapp_order_click"
    ).length;

    return {
      days,
      storeViews,
      productViews,
      whatsappClicks,
      clickThroughRate:
        productViews > 0 ? whatsappClicks / productViews : 0,
      topProducts: [{
        productId,
        name: "Analytics Product",
        views: productViews,
        whatsappClicks,
        clickThroughRate:
          productViews > 0 ? whatsappClicks / productViews : 0
      }]
    };
  }
}

const env = {
  TRIGENYS_COMMERCE_FACTORY_DATABASE_URL: "postgresql://fake",
  TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL:
    "https://auth.example.neon.tech/neondb/auth",
  TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN:
    "https://trigenys-commerce-factory.pages.dev"
};

function analyticsApp(repository: AnalyticsRepository) {
  return createApp({
    repositoryFactory: () => repository,
    verifyIdentity: async (token) => {
      if (token === "merchant-1" || token === "merchant-2") {
        return { subject: token };
      }
      throw new Error("invalid");
    }
  });
}

async function sendEvent(
  app: ReturnType<typeof analyticsApp>,
  eventId: string,
  eventName: "store_view" | "product_view",
  requestedProductSlug: string | null
) {
  return await app.request(
    "/v1/public/events",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        eventName,
        storeSlug,
        productSlug: requestedProductSlug
      })
    },
    env
  );
}

test("store and product view taxonomy is accepted without PII", async () => {
  const repository = new AnalyticsRepository();
  const app = analyticsApp(repository);

  const storeView = await sendEvent(
    app,
    "11111111-1111-4111-8111-111111111111",
    "store_view",
    null
  );
  const productView = await sendEvent(
    app,
    "22222222-2222-4222-8222-222222222222",
    "product_view",
    productSlug
  );

  assert.equal(storeView.status, 204);
  assert.equal(productView.status, 204);
  assert.equal(repository.events.size, 2);

  for (const event of repository.events.values()) {
    assert.deepEqual(event.metadata, { source: "storefront" });
    assert.equal("email" in event.metadata, false);
    assert.equal("phone" in event.metadata, false);
  }
});

test("repeated event id is counted once", async () => {
  const repository = new AnalyticsRepository();
  const app = analyticsApp(repository);
  const eventId = "33333333-3333-4333-8333-333333333333";

  const first = await sendEvent(app, eventId, "product_view", productSlug);
  const second = await sendEvent(app, eventId, "product_view", productSlug);

  assert.equal(first.status, 204);
  assert.equal(second.status, 204);
  assert.equal(repository.events.size, 1);
});

test("missing or inactive product target is rejected", async () => {
  const repository = new AnalyticsRepository();
  const app = analyticsApp(repository);
  const response = await sendEvent(
    app,
    "44444444-4444-4444-8444-444444444444",
    "product_view",
    "missing-product"
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "PRODUCT_NOT_FOUND" });
  assert.equal(repository.events.size, 0);
});

test("merchant analytics are tenant scoped and expose intent metrics only", async () => {
  const repository = new AnalyticsRepository();
  const app = analyticsApp(repository);

  repository.events.set("55555555-5555-4555-8555-555555555555", {
    eventName: "store_view",
    productSlug: null,
    metadata: { source: "storefront" }
  });
  repository.events.set("66666666-6666-4666-8666-666666666666", {
    eventName: "product_view",
    productSlug,
    metadata: { source: "storefront" }
  });
  repository.events.set("77777777-7777-4777-8777-777777777777", {
    eventName: "whatsapp_order_click",
    productSlug,
    metadata: { channel: "whatsapp" }
  });

  const owner = await app.request(
    "/v1/admin/stores/" + storeId + "/analytics?days=30",
    { headers: { Authorization: "Bearer merchant-1" } },
    env
  );
  assert.equal(owner.status, 200);
  const body = await owner.json() as { analytics: StoreAnalytics };
  assert.equal(body.analytics.storeViews, 1);
  assert.equal(body.analytics.productViews, 1);
  assert.equal(body.analytics.whatsappClicks, 1);
  assert.equal(body.analytics.clickThroughRate, 1);
  assert.equal(JSON.stringify(body).includes("orders"), false);
  assert.equal(JSON.stringify(body).includes("revenue"), false);

  const otherTenant = await app.request(
    "/v1/admin/stores/" + storeId + "/analytics?days=30",
    { headers: { Authorization: "Bearer merchant-2" } },
    env
  );
  assert.equal(otherTenant.status, 404);
});

test("analytics accepts only the documented time windows", async () => {
  const repository = new AnalyticsRepository();
  const app = analyticsApp(repository);
  const response = await app.request(
    "/v1/admin/stores/" + storeId + "/analytics?days=365",
    { headers: { Authorization: "Bearer merchant-1" } },
    env
  );

  assert.equal(response.status, 400);
  assert.deepEqual(
    await response.json(),
    { error: "INVALID_ANALYTICS_WINDOW" }
  );
});
