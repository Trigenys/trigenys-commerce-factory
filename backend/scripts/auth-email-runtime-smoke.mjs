import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { Miniflare } from "miniflare";
import { CompactSign, exportJWK, generateKeyPair } from "jose";

// Exercise the deployment bundle in workerd, not Node's more permissive Fetch API.
// All outbound requests terminate in this fixture. No real mail or credentials are used.
const bundle = resolve(process.argv[2] || ".wrangler-auth-email-smoke/index.js");
const auth = "https://ep-runtime-test.neonauth.c-6.eu-central-1.aws.neon.tech/commerce_factory/auth";
const notify = "https://notify.example";
const web = "https://commerce.example";
const key = "runtime-fixture-only-12345678901234567890";
const { privateKey, publicKey } = await generateKeyPair("EdDSA");
const jwk = { ...await exportJWK(publicKey), kid: "runtime-fixture", alg: "EdDSA", use: "sig" };
const now = Date.now(), id = crypto.randomUUID();
const event = {
  event_id: id, event_type: "send.magic_link", timestamp: new Date(now).toISOString(),
  context: { endpoint_id: "ep-runtime-test" }, user: { email: "merchant@example.com" },
  event_data: { link_type: "sign-in", expires_at: new Date(now + 300_000).toISOString(),
    link_url: auth + "/magic-link/verify?token=fixture-only&callbackURL=" +
      encodeURIComponent(web + "/app/email-link?flow=" + id + "&lang=fr") }
};
const raw = JSON.stringify(event), timestamp = String(now);
const compact = await new CompactSign(Buffer.from(timestamp + "." + Buffer.from(raw).toString("base64url")))
  .setProtectedHeader({ alg: "EdDSA", kid: jwk.kid }).sign(privateKey);
const [header, , signature] = compact.split(".");
const headers = { "content-type": "application/json", "x-neon-signature": header + ".." + signature,
  "x-neon-signature-kid": jwk.kid, "x-neon-timestamp": timestamp,
  "x-neon-event-id": id, "x-neon-event-type": event.event_type };

for (const scenario of ["http", "redirect", "service"]) {
  const redirectKeys = scenario === "redirect";
  const seen = [], sent = [];
  const receiveEmail = async request => {
    assert.equal(request.url, notify + "/v1/dispatch/commerce-factory/email");
    assert.equal(request.headers.get("x-notify-auth"), key);
    const payload = await request.json(); sent.push(payload);
    assert.equal(payload.recipient, "merchant@example.com");
    assert.equal(payload.project, "commerce-factory");
    assert.match(payload.message.subject, /Votre lien de connexion/);
    return Response.json({ accepted: true, project: payload.project, channel: "email", eventId: payload.id }, { status: 202 });
  };
  const mf = new Miniflare({
    modulesRoot: dirname(bundle),
    modules: [{ type: "ESModule", path: bundle }],
    compatibilityDate: "2026-10-08", compatibilityFlags: ["nodejs_compat"],
    bindings: { AUTH_EMAIL_ENABLED: "true", NOTIFY_EMAIL_BASE_URL: notify, NOTIFY_EMAIL_INGEST_KEY: key,
      TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL: auth, TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN: web },
    serviceBindings: scenario === "service" ? { NOTIFY_EMAIL_SERVICE: receiveEmail } : {},
    outboundService: async request => {
      seen.push(request.url);
      if (request.url === auth + "/.well-known/jwks.json") {
        return redirectKeys ? new Response(null, { status: 302, headers: { location: "https://unexpected.example/keys" } })
          : Response.json({ keys: [jwk] });
      }
      assert.notEqual(scenario, "service", "Bound email transport must not use public HTTP");
      return receiveEmail(request);
    }
  });
  try {
    const post = body => mf.dispatchFetch("http://localhost/v1/webhooks/neon-auth", { method: "POST", headers, body });
    const response = await post(raw), result = await response.json();
    if (redirectKeys) {
      assert.equal(response.status, 503);
      assert.equal(result.error, "WEBHOOK_VERIFICATION_UNAVAILABLE");
      assert.deepEqual(seen, [auth + "/.well-known/jwks.json"]);
      assert.equal(sent.length, 0);
    } else {
      assert.equal(response.status, 200, JSON.stringify({ result, seen }));
      assert.deepEqual(result, { accepted: true });
      assert.equal(sent.length, 1);
      const tampered = await post(raw.replace("merchant@example.com", "tampered@example.com"));
      assert.equal(tampered.status, 401);
      assert.equal(sent.length, 1);
    }
  } finally { await mf.dispose(); }
}
console.log("workerd signed-email smoke passed: verified JWKS, HTTP/private-binding Notify dispatch, tamper rejection and no JWKS redirect follow; zero real email.");
