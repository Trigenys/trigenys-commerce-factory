import assert from "node:assert/strict";
import test from "node:test";
import { CompactSign, exportJWK, generateKeyPair } from "jose";
import { createApp } from "../src/app.ts";
import type { WorkerBindings } from "../src/types.ts";

const now = Date.parse("2026-10-28T10:00:00.000Z");
const auth = "https://ep-mail-test.neonauth.c-6.eu-central-1.aws.neon.tech/commerce_factory/auth";
const web = "https://commerce.example";
const id = "11111111-1111-4111-8111-111111111111";
const { privateKey, publicKey } = await generateKeyPair("EdDSA");
const jwk = { ...await exportJWK(publicKey), kid: "mail-test", alg: "EdDSA", use: "sig" };
const env: WorkerBindings = { AUTH_EMAIL_ENABLED: "true", RESEND_API_KEY: "test-only-not-a-real-secret",
  TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL: auth, TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN: web };

function event(language = "fr") {
  const callback = web + "/app/email-link?flow=" + id + "&lang=" + language;
  return { event_id: id, event_type: "send.magic_link", timestamp: new Date(now).toISOString(),
    context: { endpoint_id: "ep-mail-test", project_name: "Shared project (not the brand)" },
    user: { email: "merchant@example.com", name: "Jennifer <script>" },
    event_data: { link_type: "sign-in", link_url: auth + "/magic-link/verify?token=fixture-only&callbackURL=" + encodeURIComponent(callback),
      token: "raw-token-must-not-appear", expires_at: new Date(now + 5 * 60_000).toISOString() } };
}

async function signed(body: object | string, timestamp = String(now), alg = "EdDSA") {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const parsed = JSON.parse(raw);
  const signingPayload = Buffer.from(timestamp + "." + Buffer.from(raw).toString("base64url"));
  const compact = await new CompactSign(signingPayload).setProtectedHeader({ alg: "EdDSA", typ: "JWS", kid: "mail-test" }).sign(privateKey);
  const [header, , signature] = compact.split(".");
  const headers = new Headers({ "Content-Type": "application/json", "X-Neon-Signature": header + ".." + signature,
    "X-Neon-Signature-Kid": "mail-test", "X-Neon-Timestamp": timestamp,
    "X-Neon-Event-Id": parsed.event_id, "X-Neon-Event-Type": parsed.event_type });
  if (alg !== "EdDSA") headers.set("X-Neon-Signature", Buffer.from(JSON.stringify({ alg, kid: "mail-test" })).toString("base64url") + ".." + signature);
  return { raw, headers };
}

function fixture(overrides: { provider?: (request: Request) => Promise<Response>; jwksStatus?: number } = {}) {
  const sends: Request[] = [], payloads: Record<string, unknown>[] = []; let jwksReads = 0, clock = now;
  const fetcher: typeof fetch = async (url, init) => {
    const request = new Request(url, init);
    if (request.url === auth + "/.well-known/jwks.json") {
      jwksReads++; return Response.json({ keys: [jwk] }, { status: overrides.jwksStatus || 200 });
    }
    assert.equal(request.url, "https://api.resend.com/emails");
    sends.push(request); payloads.push(await request.clone().json());
    return overrides.provider ? overrides.provider(request) : Response.json({ id: "mail-provider-fixture" });
  };
  const app = createApp({ authEmail: { fetcher, now: () => clock } });
  return { app, sends, payloads, jwksReads: () => jwksReads, advance: (ms: number) => { clock += ms; },
    async post(data: Awaited<ReturnType<typeof signed>>, bindings = env) {
      return app.request("/v1/webhooks/neon-auth", { method: "POST", headers: data.headers, body: data.raw }, bindings);
    } };
}

test("a signed event sends a branded FR/EN email through Resend with the original Neon link", async () => {
  for (const language of ["fr", "en"]) {
    const f = fixture(), e = event(language), r = await f.post(await signed(e));
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), { accepted: true });
    assert.equal(r.headers.get("Cache-Control"), "no-store"); assert.equal(f.sends.length, 1);
    const p = f.payloads[0], html = String(p.html), text = String(p.text);
    assert.equal(p.from, "Commerce Factory <commercefactory@trigenys.com>"); assert.deepEqual(p.to, ["merchant@example.com"]);
    assert.match(String(p.subject), language === "fr" ? /Votre lien de connexion/ : /Your sign-in link/);
    assert.ok(html.includes('<html lang="' + language + '">')); assert.ok(html.includes("Jennifer &lt;script&gt;"));
    assert.ok(text.includes(e.event_data.link_url)); assert.ok(!html.includes("raw-token-must-not-appear"));
    assert.ok(!html.includes("Shared project")); assert.ok(!html.includes("sent by Neon"));
    assert.equal(f.sends[0].headers.get("Idempotency-Key"), `commerce-auth/ep-mail-test/send.magic_link/${id}`);
    assert.equal(f.sends[0].headers.get("Authorization"), "Bearer " + env.RESEND_API_KEY);
    assert.equal(f.sends[0].redirect, "error");
  }
});

test("retries use a stable key and byte-identical message, while JWKS is cached", async () => {
  const f = fixture(), e = event(), s = await signed(e);
  assert.equal((await f.post(s)).status, 200); f.advance(1000);
  assert.equal((await f.post(await signed(e, String(now + 1000)))).status, 200);
  assert.equal(await f.sends[0].text(), await f.sends[1].text());
  assert.equal(f.sends[0].headers.get("Idempotency-Key"), f.sends[1].headers.get("Idempotency-Key"));
  assert.equal(f.jwksReads(), 1);
});

