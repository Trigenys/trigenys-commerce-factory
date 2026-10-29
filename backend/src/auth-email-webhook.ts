import { compactVerify, createRemoteJWKSet, customFetch, decodeProtectedHeader } from "jose";
import type { Hono } from "hono";
import type { AppEnv } from "./app.ts";
import type { WorkerBindings } from "./types.ts";
import { buildAuthEmail, type AuthEmailMessage, type AuthEmailPurpose } from "./auth-email-templates.ts";
import { sendTransactionalEmail } from "./email-delivery.ts";
import type { EmailLanguage } from "./email-layout.ts";

export type AuthEmailDependencies = { fetcher?: typeof fetch; now?: () => number };
const maxBodyBytes = 32 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const purposes = new Set(["sign-in", "email-verification", "forget-password"]);
type WebhookDiagnostic = "envelope" | "event_id" | "event_headers" | "endpoint" | "recipient" | "timestamp" | "expiry" | "purpose" | "channel" | "link_format" | "link_origin" | "otp_format";

class WebhookError extends Error {
  readonly status: 400 | 401 | 413 | 415 | 503;
  readonly code: string;
  readonly diagnostic?: WebhookDiagnostic;
  readonly endpoint?: { expected: string; received: string };
  constructor(status: 400 | 401 | 413 | 415 | 503, code: string, diagnostic?: WebhookDiagnostic, endpoint?: { expected: string; received: string }) { super(code); this.status = status; this.code = code; this.diagnostic = diagnostic; this.endpoint = endpoint; }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function configuration(env: WorkerBindings) {
  if (env.AUTH_EMAIL_ENABLED !== "true" || !env.NOTIFY_EMAIL_INGEST_KEY || env.NOTIFY_EMAIL_INGEST_KEY.length < 32 || env.NOTIFY_EMAIL_INGEST_KEY.length > 256) throw new WebhookError(503, "EMAIL_NOT_CONFIGURED");
  try {
    const auth = new URL(env.TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL || "");
    const web = new URL(env.TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN || "");
    const notify = new URL(env.NOTIFY_EMAIL_BASE_URL || "");
    if (notify.protocol !== "https:" || notify.username || notify.password || notify.search || notify.hash || notify.pathname !== "/" || notify.port) throw new Error();
    if (auth.protocol !== "https:" || web.protocol !== "https:" || auth.username || auth.password || auth.search || auth.hash ||
      web.username || web.password || web.search || web.hash || web.pathname !== "/") throw new Error();
    // Endpoint IDs scope events to this Worker’s branch. A shared project must not mix its applications.
    const endpointId = auth.hostname.match(/^(ep-[a-z0-9-]+)\.neonauth\./)?.[1];
    if (!endpointId) throw new Error();
    const parentEndpointId = env.AUTH_EMAIL_PARENT_ENDPOINT_ID;
    if (parentEndpointId !== undefined && !/^ep-[a-z0-9-]{3,100}$/.test(parentEndpointId)) throw new Error();
    return { authBase: auth.href.replace(/\/$/, ""), endpointId, appOrigin: web.origin,
      parentEndpointId,
      notifyBase: notify.origin, ingestKey: env.NOTIFY_EMAIL_INGEST_KEY, defaultLanguage: env.AUTH_EMAIL_DEFAULT_LANGUAGE === "en" ? "en" as const : "fr" as const };
  } catch { throw new WebhookError(503, "EMAIL_NOT_CONFIGURED"); }
}

async function readBody(request: Request): Promise<Uint8Array> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) throw new WebhookError(415, "INVALID_WEBHOOK");
  const declared = request.headers.get("Content-Length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBodyBytes)) throw new WebhookError(413, "WEBHOOK_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new WebhookError(400, "INVALID_WEBHOOK");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) { await reader.cancel(); throw new WebhookError(413, "WEBHOOK_TOO_LARGE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const raw = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.byteLength; }
  return raw;
}

function b64(value: Uint8Array | string): string {
  return Buffer.from(value).toString("base64url");
}

function signatureInput(headers: Headers, raw: Uint8Array, now: number): string {
  const signature = headers.get("x-neon-signature") || "";
  const kid = headers.get("x-neon-signature-kid") || "";
  const timestamp = headers.get("x-neon-timestamp") || "";
  if (!kid || kid.length > 200 || signature.length > 4096 || !/^\d{13}$/.test(timestamp) ||
    now - Number(timestamp) > 5 * 60_000 || Number(timestamp) - now > 60_000) throw new WebhookError(401, "INVALID_WEBHOOK_SIGNATURE");
  const parts = signature.split(".");
  if (parts.length !== 3 || parts[1] !== "" || !parts[0] || !parts[2]) throw new WebhookError(401, "INVALID_WEBHOOK_SIGNATURE");
  try {
    const header = decodeProtectedHeader(signature);
    if (header.alg !== "EdDSA" || header.kid !== kid || header.b64 === false || header.crit?.length) throw new Error();
  } catch { throw new WebhookError(401, "INVALID_WEBHOOK_SIGNATURE"); }
  // Neon signs base64url(timestamp + "." + base64url(raw bytes)) as the JWS payload.
  // Verify the original bytes; never reserialize the request before checking its signature.
  return parts[0] + "." + b64(timestamp + "." + b64(raw)) + "." + parts[2];
}

function parseEvent(raw: Uint8Array, headers: Headers, config: ReturnType<typeof configuration>, now: number) {
  let body: Record<string, unknown> | null;
  try { body = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw))); }
  catch { throw new WebhookError(400, "INVALID_WEBHOOK", "envelope"); }
  const user = record(body?.user), context = record(body?.context), data = record(body?.event_data);
  if (!body || !user || !context || !data) throw new WebhookError(400, "INVALID_WEBHOOK", "envelope");
  if (typeof body.event_id !== "string" || !uuid.test(body.event_id)) throw new WebhookError(400, "INVALID_WEBHOOK", "event_id");
  if (body.event_id !== headers.get("x-neon-event-id") || body.event_type !== headers.get("x-neon-event-type") ||
    !["send.magic_link", "send.otp"].includes(String(body.event_type))) throw new WebhookError(400, "INVALID_WEBHOOK", "event_headers");
  // A cloned Neon branch can retain its parent's context label. This explicit mapping
  // applies to links only: the original signed link must still pass the branch URL check below.
  const mappedParentLink = body.event_type === "send.magic_link" && config.parentEndpointId !== undefined && context.endpoint_id === config.parentEndpointId;
  if (context.endpoint_id !== config.endpointId && !mappedParentLink) throw new WebhookError(400, "INVALID_WEBHOOK", "endpoint", {
    expected: config.endpointId,
    received: typeof context.endpoint_id === "string" && /^ep-[a-z0-9-]{3,100}$/.test(context.endpoint_id) ? context.endpoint_id : "unexpected_format"
  });
  if (typeof user.email !== "string" || user.email.length > 254 || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(user.email))
    throw new WebhookError(400, "INVALID_WEBHOOK", "recipient");
  if (typeof body.timestamp !== "string" || !Number.isFinite(Date.parse(body.timestamp)) ||
    Date.parse(body.timestamp) > now + 60_000 || now - Date.parse(body.timestamp) > 5 * 60_000)
    throw new WebhookError(400, "INVALID_WEBHOOK", "timestamp");
  if (typeof data.expires_at !== "string" || !Number.isFinite(Date.parse(data.expires_at)) || Date.parse(data.expires_at) <= now ||
    Date.parse(data.expires_at) <= Date.parse(body.timestamp)) throw new WebhookError(400, "INVALID_WEBHOOK", "expiry");
  const purpose = body.event_type === "send.magic_link" ? data.link_type : data.otp_type;
  if (typeof purpose !== "string" || !purposes.has(purpose)) throw new WebhookError(400, "UNSUPPORTED_EMAIL", "purpose");
  if (data.delivery_preference !== undefined && data.delivery_preference !== "email") throw new WebhookError(400, "UNSUPPORTED_EMAIL", "channel");
  const common = { recipient: user.email, name: typeof user.name === "string" ? user.name.slice(0, 120) : undefined,
    language: config.defaultLanguage as EmailLanguage, appOrigin: config.appOrigin, purpose: purpose as AuthEmailPurpose,
    issuedAt: body.timestamp, expiresAt: data.expires_at };
  let message: AuthEmailMessage;
  if (body.event_type === "send.magic_link") {
    if (typeof data.link_url !== "string" || data.link_url.length > 16_384 || /[\r\n]/.test(data.link_url)) throw new WebhookError(400, "INVALID_WEBHOOK", "link_format");
    let url: URL;
    try { url = new URL(data.link_url); } catch { throw new WebhookError(400, "INVALID_WEBHOOK", "link_format"); }
    const auth = new URL(config.authBase);
    if (url.origin !== auth.origin || !url.pathname.startsWith(auth.pathname + "/") || url.username || url.password || url.hash) throw new WebhookError(400, "INVALID_WEBHOOK", "link_origin");
    // Locale comes only from an app callback on our configured origin. Never use the webhook caller's locale.
    try {
      const callback = new URL(url.searchParams.get("callbackURL") || "");
      const language = callback.searchParams.get("lang");
      if (callback.origin === config.appOrigin && callback.pathname === "/app/email-link" && (language === "fr" || language === "en")) common.language = language;
    } catch { /* Other auth links use the configured default language. */ }
    message = { ...common, kind: "link", url: data.link_url };
  } else {
    if (typeof data.otp_code !== "string" || !/^\d{6}$/.test(data.otp_code)) throw new WebhookError(400, "INVALID_WEBHOOK", "otp_format");
    message = { ...common, kind: "otp", code: data.otp_code };
  }
  return { message, idempotencyKey: `commerce-auth/${config.endpointId}/${body.event_type}/${body.event_id}` };
}

