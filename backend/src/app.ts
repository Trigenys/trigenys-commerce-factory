import { Hono } from "hono";
import { cors } from "hono/cors";
import { bearerToken, verifyNeonIdentity, type IdentityVerifier } from "./auth.ts";
import { createNeonRepository } from "./repository.ts";
import type {
  CommerceRepository,
  Identity,
  ProductInput,
  ProductVariant,
  PublicProduct,
  PublicStorefront,
  StoreCreateInput,
  StorePatch,
  StoreTheme,
  WorkerBindings
} from "./types.ts";

type Variables = {
  identity: Identity;
};

type AppEnv = {
  Bindings: WorkerBindings;
  Variables: Variables;
};

type AppDependencies = {
  verifyIdentity?: IdentityVerifier;
  repositoryFactory?: (env: WorkerBindings) => CommerceRepository;
};

const STORE_THEMES = new Set<StoreTheme>(["clean"]);
const MAX_MEDIA_BYTES = 2 * 1024 * 1024;

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isWebp(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false;
  return (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

function requiredMediaBucket(env: WorkerBindings) {
  if (!env.MEDIA_BUCKET) {
    throw new Error("MEDIA_BUCKET is not configured.");
  }
  return env.MEDIA_BUCKET;
}

function mediaPublicUrl(requestUrl: string, publicId: string): string {
  const origin = new URL(requestUrl).origin;
  return origin + "/v1/media/" + encodeURIComponent(publicId);
}

function requiredBinding(
  env: WorkerBindings,
  key:
    | "TRIGENYS_COMMERCE_FACTORY_DATABASE_URL"
    | "TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL"
): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(key + " is not configured.");
  return value;
}

function defaultRepositoryFactory(env: WorkerBindings): CommerceRepository {
  return createNeonRepository(
    requiredBinding(env, "TRIGENYS_COMMERCE_FACTORY_DATABASE_URL")
  );
}

function allowedOrigin(origin: string, env: WorkerBindings): string | undefined {
  const configured = env.TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN?.trim();
  if (configured && origin === configured) return origin;
  if (
    origin === "http://localhost:5173" ||
    origin === "http://127.0.0.1:5173"
  ) {
    return origin;
  }
  return undefined;
}

export function normalizeSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 63);
}

export function normalizeWhatsapp(
  value: string,
  countryCode: string
): string | null {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (hasPlus) {
    const e164 = "+" + digits;
    return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
  }

  if (countryCode === "CM") {
    if (/^6\d{8}$/.test(digits)) return "+237" + digits;
    if (/^2376\d{8}$/.test(digits)) return "+" + digits;
  }

  return null;
}

function optionalText(
  value: unknown,
  maxLength: number
): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  if (cleaned.length === 0) return null;
  if (cleaned.length > maxLength) return undefined;
  return cleaned;
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeCreate(value: unknown): StoreCreateInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const allowed = new Set([
    "name",
    "slug",
    "whatsappNumber",
    "countryCode",
    "currencyCode",
    "description",
    "businessLocation",
    "contactEmail",
    "theme"
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) return null;

  if (
    typeof input.name !== "string" ||
    input.name.trim().length < 2 ||
    input.name.trim().length > 120
  ) return null;
  const name = input.name.trim();

  const rawSlug =
    typeof input.slug === "string" && input.slug.trim()
      ? input.slug
      : name;
  const slug = normalizeSlug(rawSlug);
  if (slug.length < 3 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return null;
  }

  const countryCode =
    typeof input.countryCode === "string"
      ? input.countryCode.trim().toUpperCase()
      : "CM";
  if (!/^[A-Z]{2}$/.test(countryCode)) return null;

  const currencyCode =
    typeof input.currencyCode === "string"
      ? input.currencyCode.trim().toUpperCase()
      : "XAF";
  if (!/^[A-Z]{3}$/.test(currencyCode)) return null;

  if (typeof input.whatsappNumber !== "string") return null;
  const whatsappNumber = normalizeWhatsapp(
    input.whatsappNumber,
    countryCode
  );
  if (!whatsappNumber) return null;

  const description = optionalText(input.description, 280);
  const businessLocation = optionalText(input.businessLocation, 180);
  const contactEmail = optionalText(input.contactEmail, 254);
  if (
    description === undefined ||
    businessLocation === undefined ||
    contactEmail === undefined ||
    (contactEmail !== null && !validEmail(contactEmail))
  ) return null;

  const theme =
    input.theme === undefined ? "clean" : input.theme;
  if (
    typeof theme !== "string" ||
    !STORE_THEMES.has(theme as StoreTheme)
  ) return null;

  return {
    name,
    slug,
    whatsappNumber,
    countryCode,
    currencyCode,
    description,
    businessLocation,
    contactEmail,
    theme: theme as StoreTheme,
    logoUrl: null
  };
}