test("raw bytes including whitespace are verified before JSON parsing", async () => {
  const f = fixture(), e = event();
  const s = await signed(JSON.stringify(e, null, 2));
  assert.equal((await f.post(s)).status, 200);
  const changed = { ...s, raw: JSON.stringify(e) };
  assert.equal((await f.post(changed)).status, 401); assert.equal(f.sends.length, 1);
});

test("unsigned, tampered, wrong-algorithm, missing-kid, stale and future requests cannot send", async () => {
  const s = await signed(event());
  const cases = [
    { ...s, headers: new Headers({ "Content-Type": "application/json" }) },
    { ...s, raw: s.raw.replace("merchant@example.com", "attacker@example.com") },
    await signed(event(), String(now), "none"), await signed(event(), String(now), "HS256"),
    await signed(event(), String(now - 300_001)), await signed(event(), String(now + 60_001)),
    { ...s, headers: new Headers(s.headers) }
  ];
  cases.at(-1)!.headers.set("X-Neon-Signature-Kid", "other-key");
  for (const c of cases) { const f = fixture(); assert.equal((await f.post(c)).status, 401); assert.equal(f.sends.length, 0); }
});

test("wrong branch, event headers, expired links, unknown events and unsafe URLs are rejected", async () => {
  const wrongBranch = event(); wrongBranch.context.endpoint_id = "ep-other-branch";
  const expired = event(); expired.event_data.expires_at = new Date(now - 1).toISOString();
  const otherOrigin = event(); otherOrigin.event_data.link_url = "https://evil.example/magic-link/verify?token=x";
  const otherDb = event(); otherDb.event_data.link_url = auth.replace("commerce_factory", "other_db") + "/magic-link/verify?token=x";
  const unknown = event(); unknown.event_type = "user.created";
  const malformedRecipient = event(); malformedRecipient.user.email = "victim@example.com,attacker@example.com";
  for (const e of [wrongBranch, expired, otherOrigin, otherDb, unknown, malformedRecipient]) {
    const f = fixture(); assert.equal((await f.post(await signed(e))).status, 400); assert.equal(f.sends.length, 0);
  }
  for (const header of ["X-Neon-Event-Id", "X-Neon-Event-Type"]) {
    const s = await signed(event()); s.headers.set(header, "other");
    const f = fixture(); assert.equal((await f.post(s)).status, 400); assert.equal(f.sends.length, 0);
  }
});

test("only the configured app callback can select English; unknown locales use French", async () => {
  for (const callback of ["https://evil.example/app/email-link?lang=en", web + "/other?lang=en", web + "/app/email-link?lang=de"]) {
    const e = event(), url = new URL(e.event_data.link_url); url.searchParams.set("callbackURL", callback); e.event_data.link_url = url.href;
    const f = fixture(); assert.equal((await f.post(await signed(e))).status, 200); assert.match(String(f.payloads[0].html), /<html lang="fr">/);
  }
});

test("verification and password-reset email OTPs render, without silently treating SMS as email", async () => {
  for (const purpose of ["sign-in", "email-verification", "forget-password"]) {
    const original = event(), e = { ...original, event_type: "send.otp", event_data: { otp_code: "123456", otp_type: purpose, expires_at: original.event_data.expires_at, delivery_preference: "email" } };
    const f = fixture(); assert.equal((await f.post(await signed(e))).status, 200);
    assert.ok(String(f.payloads[0].html).includes("123456")); assert.ok(String(f.payloads[0].text).includes("123456"));
    const sms = fixture(); assert.equal((await sms.post(await signed({ ...e, event_data: { ...e.event_data, delivery_preference: "sms" } }))).status, 400); assert.equal(sms.sends.length, 0);
  }
});

test("disabled or incomplete configuration fails closed without reaching either provider", async () => {
  for (const bindings of [{ ...env, AUTH_EMAIL_ENABLED: "false" }, { ...env, RESEND_API_KEY: "" }, { ...env, TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL: "" }, { ...env, TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN: "http://insecure.example" }]) {
    const f = fixture(), r = await f.post(await signed(event()), bindings);
    assert.equal(r.status, 503); assert.equal(f.jwksReads(), 0); assert.equal(f.sends.length, 0);
  }
});

test("provider errors and ambiguous acceptance fail with sanitized, retryable responses", async () => {
  for (const status of [401, 409, 422, 429, 500, 503, 200]) {
    const f = fixture({ provider: async () => Response.json({ message: "secret-token merchant@example.com" }, { status }) });
    const r = await f.post(await signed(event())); assert.equal(r.status, 503); assert.equal(r.headers.get("Retry-After"), "1");
    const text = await r.text(); assert.equal(text.includes("secret-token"), false); assert.equal(text.includes("merchant@example.com"), false);
    assert.equal(text.includes(env.RESEND_API_KEY!), false);
  }
  const unavailable = fixture({ provider: async () => { throw new Error("secret-token"); } });
  assert.equal((await unavailable.post(await signed(event()))).status, 503);
  const jwksDown = fixture({ jwksStatus: 503 }); assert.equal((await jwksDown.post(await signed(event()))).status, 503); assert.equal(jwksDown.sends.length, 0);
});

test("provider timeout aborts delivery within the blocking webhook budget", async () => {
  const f = fixture({ provider: request => new Promise((_resolve, reject) => request.signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true })) });
  assert.equal((await f.post(await signed(event()))).status, 503);
});

test("request size and content type are bounded before JWKS or email delivery", async () => {
  const f = fixture(), s = await signed(event());
  const large = { ...s, raw: "x".repeat(32769) }; assert.equal((await f.post(large)).status, 413);
  const wrongType = { ...s, headers: new Headers(s.headers) }; wrongType.headers.set("Content-Type", "text/plain");
  assert.equal((await f.post(wrongType)).status, 415); assert.equal(f.jwksReads(), 0); assert.equal(f.sends.length, 0);
});
