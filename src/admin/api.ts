import type { CommerceAuthClient } from "./auth";
import { getApiToken } from "./auth";
import { apiBaseUrl } from "./runtime";

export type Store = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  whatsappNumber: string;
  countryCode: string;
  currencyCode: string;
  description: string | null;
  businessLocation: string | null;
  contactEmail: string | null;
  theme: "clean";
  logoUrl: string | null;
};

export type StoreInput = {
  name: string;
  slug: string;
  whatsappNumber: string;
  countryCode: string;
  currencyCode: string;
  description: string;
  businessLocation: string;
  contactEmail: string;
  theme: "clean";
};

type ErrorBody = { error?: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code);
  }
}

async function merchantRequest<T>(
  client: CommerceAuthClient,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getApiToken(client);
  const response = await fetch(apiBaseUrl + path, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: "Bearer " + token,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    let code = "REQUEST_FAILED";
    try {
      const body = await response.json() as ErrorBody;
      if (body.error) code = body.error;
    } catch {
      // Keep stable fallback code.
    }
    throw new ApiError(response.status, code);
  }

  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export async function listStores(
  client: CommerceAuthClient
): Promise<Store[]> {
  const body = await merchantRequest<{ stores: Store[] }>(
    client,
    "/v1/admin/me/stores"
  );
  return body.stores;
}

export async function createStore(
  client: CommerceAuthClient,
  input: StoreInput
): Promise<Store> {
  const body = await merchantRequest<{ store: Store }>(
    client,
    "/v1/admin/stores",
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
  return body.store;
}

export async function updateStore(
  client: CommerceAuthClient,
  storeId: string,
  input: StoreInput
): Promise<Store> {
  const body = await merchantRequest<{ store: Store }>(
    client,
    "/v1/admin/stores/" + encodeURIComponent(storeId),
    {
      method: "PATCH",
      body: JSON.stringify(input)
    }
  );
  return body.store;
}


export type ProductVariant = {
  name: string;
  value: string;
};

export type Product = {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  currencyCode: string;
  category: string | null;
  stockLabel: string | null;
  status: "draft" | "active" | "archived";
  sortOrder: number;
  imageUrls: string[];
  variants: ProductVariant[];
};

export type ProductInput = {
  name: string;
  slug: string;
  description: string | null;
  price: string;
  currencyCode: string;
  category: string | null;
  stockLabel: string | null;
  status: "draft" | "active";
  sortOrder: number;
  imageUrls: string[];
  variants: ProductVariant[];
};

function productPath(storeId: string): string {
  return "/v1/admin/stores/" + encodeURIComponent(storeId) + "/products";
}

export async function listProducts(
  client: CommerceAuthClient,
  storeId: string
): Promise<Product[]> {
  const body = await merchantRequest<{ products: Product[] }>(
    client,
    productPath(storeId)
  );
  return body.products;
}

export async function createProduct(
  client: CommerceAuthClient,
  storeId: string,
  input: ProductInput
): Promise<Product> {
  const body = await merchantRequest<{ product: Product }>(
    client,
    productPath(storeId),
    { method: "POST", body: JSON.stringify(input) }
  );
  return body.product;
}

export async function updateProduct(
  client: CommerceAuthClient,
  storeId: string,
  productId: string,
  input: ProductInput
): Promise<Product> {
  const body = await merchantRequest<{ product: Product }>(
    client,
    productPath(storeId) + "/" + encodeURIComponent(productId),
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return body.product;
}

export async function archiveProduct(
  client: CommerceAuthClient,
  storeId: string,
  productId: string
): Promise<void> {
  await merchantRequest<void>(
    client,
    productPath(storeId) + "/" + encodeURIComponent(productId),
    { method: "DELETE" }
  );
}

export async function duplicateProduct(
  client: CommerceAuthClient,
  storeId: string,
  productId: string
): Promise<Product> {
  const body = await merchantRequest<{ product: Product }>(
    client,
    productPath(storeId) + "/" + encodeURIComponent(productId) + "/duplicate",
    { method: "POST" }
  );
  return body.product;
}


export async function publishStore(
  client: CommerceAuthClient,
  storeId: string
): Promise<Store> {
  const body = await merchantRequest<{ store: Store }>(
    client,
    "/v1/admin/stores/" + encodeURIComponent(storeId) + "/publish",
    { method: "POST" }
  );
  return body.store;
}


export type ProductAnalytics = {
  productId: string;
  name: string;
  views: number;
  whatsappClicks: number;
  clickThroughRate: number;
};

export type StoreAnalytics = {
  days: number;
  storeViews: number;
  productViews: number;
  whatsappClicks: number;
  clickThroughRate: number;
  topProducts: ProductAnalytics[];
};

export async function getStoreAnalytics(
  client: CommerceAuthClient,
  storeId: string,
  days = 30
): Promise<StoreAnalytics> {
  const body = await merchantRequest<{ analytics: StoreAnalytics }>(
    client,
    "/v1/admin/stores/" +
      encodeURIComponent(storeId) +
      "/analytics?days=" +
      encodeURIComponent(String(days))
  );
  return body.analytics;
}
