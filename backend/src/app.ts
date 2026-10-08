import { Hono } from "hono";
import { cors } from "hono/cors";
import { bearerToken, verifyNeonIdentity, type IdentityVerifier } from "./auth.ts";
import { createNeonRepository } from "./repository.ts";
import type {
  CommerceRepository,
  Identity,
  StorePatch,
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

function safePatch(value: unknown): StorePatch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const allowed = new Set([
    "name",
    "whatsappNumber",
    "countryCode",
    "currencyCode"
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) return null;

  const patch: StorePatch = {};
  if (input.name !== undefined) {
    if (
      typeof input.name !== "string" ||
      input.name.trim().length < 2 ||
      input.name.length > 120
    ) return null;
    patch.name = input.name.trim();
  }
  if (input.whatsappNumber !== undefined) {
    if (
      typeof input.whatsappNumber !== "string" ||
      !/^\+[1-9]\d{7,14}$/.test(input.whatsappNumber)
    ) return null;
    patch.whatsappNumber = input.whatsappNumber;
  }
  if (input.countryCode !== undefined) {
    if (
      typeof input.countryCode !== "string" ||
      !/^[A-Z]{2}$/.test(input.countryCode)
    ) return null;
    patch.countryCode = input.countryCode;
  }
  if (input.currencyCode !== undefined) {
    if (
      typeof input.currencyCode !== "string" ||
      !/^[A-Z]{3}$/.test(input.currencyCode)
    ) return null;
    patch.currencyCode = input.currencyCode;
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
    allowMethods: ["GET", "PATCH", "OPTIONS"],
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
    const store = await repository.updateOwnedStore(
      c.get("identity").subject,
      c.req.param("storeId"),
      patch
    );
    if (!store) return c.json({ error: "STORE_NOT_FOUND" }, 404);
    return c.json({ store });
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