function safePatch(value: unknown): StorePatch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const allowed = new Set([
    "name",
    "slug",
    "whatsappNumber",
    "countryCode",
    "currencyCode",
    "description",
    "businessLocation",
    "contactEmail",
    "theme",
    "logoUrl"
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) return null;

  const patch: StorePatch = {};
  if (input.name !== undefined) {
    if (
      typeof input.name !== "string" ||
      input.name.trim().length < 2 ||
      input.name.trim().length > 120
    ) return null;
    patch.name = input.name.trim();
  }
  if (input.slug !== undefined) {
    if (typeof input.slug !== "string") return null;
    const slug = normalizeSlug(input.slug);
    if (slug.length < 3) return null;
    patch.slug = slug;
  }

  let countryCode: string | undefined;
  if (input.countryCode !== undefined) {
    if (typeof input.countryCode !== "string") return null;
    countryCode = input.countryCode.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) return null;
    patch.countryCode = countryCode;
  }

  if (input.whatsappNumber !== undefined) {
    if (typeof input.whatsappNumber !== "string") return null;
    const normalized = normalizeWhatsapp(
      input.whatsappNumber,
      countryCode || "CM"
    );
    if (!normalized) return null;
    patch.whatsappNumber = normalized;
  }

  if (input.currencyCode !== undefined) {
    if (typeof input.currencyCode !== "string") return null;
    const currencyCode = input.currencyCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currencyCode)) return null;
    patch.currencyCode = currencyCode;
  }

  for (const [key, limit] of [
    ["description", 280],
    ["businessLocation", 180],
    ["contactEmail", 254]
  ] as const) {
    if (input[key] !== undefined) {
      const cleaned = optionalText(input[key], limit);
      if (cleaned === undefined) return null;
      if (
        key === "contactEmail" &&
        cleaned !== null &&
        !validEmail(cleaned)
      ) return null;
      patch[key] = cleaned;
    }
  }

  if (input.theme !== undefined) {
    if (
      typeof input.theme !== "string" ||
      !STORE_THEMES.has(input.theme as StoreTheme)
    ) return null;
    patch.theme = input.theme as StoreTheme;
  }

  if (input.logoUrl !== undefined) {
    if (input.logoUrl !== null && typeof input.logoUrl !== "string") {
      return null;
    }
    if (
      typeof input.logoUrl === "string" &&
      !/^https:\/\//.test(input.logoUrl)
    ) {
      return null;
    }
    patch.logoUrl = input.logoUrl as string | null;
  }

  return patch;
}

function safeImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    Boolean(url.username) ||
    Boolean(url.password) ||
    Boolean(url.hash)
  ) {
    return null;
  }
  return url.toString();
}

function safeVariants(value: unknown): ProductVariant[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 24) return null;
  const variants: ProductVariant[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    if (
      Object.keys(row).some((key) => key !== "name" && key !== "value") ||
      typeof row.name !== "string" ||
      typeof row.value !== "string"
    ) {
      return null;
    }
    const name = row.name.trim();
    const variantValue = row.value.trim();
    if (
      name.length < 1 ||
      name.length > 60 ||
      variantValue.length < 1 ||
      variantValue.length > 80
    ) {
      return null;
    }
    variants.push({ name, value: variantValue });
  }
  return variants;
}

