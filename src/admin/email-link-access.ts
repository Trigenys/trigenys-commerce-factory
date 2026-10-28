import type { CommerceAuthClient } from "./auth";

const returnKey = "commerce-email-link-return";
const lifetime = 24 * 60 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const paths = new Set(["/app", "/app/login", "/app/products", "/app/orders", "/app/appearance", "/app/settings", "/app/analytics", "/app/team", "/app/connections", "/app/platform", "/app/accept-invitation"]);
type PendingReturn = { id: string; path: string; store: string | null; invitation: string | null; createdAt: number };

function valid(value: unknown): value is PendingReturn {
  if (!value || typeof value !== "object") return false;
  const v = value as PendingReturn;
  return typeof v.id === "string" && uuid.test(v.id) && paths.has(v.path) &&
    (v.store === null || typeof v.store === "string" && uuid.test(v.store)) &&
    (v.invitation === null || v.path === "/app/accept-invitation" && typeof v.invitation === "string" && /^[a-f0-9]{64}$/.test(v.invitation)) &&
    Number.isFinite(v.createdAt) && v.createdAt <= Date.now() && Date.now() - v.createdAt < lifetime;
}

export async function sendEmailLink(client: CommerceAuthClient, email: string, name?: string, language: "fr" | "en" = "fr"): Promise<void> {
  const store = new URLSearchParams(window.location.search).get("store");
  const invitation = window.location.pathname === "/app/accept-invitation"
    ? new URLSearchParams(window.location.hash.slice(1)).get("token") : null;
  const pending: PendingReturn = {
    id: crypto.randomUUID(), path: paths.has(window.location.pathname) ? window.location.pathname : "/app",
    store: store && uuid.test(store) ? store : null,
    invitation: invitation && /^[a-f0-9]{64}$/.test(invitation) ? invitation : null,
    createdAt: Date.now()
  };
  // Only a correlation ID and the UI language go to Neon. Invitation tokens stay in the requesting tab.
  // A link opened in another tab/device safely falls back to /app after authentication.
  try { sessionStorage.setItem(returnKey, JSON.stringify(pending)); } catch { /* Return context is optional. */ }
  const callbackURL = window.location.origin + "/app/email-link?flow=" + pending.id + "&lang=" + language;
  const result = await client.signIn.magicLink({
    email: email.trim(), ...(name?.trim() ? { name: name.trim() } : {}),
    callbackURL, newUserCallbackURL: callbackURL, errorCallbackURL: callbackURL + "&link_error=1"
  });
  if (result.error) throw new Error("EMAIL_LINK_SEND_FAILED");
}

export function finishEmailLinkReturn(authenticated: boolean): "failed" | "missing-session" | null {
  if (window.location.pathname !== "/app/email-link") return null;
  const query = new URLSearchParams(window.location.search);
  let pending: unknown;
  try { pending = JSON.parse(sessionStorage.getItem(returnKey) || "null"); sessionStorage.removeItem(returnKey); }
  catch { pending = null; }
  const failed = Boolean(query.get("link_error") || query.get("error"));
  let destination = authenticated ? "/app" : "/app/login";
  if (authenticated && !failed && valid(pending) && pending.id === query.get("flow")) {
    destination = pending.path === "/app/login" ? "/app" : pending.path;
    if (pending.store) destination += "?store=" + pending.store;
    if (pending.invitation) destination += "#token=" + pending.invitation;
  }
  // The SDK restores the provider session; this page never redeems or stores the email token.
  window.history.replaceState(null, "", destination);
  return failed ? "failed" : authenticated ? null : "missing-session";
}
