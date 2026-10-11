import type { CommerceAuthClient } from "./auth";

const returnKey = "commerce-google-return";
const lifetime = 15 * 60 * 1000;
const appPaths = new Set(["/app", "/app/login", "/app/products", "/app/orders", "/app/appearance", "/app/settings", "/app/analytics", "/app/team", "/app/connections", "/app/platform", "/app/accept-invitation"]);
type PendingReturn = { id: string; path: string; store: string | null; invitation: string | null; createdAt: number };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validReturn(value: unknown): value is PendingReturn {
  if (!value || typeof value !== "object") return false;
  const v = value as PendingReturn;
  return typeof v.id === "string" && uuid.test(v.id) && appPaths.has(v.path) &&
    (v.store === null || typeof v.store === "string" && uuid.test(v.store)) &&
    (v.invitation === null || v.path === "/app/accept-invitation" && /^[a-f0-9]{64}$/.test(v.invitation)) &&
    Number.isFinite(v.createdAt) && v.createdAt <= Date.now() && Date.now() - v.createdAt < lifetime;
}

export async function signInWithGoogle(client: CommerceAuthClient): Promise<void> {
  const store = new URLSearchParams(window.location.search).get("store");
  const invitation = window.location.pathname === "/app/accept-invitation"
    ? new URLSearchParams(window.location.hash.slice(1)).get("token") : null;
  const pending: PendingReturn = {
    id: crypto.randomUUID(), path: appPaths.has(window.location.pathname) ? window.location.pathname : "/app",
    store: store && uuid.test(store) ? store : null,
    invitation: invitation && /^[a-f0-9]{64}$/.test(invitation) ? invitation : null, createdAt: Date.now()
  };
  // The invitation stays in this browser; it never goes to Google or Neon.
  try { sessionStorage.setItem(returnKey, JSON.stringify(pending)); }
  catch { throw new Error("GOOGLE_RETURN_STORAGE_UNAVAILABLE"); }
  const callbackURL = window.location.origin + "/app/auth-callback?oauth_flow=" + pending.id;
  try {
    const result = await client.signIn.social({ provider: "google", callbackURL,
      newUserCallbackURL: callbackURL, errorCallbackURL: callbackURL + "&oauth_error=1" });
    if (result.error) throw new Error("GOOGLE_SIGN_IN_FAILED");
  } catch (error) {
    try { sessionStorage.removeItem(returnKey); } catch { /* Optional browser storage. */ }
    throw error;
  }
}

export function finishGoogleReturn(authenticated: boolean): "failed" | "missing-session" | null {
  if (window.location.pathname !== "/app/auth-callback") return null;
  const query = new URLSearchParams(window.location.search);
  let pending: unknown;
  try { pending = JSON.parse(sessionStorage.getItem(returnKey) || "null"); sessionStorage.removeItem(returnKey); }
  catch { pending = null; }
  let destination = "/app";
  const valid = validReturn(pending) && pending.id === query.get("oauth_flow");
  if (validReturn(pending) && valid) {
    destination = pending.path === "/app/login" ? "/app" : pending.path;
    if (pending.store) destination += "?store=" + pending.store;
    if (pending.invitation) destination += "#token=" + pending.invitation;
  }
  const failed = Boolean(query.get("oauth_error") || query.get("error"));
  // The Neon SDK has already consumed its session verifier before this runs.
  window.history.replaceState(null, "", destination);
  return failed || !valid ? "failed" : authenticated ? null : "missing-session";
}
