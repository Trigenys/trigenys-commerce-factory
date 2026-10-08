import { createAuthClient } from "@neondatabase/neon-js/auth";
import { fetchRuntimeConfig } from "./runtime";

export type CommerceAuthClient = ReturnType<typeof createAuthClient>;

let clientPromise: Promise<CommerceAuthClient> | null = null;

export function getAuthClient(): Promise<CommerceAuthClient> {
  if (!clientPromise) {
    clientPromise = fetchRuntimeConfig().then(({ authBaseUrl }) =>
      createAuthClient(authBaseUrl, {
        fetchOptions: {
          credentials: "include"
        }
      })
    );
  }
  return clientPromise;
}

export async function getApiToken(
  client: CommerceAuthClient
): Promise<string> {
  const result = await client.token();
  if (result.error || !result.data?.token) {
    throw new Error("AUTH_TOKEN_UNAVAILABLE");
  }
  return result.data.token;
}
