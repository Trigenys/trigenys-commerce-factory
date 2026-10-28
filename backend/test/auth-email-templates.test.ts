import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthEmail, type AuthEmailPurpose } from "../src/auth-email-templates.ts";

test("all auth templates have HTML/text actions, readable expiry, escaped user data and brand links", () => {
  for (const language of ["fr", "en"] as const) for (const purpose of ["sign-in", "email-verification", "forget-password"] as AuthEmailPurpose[]) for (const kind of ["link", "otp"] as const) {
    const message = buildAuthEmail({ recipient: "merchant@example.com", name: '<img src=x onerror="alert(1)">', language, purpose,
      appOrigin: "https://commerce.example", issuedAt: "2026-12-31T23:59:00.000Z", expiresAt: "2027-01-01T00:04:00.000Z",
      ...(kind === "link" ? { kind, url: 'https://auth.example/verify?token=fixture&callbackURL=https%3A%2F%2Fcommerce.example' } : { kind, code: "001234" }) });
    assert.match(message.html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/); assert.equal(message.html.includes('<img src=x'), false);
    assert.ok(message.html.includes("/commerce-factory-logo-v3.png")); assert.ok(message.html.includes("/help")); assert.ok(message.html.includes("/privacy"));
    assert.ok(message.html.includes("UTC")); assert.ok(message.html.includes("© 2026")); assert.ok(!message.subject.includes("001234"));
    assert.ok(message.text.includes(kind === "otp" ? "001234" : "https://auth.example/verify?token=fixture&callbackURL="));
    assert.ok(!message.html.includes("Roadmap")); assert.ok(!message.html.includes("Neon Auth"));
  }
});
