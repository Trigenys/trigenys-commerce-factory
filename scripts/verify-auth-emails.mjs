// Render fictional signed-event content only. This script does not request a magic link or send email.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { buildAuthEmail } from "../backend/src/auth-email-templates.ts";

const output = "artifacts/auth-emails";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const logo = await readFile("public/commerce-factory-logo-v3.png");
const axe = await readFile("node_modules/axe-core/axe.min.js", "utf8");
const report = { checks: [], screens: [], unverified: ["Rendering uses fictional events. Resend acceptance, inbox delivery and live Neon token redemption require server secrets and branch webhook activation."] };
try {
  for (const [language, kind, width] of [["fr", "link", 1440], ["fr", "link", 390], ["en", "link", 390], ["fr", "otp", 390]]) {
    const name = `${kind}-${language}-${width}`;
    const message = buildAuthEmail({ language, recipient: "merchant@example.com", name: "Jennifer", purpose: "sign-in", appOrigin: "https://commerce.example",
      issuedAt: "2026-10-28T10:00:00.000Z", expiresAt: "2026-10-28T10:05:00.000Z",
      ...(kind === "link" ? { kind, url: "https://auth.example/magic-link/verify?token=fictional-preview-only" } : { kind, code: "123456" }) });
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.route("**/*", route => route.request().url().endsWith("/commerce-factory-logo-v3.png")
      ? route.fulfill({ status: 200, contentType: "image/png", body: logo }) : route.abort());
    await page.setContent(message.html, { waitUntil: "networkidle" });
    assert.equal(await page.locator("html").getAttribute("lang"), language);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ": overflow");
    assert.equal(await page.getByRole("heading", { level: 1 }).isVisible(), true);
    assert.equal(await page.getByRole("img", { name: "Commerce Factory by Trigenys" }).evaluate(img => img.complete && img.naturalWidth > 0), true);
    if (kind === "link") {
      const button = page.getByRole("link", { name: language === "fr" ? "Me connecter" : "Sign in", exact: true });
      assert.equal(await button.getAttribute("href"), "https://auth.example/magic-link/verify?token=fictional-preview-only");
      assert.ok((await button.boundingBox()).height >= 44);
      assert.equal(await page.getByText("https://auth.example", { exact: false }).count(), 0, "Raw auth URLs stay out of the visible HTML");
    }
    await page.evaluate(axe);
    const failures = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations.filter(v => ["serious", "critical"].includes(v.impact)).map(v => v.id));
    assert.deepEqual(failures, [], name + ": accessibility");
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
    await writeFile(`${output}/${name}.html`, message.html);
    await writeFile(`${output}/${name}.txt`, message.text);
    report.screens.push(name); report.checks.push(`${name}: brand asset, language, action, expiry, text alternative, overflow and accessibility`);
    await page.close();
  }
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