export function registerAuthEmailRoutes(app: Hono<AppEnv>, dependencies: AuthEmailDependencies = {}) {
  const fetcher = dependencies.fetcher || fetch, now = dependencies.now || Date.now;
  const keysets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
  app.post("/v1/webhooks/neon-auth", async c => {
    c.header("Cache-Control", "no-store");
    let signatureVerified = false, phase: "verification" | "event" | "notify" = "verification";
    try {
      const config = configuration(c.env), raw = await readBody(c.req.raw);
      const signed = signatureInput(c.req.raw.headers, raw, now());
      let keys = keysets.get(config.authBase);
      if (!keys) {
        keys = createRemoteJWKSet(new URL(config.authBase + "/.well-known/jwks.json"), {
          timeoutDuration: 2000, cooldownDuration: 30_000, cacheMaxAge: 10 * 60_000,
          // workerd rejects redirect:"error" before making a request. JOSE requires HTTP 200,
          // so manual handling rejects redirected key sets without following another host.
          [customFetch]: (url, options) => fetcher(url, { ...options, redirect: "manual" })
        });
        keysets.set(config.authBase, keys);
      }
      try { await compactVerify(signed, keys, { algorithms: ["EdDSA"] }); }
      catch (error) {
        const code = error && typeof error === "object" && "code" in error ? error.code : "";
        if (["ERR_JWS_SIGNATURE_VERIFICATION_FAILED", "ERR_JWKS_NO_MATCHING_KEY", "ERR_JOSE_ALG_NOT_ALLOWED", "ERR_JWS_INVALID"].includes(String(code))) throw new WebhookError(401, "INVALID_WEBHOOK_SIGNATURE");
        throw new WebhookError(503, "WEBHOOK_VERIFICATION_UNAVAILABLE");
      }
      signatureVerified = true; phase = "event";
      const { message, idempotencyKey } = parseEvent(raw, c.req.raw.headers, config, now());
      phase = "notify";
      await sendTransactionalEmail({ baseUrl: config.notifyBase, ingestKey: config.ingestKey, recipient: message.recipient,
        idempotencyKey, occurredAt: message.issuedAt, expiresAt: message.expiresAt, message: buildAuthEmail(message) }, fetcher);
      return c.json({ accepted: true });
    } catch (error) {
      const failure = error instanceof WebhookError ? error : new WebhookError(503, "EMAIL_DELIVERY_UNAVAILABLE");
      // Fixed codes only: no payload, recipient, link, token, provider error or credential.
      if (signatureVerified) console.warn(JSON.stringify({ event: "commerce_auth_email_failed", phase,
        code: failure.code, status: failure.status, diagnostic: failure.diagnostic, endpoint: failure.endpoint }));
      if (failure.status === 503) c.header("Retry-After", "1");
      return c.json({ error: failure.code }, failure.status);
    }
  });
}
