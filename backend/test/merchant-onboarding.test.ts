import assert from "node:assert/strict";
import test from "node:test";
import { storeThemeIds } from "../../shared/store-themes.ts";
import {
  createApp,
  normalizeSlug,
  normalizeWhatsapp
} from "../src/app.ts";
import type {
  CommerceRepository,
  PublicStorefront,
  StoreCreateInput,
  StoreCreateResult,
  StorePatch,
  StoreSummary,
  StoreUpdateResult
} from "../src/types.ts";

const env = {
  TRIGENYS_COMMERCE_FACTORY_DATABASE_URL: "postgresql://fake",
  TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL:
    "https://auth.example.neon.tech/neondb/auth",
  TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN: "https://commerce.example"
};

class OnboardingRepository implements CommerceRepository {
  stores: StoreSummary[] = [];
  createResult: StoreCreateResult | null = null;
  createInput: StoreCreateInput | null = null;

  async listOwnedStores(_subject: string) {
    return this.stores;
  }

  async createOwnedStore(_subject: string, input: StoreCreateInput) {
    this.createInput = input;
    if (this.createResult) return this.createResult;
    const store: StoreSummary = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "draft",
      ...input
    };
    this.stores = [store];
    return { kind: "created" as const, store };
  }

  async getOwnedStore(_subject: string, storeId: string) {
    return this.stores.find((store) => store.id === storeId) || null;
  }

  async updateOwnedStore(
    _subject: string,
    storeId: string,
    patch: StorePatch
  ): Promise<StoreUpdateResult> {
    const store = this.stores.find((candidate) => candidate.id === storeId);
    if (!store) return { kind: "not_found" };
    const updated = { ...store, ...patch };
    this.stores = [updated];
    return { kind: "updated", store: updated };
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

  async getOwnedStoreAnalytics() { return null; }

  async createOwnedMediaObject() { return null; }
  async getOwnedMediaObject() { return null; }
  async getOwnedMediaObjectByPublicId() { return null; }
  async deleteOwnedMediaObject() { return false; }
  async deleteOwnedMediaObjectByPublicId() { return false; }
  async getPublicMediaObject() { return null; }

  async getPublicStorefront(_slug: string): Promise<PublicStorefront | null> {
    return null;
  }
}

function onboardingApp(repository: OnboardingRepository) {
  return createApp({
    repositoryFactory: () => repository,
    verifyIdentity: async () => ({
      subject: "merchant-1",
      email: "merchant@example.com"
    })
  });
}

const themeRequestHeaders = { Authorization: "Bearer valid", "Content-Type": "application/json" };
const themedStoreInput = { name: "Atelier", slug: "atelier", whatsappNumber: "+237670000001" };

test("every registered theme survives store creation and merchant reload", async () => {
  for (const theme of storeThemeIds) {
    const repository = new OnboardingRepository();
    const app = onboardingApp(repository);
    const settings = { accent: "#AABBCC", font: "serif", imageFit: "contain" };
    const created = await app.request("/v1/admin/stores", {
      method: "POST", headers: themeRequestHeaders,
      body: JSON.stringify({ ...themedStoreInput, theme, themeSettings: settings })
    }, env);
    assert.equal(created.status, 201, theme);
    const reloaded = await app.request("/v1/admin/me/stores", { headers: themeRequestHeaders }, env);
    const { stores } = await reloaded.json() as { stores: StoreSummary[] };
    assert.equal(stores[0].theme, theme);
    assert.deepEqual(stores[0].themeSettings, { ...settings, accent: "#aabbcc" });
  }
});

test("changing a theme preserves store identity and unrelated settings", async () => {
  const repository = new OnboardingRepository();
  const app = onboardingApp(repository);
  await app.request("/v1/admin/stores", {
    method: "POST", headers: themeRequestHeaders,
    body: JSON.stringify({ ...themedStoreInput, themeSettings: { accent: "#112233" } })
  }, env);
  const original = repository.stores[0];
  const response = await app.request("/v1/admin/stores/" + original.id, {
    method: "PATCH", headers: themeRequestHeaders, body: JSON.stringify({ theme: "sport-stadium" })
  }, env);
  assert.equal(response.status, 200);
  assert.deepEqual(repository.stores[0], { ...original, theme: "sport-stadium" });
  const reset = await app.request("/v1/admin/stores/" + original.id, {
    method: "PATCH", headers: themeRequestHeaders, body: JSON.stringify({ themeSettings: {} })
  }, env);
  assert.equal(reset.status, 200);
  assert.deepEqual(repository.stores[0].themeSettings, {});
});

