// Render fictional signed-event content only. This script does not request a magic link or send email.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { buildAuthEmail } from "../backend/src/auth-email-templates.ts";

const output = "artifacts/auth-emails";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const axe = await readFile("node_modules/axe-core/axe.min.js", "utf8");
const report = { checks: [], screens: [], unverified: ["Rendering uses fictional events. Fixture rendering does not prove live mailbox rendering, inbox placement or Neon link redemption."] };
try {
  for (const [language, kind, width] of [["fr", "link", 1440], ["fr", "link", 390], ["en", "link", 390], ["fr", "otp", 390]]) for (const client of ["document", "dark-webmail"]) {
    const name = `${kind}-${language}-${width}-${client}`;
    const message = buildAuthEmail({ language, recipient: "merchant@example.com", name: "Jennifer", purpose: "sign-in", appOrigin: "https://commerce.example",
      issuedAt: "2026-10-28T10:00:00.000Z", expiresAt: "2026-10-28T10:05:00.000Z",
      ...(kind === "link" ? { kind, url: "https://auth.example/magic-link/verify?token=fictional-preview-only" } : { kind, code: "123456" }) });
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const externalRequests=[];
    await page.route("**/*", route => {externalRequests.push(route.request().url());return route.abort();});
    // Webmails can discard <body> attributes and let their dark theme style paragraphs.
    // Keep the original content in that hostile host instead of trusting a standalone preview.
    const content=client==="dark-webmail"
      ? `<!DOCTYPE html><html lang="${language}"><head><meta charset="utf-8"><style>body{background:#18191b}body,p,strong{color:#f7f8f9}</style></head><body>${message.html.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1]}</body></html>`
      : message.html;
    await page.setContent(content, { waitUntil: "networkidle" });
    assert.equal(await page.locator("html").getAttribute("lang"), language);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ": overflow");
    assert.equal(await page.getByRole("heading", { level: 1 }).isVisible(), true);
    assert.equal(await page.getByRole("link", { name: "Commerce Factory by Trigenys",exact:true }).isVisible(), true);
    assert.deepEqual(externalRequests, [], name + ": brand and content remain readable with remote images blocked");
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
    report.screens.push(name); report.checks.push(`${name}: text wordmark, blocked remote images, ${client}, language, action, expiry, text alternative, overflow and accessibility`);
    await page.close();
  }
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
