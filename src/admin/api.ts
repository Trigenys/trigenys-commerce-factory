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
