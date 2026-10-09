import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.ts";
import type {
  CommerceRepository,
  ProductInput,
  PublicEventMetadata,
  PublicEventName,
  PublicStorefront,
  StoreCreateInput,
  StorePatch
} from "../src/types.ts";

const storeSlug = "ma-boutique";
const productSlug = "casque-pro";

function storefront(phone = "+237670000001"): PublicStorefront {
  return {
    store: {
      name: "Ma Boutique",
      slug: storeSlug,
      whatsappNumber: phone,
      countryCode: "CM",
      currencyCode: "XAF",
      description: "Audio à Douala",
      businessLocation: "Douala",
      theme: "clean",
      logoUrl: null
    },
    products: [{
      id: "33333333-3333-4333-8333-333333333333",
      name: "Casque Pro",
      slug: productSlug,
      description: "Réduction de bruit",
      price: "230000.00",
      currencyCode: "XAF",
      category: "Audio",
      stockLabel: "En stock",
      imageUrls: ["https://images.example.com/casque.jpg"],
      variants: [
        { name: "Couleur", value: "Noir" },
        { name: "Couleur", value: "Blanc" }
      ]
    }]
  };
}

class HandoffRepository implements CommerceRepository {
  events = new Map<string, {
    eventName: PublicEventName;
    storeSlug: string;
    productSlug: string | null;
    metadata: PublicEventMetadata;
  }>();
  publicStorefront: PublicStorefront | null = storefront();

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
    return slug === storeSlug ? this.publicStorefront : null;
  }

  async recordPublicEvent(
    eventId: string,
    eventName: PublicEventName,
    requestedStoreSlug: string,
    requestedProductSlug: string | null,
    metadata: PublicEventMetadata
  ) {
    if (
      !this.publicStorefront ||
      requestedStoreSlug !== this.publicStorefront.store.slug ||
      !this.publicStorefront.products.some(
        (product) => product.slug === requestedProductSlug
      )
    ) {
      return false;
    }
    if (!this.events.has(eventId)) {
      this.events.set(eventId, {
        eventName,
        storeSlug: requestedStoreSlug,
        productSlug: requestedProductSlug,
        metadata
      });
    }
    return true;
  }
}

const env = {
  TRIGENYS_COMMERCE_FACTORY_DATABASE_URL: "postgresql://fake",
  TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL:
    "https://auth.example.neon.tech/neondb/auth",
  TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN:
    "https://trigenys-commerce-factory.pages.dev"
};

function handoffApp(repository: HandoffRepository) {
  return createApp({ repositoryFactory: () => repository });
}

function requestBody(eventId = "11111111-1111-4111-8111-111111111111") {
  return {
    eventId,
    language: "fr",
    variants: [{ name: "Couleur", value: "Noir" }]
  };
}

test("WhatsApp handoff is generated from trusted store/product data", async () => {
  const repository = new HandoffRepository();
  const app = handoffApp(repository);
  const response = await app.request(
    "/v1/public/stores/" + storeSlug + "/products/" + productSlug + "/whatsapp",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody())
    },
    env
  );

  assert.equal(response.status, 200);
  const body = await response.json() as {
    href: string;
    eventName: string;
  };
  assert.equal(body.eventName, "whatsapp_order_click");
  assert.match(body.href, /^https:\/\/wa\.me\/237670000001\?text=/);

  const decoded = decodeURIComponent(body.href.split("?text=")[1]);
  assert.match(decoded, /Ma Boutique/);
  assert.match(decoded, /Casque Pro/);
  assert.match(decoded, /Couleur: Noir/);
  assert.match(decoded, /230[\s\u202f]?000/);
  assert.match(
    decoded,
    /https:\/\/trigenys-commerce-factory\.pages\.dev\/store\/ma-boutique\/p\/casque-pro/
  );

  assert.equal(repository.events.size, 1);
  const event = [...repository.events.values()][0];
  assert.equal(event.eventName, "whatsapp_order_click");
  assert.equal(event.metadata.channel, "whatsapp");
});

test("same event id is idempotent and never becomes a completed-sale event", async () => {
  const repository = new HandoffRepository();
  const app = handoffApp(repository);
  const eventId = "22222222-2222-4222-8222-222222222222";

  for (let i = 0; i < 2; i += 1) {
    const response = await app.request(
      "/v1/public/stores/" + storeSlug + "/products/" + productSlug + "/whatsapp",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody(eventId))
      },
      env
    );
    assert.equal(response.status, 200);
  }

  assert.equal(repository.events.size, 1);
  const event = repository.events.get(eventId);
  assert.equal(event?.eventName, "whatsapp_order_click");
  assert.notEqual(event?.eventName, "purchase");
});

test("unknown variant is rejected before event capture", async () => {
  const repository = new HandoffRepository();
  const app = handoffApp(repository);
  const response = await app.request(
    "/v1/public/stores/" + storeSlug + "/products/" + productSlug + "/whatsapp",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...requestBody(),
        variants: [{ name: "Couleur", value: "Invisible" }]
      })
    },
    env
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "INVALID_PRODUCT_VARIANT" });
  assert.equal(repository.events.size, 0);
});

test("malformed WhatsApp phone fails closed", async () => {
  const repository = new HandoffRepository();
  repository.publicStorefront = storefront("not-a-phone");
  const app = handoffApp(repository);
  const response = await app.request(
    "/v1/public/stores/" + storeSlug + "/products/" + productSlug + "/whatsapp",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody())
    },
    env
  );

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { error: "WHATSAPP_PHONE_INVALID" });
  assert.equal(repository.events.size, 0);
});

test("unpublished or missing product cannot generate a handoff", async () => {
  const repository = new HandoffRepository();
  repository.publicStorefront = null;
  const app = handoffApp(repository);
  const response = await app.request(
    "/v1/public/stores/" + storeSlug + "/products/" + productSlug + "/whatsapp",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody())
    },
    env
  );

  assert.equal(response.status, 404);
  assert.equal(repository.events.size, 0);
});