function safeProductInput(value: unknown): ProductInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const allowed = new Set([
    "name",
    "slug",
    "description",
    "price",
    "currencyCode",
    "category",
    "stockLabel",
    "status",
    "sortOrder",
    "imageUrls",
    "variants"
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) return null;

  if (
    typeof input.name !== "string" ||
    input.name.trim().length < 1 ||
    input.name.trim().length > 180
  ) return null;
  const name = input.name.trim();

  const rawSlug =
    typeof input.slug === "string" && input.slug.trim() ? input.slug : name;
  const slug = normalizeSlug(rawSlug);
  if (slug.length < 2) return null;

  const rawPrice =
    typeof input.price === "number" ? String(input.price) : input.price;
  if (
    typeof rawPrice !== "string" ||
    !/^\d{1,12}(?:\.\d{1,2})?$/.test(rawPrice.trim())
  ) return null;
  const price = Number(rawPrice).toFixed(2);
  if (!Number.isFinite(Number(price)) || Number(price) < 0) return null;

  const currencyCode =
    typeof input.currencyCode === "string"
      ? input.currencyCode.trim().toUpperCase()
      : "XAF";
  if (!/^[A-Z]{3}$/.test(currencyCode)) return null;

  const description = optionalText(input.description, 2000);
  const category = optionalText(input.category, 80);
  const stockLabel = optionalText(input.stockLabel, 80);
  if (
    description === undefined ||
    category === undefined ||
    stockLabel === undefined
  ) return null;

  const status =
    input.status === undefined ? "draft" : input.status;
  if (status !== "draft" && status !== "active") return null;

  const sortOrder =
    input.sortOrder === undefined ? 0 : input.sortOrder;
  if (
    typeof sortOrder !== "number" ||
    !Number.isInteger(sortOrder) ||
    sortOrder < 0 ||
    sortOrder > 1_000_000
  ) return null;

  const rawImages = input.imageUrls === undefined ? [] : input.imageUrls;
  if (!Array.isArray(rawImages) || rawImages.length > 8) return null;
  const imageUrls: string[] = [];
  for (const item of rawImages) {
    const url = safeImageUrl(item);
    if (!url || imageUrls.includes(url)) return null;
    imageUrls.push(url);
  }

  const variants = safeVariants(input.variants);
  if (!variants) return null;

  return {
    name,
    slug,
    description,
    price,
    currencyCode,
    category,
    stockLabel,
    status,
    sortOrder,
    imageUrls,
    variants
  };
}

type HandoffLanguage = "fr" | "en";

function validEventId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeHandoffVariants(value: unknown): ProductVariant[] | null {
  if (value === undefined) return [];
  return safeVariants(value);
}

function publicWebOrigin(env: WorkerBindings): string | null {
  const configured = env.TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const localHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (
      (url.protocol !== "https:" && !localHttp) ||
      url.username ||
      url.password ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function formatHandoffPrice(
  price: string,
  currency: string,
  language: HandoffLanguage
): string {
  const amount = Number(price);
  if (!Number.isFinite(amount)) return price + " " + currency;
  const noDecimals = currency === "XAF" || currency === "XOF";
  return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: noDecimals ? 0 : 2,
    maximumFractionDigits: noDecimals ? 0 : 2
  }).format(amount);
}

