import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthVanillaAdapter } from "@neondatabase/neon-js/auth/vanilla/adapters";
import { fetchRuntimeConfig } from "./runtime";

function createCommerceAuthClient(authBaseUrl: string) {
  return createAuthClient(authBaseUrl, {
    adapter: BetterAuthVanillaAdapter({
      fetchOptions: {
        credentials: "include"
      }
    })
  });
}

export type CommerceAuthClient = ReturnType<typeof createCommerceAuthClient>;

let clientPromise: Promise<CommerceAuthClient> | null = null;

export function getAuthClient(): Promise<CommerceAuthClient> {
  if (!clientPromise) {
    clientPromise = fetchRuntimeConfig().then(({ authBaseUrl }) =>
      createCommerceAuthClient(authBaseUrl)
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

export async function getSessionSnapshot(
  client: CommerceAuthClient
): Promise<{ authenticated: boolean; email: string }> {
  const result = await client.getSession();
  const data = result.data;

  if (
    !data ||
    typeof data !== "object" ||
    !("session" in data) ||
    !("user" in data)
  ) {
    return { authenticated: false, email: "" };
  }

  const session = (data as { session?: unknown }).session;
  const user = (data as { user?: unknown }).user;
  if (!session || !user || typeof user !== "object") {
    return { authenticated: false, email: "" };
  }

  const email = (user as { email?: unknown }).email;
  return {
    authenticated: true,
    email: typeof email === "string" ? email : ""
  };
}
