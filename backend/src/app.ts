import { Hono } from "hono";
import { cors } from "hono/cors";
import { bearerToken, verifyNeonIdentity, type IdentityVerifier } from "./auth.ts";
import { createNeonRepository } from "./repository.ts";
import type {
  CommerceRepository,
  Identity,
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

export function createApp(dependencies: AppDependencies = {}) {
  const app = new Hono<AppEnv>();
  const verifyIdentity = dependencies.verifyIdentity || verifyNeonIdentity;
  const repositoryFactory =
    dependencies.repositoryFactory || defaultRepositoryFactory;

  app.use("/v1/*", cors({
    origin: (origin, c) => allowedOrigin(origin, c.env) || "",
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
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
