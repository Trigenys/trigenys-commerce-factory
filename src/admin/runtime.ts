import { timedFetch } from "../lib/requests";
const configuredApiBase =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

export const apiBaseUrl = (
  configuredApiBase ||
  (import.meta.env.DEV ? "http://127.0.0.1:8787" : "")
).replace(/\/$/, "");

export async function fetchRuntimeConfig(): Promise<{ authBaseUrl: string }> {
  if (!apiBaseUrl) {
    throw new Error("Commerce Factory API is not configured.");
  }

  const response = await timedFetch(apiBaseUrl + "/v1/config", {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error("Unable to load Commerce Factory runtime configuration.");
  }

  const body = await response.json() as { authBaseUrl?: unknown };
  if (
    typeof body.authBaseUrl !== "string" ||
    !body.authBaseUrl.startsWith("https://")
  ) {
    throw new Error("Merchant authentication is not configured.");
  }

  return { authBaseUrl: body.authBaseUrl };
}