function whatsappHandoffUrl(
  env: WorkerBindings,
  storefront: PublicStorefront,
  product: PublicProduct,
  variants: ProductVariant[],
  language: HandoffLanguage
): string | null {
  if (!storefront) return null;
  const phone = storefront.store.whatsappNumber;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null;

  const origin = publicWebOrigin(env);
  if (!origin) return null;
  const productUrl =
    origin +
    "/store/" + encodeURIComponent(storefront.store.slug) +
    "/p/" + encodeURIComponent(product.slug);
  const variantLabel = variants.length
    ? variants.map((item) => item.name + ": " + item.value).join(", ")
    : "";
  const price = formatHandoffPrice(product.price, product.currencyCode, language);

  const message = language === "fr"
    ? [
        "Bonjour, je souhaite commander " + product.name,
        variantLabel || null,
        price,
        "chez " + storefront.store.name + ".",
        "Référence : " + productUrl
      ].filter(Boolean).join(" — ")
    : [
        "Hello, I would like to order " + product.name,
        variantLabel || null,
        price,
        "from " + storefront.store.name + ".",
        "Reference: " + productUrl
      ].filter(Boolean).join(" — ");

  return "https://wa.me/" +
    phone.replace(/\D/g, "") +
    "?text=" +
    encodeURIComponent(message);
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = new Hono<AppEnv>();
  const verifyIdentity = dependencies.verifyIdentity || verifyNeonIdentity;
  const repositoryFactory =
    dependencies.repositoryFactory || defaultRepositoryFactory;

  app.use("/v1/*", cors({
    origin: (origin, c) => allowedOrigin(origin, c.env) || "",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    maxAge: 600
  }));

  app.get("/health", (c) => c.json({
    status: "ok",
    service: "trigenys-commerce-factory-api",
    databaseConfigured: Boolean(
      c.env.TRIGENYS_COMMERCE_FACTORY_DATABASE_URL?.trim()
    ),
    authConfigured: Boolean(
      c.env.TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL?.trim()
    )
  }));

  app.get("/v1/config", (c) => {
    const authBaseUrl =
      c.env.TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL?.trim() || null;
    return c.json({ authBaseUrl });
  });

  app.use("/v1/admin/*", async (c, next) => {
    const token = bearerToken(c.req.header("Authorization"));
    if (!token) {
      return c.json({ error: "AUTH_REQUIRED" }, 401);
    }

    const authBaseUrl =
      c.env.TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL?.trim();
    if (!authBaseUrl) {
      return c.json({ error: "AUTH_NOT_CONFIGURED" }, 503);
    }

    try {
      const identity = await verifyIdentity(token, authBaseUrl);
      c.set("identity", identity);
      await next();
    } catch {
      return c.json({ error: "AUTH_INVALID" }, 401);
    }
  });

  app.get("/v1/admin/me/stores", async (c) => {
    const repository = repositoryFactory(c.env);
    const stores = await repository.listOwnedStores(
      c.get("identity").subject
    );
    return c.json({ stores });
  });

  app.post("/v1/admin/stores", async (c) => {
    let payload: unknown;
    try {
      payload = await c.req.json();
    } catch {
      return c.json({ error: "INVALID_JSON" }, 400);
    }

    const input = safeCreate(payload);
    if (!input) {
      return c.json({ error: "INVALID_STORE_INPUT" }, 400);
    }

    const repository = repositoryFactory(c.env);
    const existing = await repository.listOwnedStores(
      c.get("identity").subject
    );
    if (existing.length > 0) {
      return c.json({ error: "STORE_ALREADY_EXISTS" }, 409);
    }

    const result = await repository.createOwnedStore(
      c.get("identity").subject,
      input
    );
    if (result.kind === "slug_taken") {
      return c.json({ error: "SLUG_TAKEN" }, 409);
    }
    if (result.kind === "owner_exists") {
      return c.json({ error: "STORE_ALREADY_EXISTS" }, 409);
    }

    return c.json({ store: result.store }, 201);
  });

  app.get("/v1/admin/stores/:storeId", async (c) => {
    const repository = repositoryFactory(c.env);
    const store = await repository.getOwnedStore(
      c.get("identity").subject,
      c.req.param("storeId")
    );
    if (!store) return c.json({ error: "STORE_NOT_FOUND" }, 404);
    return c.json({ store });
  });

  app.patch("/v1/admin/stores/:storeId", async (c) => {
    let payload: unknown;
    try {
      payload = await c.req.json();
    } catch {
      return c.json({ error: "INVALID_JSON" }, 400);
    }

    const patch = safePatch(payload);
    if (!patch || Object.keys(patch).length === 0) {
      return c.json({ error: "INVALID_STORE_PATCH" }, 400);
    }

    const repository = repositoryFactory(c.env);
    const result = await repository.updateOwnedStore(
      c.get("identity").subject,
      c.req.param("storeId"),
      patch
    );
    if (result.kind === "not_found") {
      return c.json({ error: "STORE_NOT_FOUND" }, 404);
    }
    if (result.kind === "slug_taken") {
      return c.json({ error: "SLUG_TAKEN" }, 409);
    }
    return c.json({ store: result.store });
  });

  app.post("/v1/admin/stores/:storeId/publish", async (c) => {
    const repository = repositoryFactory(c.env);
    const result = await repository.publishOwnedStore(
      c.get("identity").subject,
      c.req.param("storeId")
    );
    if (result.kind === "not_found") {
      return c.json({ error: "STORE_NOT_FOUND" }, 404);
    }
    if (result.kind === "active_product_required") {
      return c.json({ error: "ACTIVE_PRODUCT_REQUIRED" }, 409);
    }
    return c.json({ store: result.store });
  });

  app.get("/v1/admin/stores/:storeId/analytics", async (c) => {
    const rawDays = c.req.query("days");
    const days = rawDays === undefined ? 30 : Number(rawDays);
    if (![7, 30, 90].includes(days)) {
      return c.json({ error: "INVALID_ANALYTICS_WINDOW" }, 400);
    }

    const repository = repositoryFactory(c.env);
    const analytics = await repository.getOwnedStoreAnalytics(
      c.get("identity").subject,
      c.req.param("storeId"),
      days
    );
    if (!analytics) return c.json({ error: "STORE_NOT_FOUND" }, 404);
    return c.json({ analytics });
  });

  app.post("/v1/admin/stores/:storeId/media", async (c) => {
    const storeId = c.req.param("storeId");
    if (!validUuid(storeId)) {
      return c.json({ error: "STORE_NOT_FOUND" }, 404);
    }

    let form: FormData;
    try {
      form = await c.req.raw.formData();
    } catch {
      return c.json({ error: "INVALID_MEDIA_FORM" }, 400);
    }

    const kindValue = form.get("kind");
    const productIdValue = form.get("productId");
    const fileValue = form.get("file");

    if (kindValue !== "logo" && kindValue !== "product") {
      return c.json({ error: "INVALID_MEDIA_KIND" }, 400);
    }

    const productId =
      kindValue === "product" && typeof productIdValue === "string"
        ? productIdValue
        : null;

    if (
      (kindValue === "product" && (!productId || !validUuid(productId))) ||
      (kindValue === "logo" && productIdValue !== null)
    ) {
      return c.json({ error: "INVALID_MEDIA_TARGET" }, 400);
    }

    if (!(fileValue instanceof File)) {
      return c.json({ error: "MEDIA_FILE_REQUIRED" }, 400);
    }
    if (fileValue.type !== "image/webp") {
      return c.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, 415);
    }
    if (fileValue.size <= 0 || fileValue.size > MAX_MEDIA_BYTES) {
      return c.json({ error: "MEDIA_TOO_LARGE" }, 413);
    }

    const bytes = new Uint8Array(await fileValue.arrayBuffer());
    if (!isWebp(bytes)) {
      return c.json({ error: "INVALID_MEDIA_BYTES" }, 415);
    }

    let bucket;
    try {
      bucket = requiredMediaBucket(c.env);
    } catch {
      return c.json({ error: "MEDIA_STORAGE_NOT_CONFIGURED" }, 503);
    }

    const repository = repositoryFactory(c.env);
    const mediaId = crypto.randomUUID();
    const publicId = crypto.randomUUID();
    const objectKey =
      "stores/" +
      storeId +
      "/" +
      (kindValue === "product"
        ? "products/" + productId
        : "logo") +
      "/" +
      crypto.randomUUID() +
      ".webp";

    try {
      await bucket.put(objectKey, bytes, {
        httpMetadata: {
          contentType: "image/webp",
          cacheControl: "public, max-age=31536000, immutable"
        },
        customMetadata: {
          storeId,
          kind: kindValue,
          ...(productId ? { productId } : {})
        }
      });

      const media = await repository.createOwnedMediaObject(
        c.get("identity").subject,
        {
          id: mediaId,
          publicId,
          storeId,
          productId,
          kind: kindValue,
          objectKey,
          contentType: "image/webp",
          byteSize: bytes.byteLength
        }
      );

      if (!media) {
        await bucket.delete(objectKey);
        return c.json({ error: "MEDIA_TARGET_NOT_FOUND" }, 404);
      }

      return c.json({
        media: {
          ...media,
          publicUrl: mediaPublicUrl(c.req.url, publicId)
        }
      }, 201);
    } catch {
      try {
        await bucket.delete(objectKey);
      } catch {
        // Best-effort rollback; orphan cleanup is documented separately.
      }
      return c.json({ error: "MEDIA_UPLOAD_FAILED" }, 502);
    }
  });

  app.delete("/v1/admin/stores/:storeId/media/:mediaId", async (c) => {
    const storeId = c.req.param("storeId");
    const mediaId = c.req.param("mediaId");
    if (!validUuid(storeId) || !validUuid(mediaId)) {
      return c.json({ error: "MEDIA_NOT_FOUND" }, 404);
    }

    const repository = repositoryFactory(c.env);
    const media = await repository.getOwnedMediaObject(
      c.get("identity").subject,
      storeId,
      mediaId
    );
    if (!media) return c.json({ error: "MEDIA_NOT_FOUND" }, 404);

    let bucket;
    try {
      bucket = requiredMediaBucket(c.env);
    } catch {
      return c.json({ error: "MEDIA_STORAGE_NOT_CONFIGURED" }, 503);
    }

    try {
      await bucket.delete(media.objectKey);
    } catch {
      return c.json({ error: "MEDIA_DELETE_FAILED" }, 502);
    }

    const deleted = await repository.deleteOwnedMediaObject(
      c.get("identity").subject,
      storeId,
      mediaId
    );
    if (!deleted) return c.json({ error: "MEDIA_NOT_FOUND" }, 404);

    return c.body(null, 204);
  });

  app.delete(
    "/v1/admin/stores/:storeId/media/public/:publicId",
    async (c) => {
      const storeId = c.req.param("storeId");
      const publicId = c.req.param("publicId");
      if (!validUuid(storeId) || !validUuid(publicId)) {
        return c.json({ error: "MEDIA_NOT_FOUND" }, 404);
      }

      const repository = repositoryFactory(c.env);
      const media = await repository.getOwnedMediaObjectByPublicId(
        c.get("identity").subject,
        storeId,
        publicId
      );
      if (!media) return c.json({ error: "MEDIA_NOT_FOUND" }, 404);

      let bucket;
      try {
        bucket = requiredMediaBucket(c.env);
      } catch {
        return c.json({ error: "MEDIA_STORAGE_NOT_CONFIGURED" }, 503);
      }

      try {
        await bucket.delete(media.objectKey);
      } catch {
        return c.json({ error: "MEDIA_DELETE_FAILED" }, 502);
      }

      const deleted = await repository.deleteOwnedMediaObjectByPublicId(
        c.get("identity").subject,
        storeId,
        publicId
      );
      if (!deleted) return c.json({ error: "MEDIA_NOT_FOUND" }, 404);

      return c.body(null, 204);
    }
  );

  app.get("/v1/admin/stores/:storeId/products", async (c) => {
    const repository = repositoryFactory(c.env);
    const products = await repository.listOwnedProducts(
      c.get("identity").subject,
      c.req.param("storeId")
    );
    return c.json({ products });
  });

  app.post("/v1/admin/stores/:storeId/products", async (c) => {
    let payload: unknown;
    try {
      payload = await c.req.json();
    } catch {
      return c.json({ error: "INVALID_JSON" }, 400);
    }

    const input = safeProductInput(payload);
    if (!input) return c.json({ error: "INVALID_PRODUCT_INPUT" }, 400);

    const repository = repositoryFactory(c.env);
    const result = await repository.createOwnedProduct(
      c.get("identity").subject,
      c.req.param("storeId"),
      input
    );
    if (result.kind === "store_not_found") {
      return c.json({ error: "STORE_NOT_FOUND" }, 404);
    }
    if (result.kind === "slug_taken") {
      return c.json({ error: "PRODUCT_SLUG_TAKEN" }, 409);
    }
    return c.json({ product: result.product }, 201);
  });

  app.patch("/v1/admin/stores/:storeId/products/:productId", async (c) => {
    let payload: unknown;
    try {
      payload = await c.req.json();
    } catch {
      return c.json({ error: "INVALID_JSON" }, 400);
    }

    const input = safeProductInput(payload);
    if (!input) return c.json({ error: "INVALID_PRODUCT_INPUT" }, 400);

    const repository = repositoryFactory(c.env);
    const result = await repository.updateOwnedProduct(
      c.get("identity").subject,
      c.req.param("storeId"),
      c.req.param("productId"),
      input
    );
    if (result.kind === "not_found") {
      return c.json({ error: "PRODUCT_NOT_FOUND" }, 404);
    }
    if (result.kind === "slug_taken") {
      return c.json({ error: "PRODUCT_SLUG_TAKEN" }, 409);
    }
    return c.json({ product: result.product });
  });

  app.delete("/v1/admin/stores/:storeId/products/:productId", async (c) => {
    const repository = repositoryFactory(c.env);
    const archived = await repository.archiveOwnedProduct(
      c.get("identity").subject,
      c.req.param("storeId"),
      c.req.param("productId")
    );
    if (!archived) return c.json({ error: "PRODUCT_NOT_FOUND" }, 404);
    return c.body(null, 204);
  });

  app.post(
    "/v1/admin/stores/:storeId/products/:productId/duplicate",
    async (c) => {
      const repository = repositoryFactory(c.env);
      const product = await repository.duplicateOwnedProduct(
        c.get("identity").subject,
        c.req.param("storeId"),
        c.req.param("productId")
      );
      if (!product) return c.json({ error: "PRODUCT_NOT_FOUND" }, 404);
      return c.json({ product }, 201);
    }
  );

  app.post("/v1/public/events", async (c) => {
    let payload: unknown;
    try {
      payload = await c.req.json();
    } catch {
      return c.json({ error: "INVALID_JSON" }, 400);
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return c.json({ error: "INVALID_PUBLIC_EVENT" }, 400);
    }
    const body = payload as Record<string, unknown>;
    if (
      Object.keys(body).some(
        (key) => !["eventId", "eventName", "storeSlug", "productSlug"].includes(key)
      ) ||
      !validEventId(body.eventId) ||
      (body.eventName !== "store_view" && body.eventName !== "product_view") ||
      typeof body.storeSlug !== "string" ||
      body.storeSlug.length < 1 ||
      body.storeSlug.length > 63
    ) {
      return c.json({ error: "INVALID_PUBLIC_EVENT" }, 400);
    }

    const productSlug =
      body.productSlug === null || body.productSlug === undefined
        ? null
        : typeof body.productSlug === "string"
          ? body.productSlug
          : undefined;
    if (
      productSlug === undefined ||
      (body.eventName === "store_view" && productSlug !== null) ||
      (body.eventName === "product_view" && !productSlug)
    ) {
      return c.json({ error: "INVALID_PUBLIC_EVENT" }, 400);
    }

    const repository = repositoryFactory(c.env);
    const storefront = await repository.getPublicStorefront(body.storeSlug);
    if (!storefront) {
      return c.json({ error: "STOREFRONT_NOT_FOUND" }, 404);
    }
    if (
      body.eventName === "product_view" &&
      !storefront.products.some((product) => product.slug === productSlug)
    ) {
      return c.json({ error: "PRODUCT_NOT_FOUND" }, 404);
    }

    const recorded = await repository.recordPublicEvent(
      body.eventId,
      body.eventName,
      body.storeSlug,
      productSlug,
      { source: "storefront" }
    );
    if (!recorded) {
      return c.json({ error: "EVENT_TARGET_NOT_FOUND" }, 404);
    }

    return c.body(null, 204);
  });

  app.post(
    "/v1/public/stores/:storeSlug/products/:productSlug/whatsapp",
    async (c) => {
      let payload: unknown;
      try {
        payload = await c.req.json();
      } catch {
        return c.json({ error: "INVALID_JSON" }, 400);
      }

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return c.json({ error: "INVALID_WHATSAPP_HANDOFF" }, 400);
      }
      const body = payload as Record<string, unknown>;
      if (
        Object.keys(body).some(
          (key) => !["eventId", "language", "variants"].includes(key)
        ) ||
        !validEventId(body.eventId)
      ) {
        return c.json({ error: "INVALID_WHATSAPP_HANDOFF" }, 400);
      }

      const language: HandoffLanguage =
        body.language === "en" ? "en" : body.language === "fr" ? "fr" : "fr";
      const variants = safeHandoffVariants(body.variants);
      if (!variants) {
        return c.json({ error: "INVALID_WHATSAPP_HANDOFF" }, 400);
      }

      const repository = repositoryFactory(c.env);
      const storeSlug = c.req.param("storeSlug");
      const productSlug = c.req.param("productSlug");
      const storefront = await repository.getPublicStorefront(storeSlug);
      if (!storefront) {
        return c.json({ error: "STOREFRONT_NOT_FOUND" }, 404);
      }

      const product = storefront.products.find(
        (candidate) => candidate.slug === productSlug
      );
      if (!product) {
        return c.json({ error: "PRODUCT_NOT_FOUND" }, 404);
      }

      const allowedVariants = new Set(
        product.variants.map((item) => item.name + "\u0000" + item.value)
      );
      const requiredVariantNames = new Set(
        product.variants.map((item) => item.name)
      );
      const selectedVariantNames = new Set(
        variants.map((item) => item.name)
      );
      if (
        selectedVariantNames.size !== variants.length ||
        selectedVariantNames.size !== requiredVariantNames.size ||
        [...requiredVariantNames].some(
          (name) => !selectedVariantNames.has(name)
        ) ||
        variants.some(
          (item) => !allowedVariants.has(item.name + "\u0000" + item.value)
        )
      ) {
        return c.json({ error: "INVALID_PRODUCT_VARIANT" }, 400);
      }

      const href = whatsappHandoffUrl(
        c.env,
        storefront,
        product,
        variants,
        language
      );
      if (!href) {
        return c.json({ error: "WHATSAPP_PHONE_INVALID" }, 422);
      }

      const recorded = await repository.recordPublicEvent(
        body.eventId,
        "whatsapp_order_click",
        storeSlug,
        productSlug,
        {
          language,
          variant: variants.length
            ? variants.map((item) => item.name + ": " + item.value).join(", ")
            : null,
          channel: "whatsapp"
        }
      );
      if (!recorded) {
        return c.json({ error: "PRODUCT_NOT_FOUND" }, 404);
      }

      return c.json({
        href,
        eventName: "whatsapp_order_click"
      });
    }
  );

  app.get("/v1/media/:publicId", async (c) => {
    const publicId = c.req.param("publicId");
    if (!validUuid(publicId)) return c.json({ error: "MEDIA_NOT_FOUND" }, 404);

    const repository = repositoryFactory(c.env);
    const media = await repository.getPublicMediaObject(publicId);
    if (!media) return c.json({ error: "MEDIA_NOT_FOUND" }, 404);

    let bucket;
    try {
      bucket = requiredMediaBucket(c.env);
    } catch {
      return c.json({ error: "MEDIA_STORAGE_NOT_CONFIGURED" }, 503);
    }

    const object = await bucket.get(media.objectKey);
    if (!object?.body) return c.json({ error: "MEDIA_NOT_FOUND" }, 404);

    return new Response(object.body, {
      status: 200,
      headers: {
        "Content-Type": media.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(media.byteSize),
        "X-Content-Type-Options": "nosniff"
      }
    });
  });

  app.get("/v1/public/stores/:slug", async (c) => {
    const repository = repositoryFactory(c.env);
    const storefront = await repository.getPublicStorefront(
      c.req.param("slug")
    );
    if (!storefront) {
      return c.json({ error: "STOREFRONT_NOT_FOUND" }, 404);
    }
    return c.json(storefront);
  });

  app.notFound((c) => c.json({ error: "NOT_FOUND" }, 404));

  return app;
}