test("invalid themes and non-declarative settings fail before writing", async () => {
  const invalid = [
    { theme: "unregistered" }, { theme: "__proto__" }, { themeSettings: null },
    { themeSettings: [] }, { themeSettings: { accent: "red; background:url(https://evil.example)" } },
    { themeSettings: { font: "url(https://evil.example)" } }, { themeSettings: { imageFit: "fill" } },
    { themeSettings: { css: "body {display:none}" } }, { themeSettings: { heroImageUrl: "https://evil.example" } }
  ];
  for (const input of invalid) {
    const repository = new OnboardingRepository();
    const response = await onboardingApp(repository).request("/v1/admin/stores", {
      method: "POST", headers: themeRequestHeaders, body: JSON.stringify({ ...themedStoreInput, ...input })
    }, env);
    assert.equal(response.status, 400, JSON.stringify(input));
    assert.equal(repository.createInput, null);
  }
});

test("slug normalization is stable and URL-safe", () => {
  assert.equal(normalizeSlug("  Chez Maman — Douala  "), "chez-maman-douala");
  assert.equal(normalizeSlug("Élégance & Beauté"), "elegance-beaute");
});

test("Cameroon WhatsApp numbers normalize to E.164", () => {
  assert.equal(normalizeWhatsapp("6 70 00 00 01", "CM"), "+237670000001");
  assert.equal(normalizeWhatsapp("237 670 000 001", "CM"), "+237670000001");
  assert.equal(normalizeWhatsapp("+237 670 000 001", "CM"), "+237670000001");
  assert.equal(normalizeWhatsapp("670000001", "FR"), null);
});

test("merchant creates one draft store with normalized fields", async () => {
  const repository = new OnboardingRepository();
  const app = onboardingApp(repository);
  const response = await app.request(
    "/v1/admin/stores",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer valid",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Élégance Beauté",
        slug: "Élégance Beauté",
        whatsappNumber: "6 70 00 00 01",
        countryCode: "cm",
        currencyCode: "xaf",
        description: "Soins et beauté à Douala.",
        businessLocation: "Bonapriso, Douala",
        contactEmail: "hello@example.com",
        theme: "clean"
      })
    },
    env
  );

  assert.equal(response.status, 201);
  assert.equal(repository.createInput?.slug, "elegance-beaute");
  assert.equal(repository.createInput?.whatsappNumber, "+237670000001");
  assert.equal(repository.createInput?.countryCode, "CM");
  assert.equal(repository.createInput?.currencyCode, "XAF");
  assert.equal(repository.createInput?.logoUrl, null);
  const body = await response.json() as { store: StoreSummary };
  assert.equal(body.store.status, "draft");
});

test("duplicate slug produces a useful conflict", async () => {
  const repository = new OnboardingRepository();
  repository.createResult = { kind: "slug_taken" };
  const app = onboardingApp(repository);
  const response = await app.request(
    "/v1/admin/stores",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer valid",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Test Store",
        slug: "test-store",
        whatsappNumber: "+237670000001",
        countryCode: "CM",
        currencyCode: "XAF",
        theme: "clean"
      })
    },
    env
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "SLUG_TAKEN" });
});

test("merchant cannot create a second owner store in MVP", async () => {
  const repository = new OnboardingRepository();
  repository.stores = [{
    id: "11111111-1111-4111-8111-111111111111",
    name: "Existing",
    slug: "existing",
    status: "draft",
    whatsappNumber: "+237670000001",
    countryCode: "CM",
    currencyCode: "XAF",
    description: null,
    businessLocation: null,
    contactEmail: null,
    theme: "clean",
    logoUrl: null
  }];
  const app = onboardingApp(repository);
  const response = await app.request(
    "/v1/admin/stores",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer valid",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Second",
        slug: "second",
        whatsappNumber: "+237670000002",
        countryCode: "CM",
        currencyCode: "XAF",
        theme: "clean"
      })
    },
    env
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "STORE_ALREADY_EXISTS" });
});

test("invalid WhatsApp and email fail with a client error", async () => {
  const repository = new OnboardingRepository();
  const app = onboardingApp(repository);
  const response = await app.request(
    "/v1/admin/stores",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer valid",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Bad Input",
        slug: "bad-input",
        whatsappNumber: "123",
        countryCode: "CM",
        currencyCode: "XAF",
        contactEmail: "not-an-email",
        theme: "clean"
      })
    },
    env
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "INVALID_STORE_INPUT" });
});
