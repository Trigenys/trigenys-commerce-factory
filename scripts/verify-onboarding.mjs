// Isolated UI/provider/API fixtures. No real account, email, token or write.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { brandFixture, storeId, product } from "./brand-fixture.mjs";

const base = "http://127.0.0.1:5182", output = "artifacts/onboarding";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5182", "--strictPort"], {
  stdio: "pipe", env: { ...process.env, VITE_API_BASE_URL: "http://127.0.0.1:8787" }
});
let logs = "", browser, current;
const runtimeErrors = [];
server.stdout.on("data", b => logs += b); server.stderr.on("data", b => logs += b);
const report = { checks: [], screens: [], limitations: ["Provider, API and media responses are isolated fixtures. These checks do not prove live authentication, production persistence or merchant usability."] };
const axe = await readFile("node_modules/axe-core/axe.min.js", "utf8");
const photo = await readFile("public/themes/beauty-v1-480.webp");

async function fixture(options = {}) {
  const f = await brandFixture(browser, base, { hasStore: false, ...options }); current = f.page;
  f.page.on("pageerror", error => runtimeErrors.push(error.message));
  f.page.on("console", message => { if (message.type() === "error" && /Cannot update a component|Maximum update depth|Invalid hook|Each child in a list/.test(message.text())) runtimeErrors.push(message.text()); });
  if (!options.hasStore) f.state.products = [];
  f.uploads = 0;
  await f.page.route(/\/v1\/admin\/stores\/[^/]+\/media(?:\/|$)/, async route => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" } });
    if (request.method() === "GET") return route.fulfill({ contentType: "image/webp", body: photo, headers: { "Access-Control-Allow-Origin": "*" } });
    const form = await new Request(request.url(), { method: "POST", headers: request.headers(), body: request.postDataBuffer() }).formData();
    assert.ok(form.get("file") instanceof Blob); assert.ok(f.state.products.some(item => item.id === form.get("productId")));
    f.uploads++;
    const publicId = "44444444-4444-4444-8444-" + String(f.uploads).padStart(12, "0");
    return route.fulfill({ status: 201, headers: { "Access-Control-Allow-Origin": "*" }, json: { media: { id: publicId, publicId, storeId, productId: form.get("productId"), kind: "product", publicUrl: "https://media.example.test/v1/media/" + publicId } } });
  });
  return f;
}
async function screen(page, label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, label + ": overflow");
  await page.evaluate(axe);
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations.filter(v => ["serious", "critical"].includes(v.impact)).map(v => ({ id: v.id, targets: v.nodes.map(n => n.target), details: v.nodes.map(n => n.failureSummary) })));
  assert.deepEqual(violations, [], label + ": accessibility");
  assert.deepEqual(await page.locator("img:visible").evaluateAll(images => images.filter(image => image.complete && !image.naturalWidth).map(image => image.src)), [], label + ": images");
  await page.screenshot({ path: output + "/" + label + ".png", fullPage: true }); report.screens.push(label);
}
async function reachProduct(f, language = "fr") {
  const { page } = f, fr = language === "fr";
  await page.goto(base + "/app");
  await page.getByLabel(fr ? "Nom de la boutique" : "Store name", { exact: true }).fill("Maison Sève");
  await page.getByRole("button", { name: fr ? "Beauté & soins" : "Beauty & haircare", exact: false }).click();
  await page.getByRole("button", { name: fr ? "Continuer →" : "Continue →", exact: true }).click();
  await page.getByLabel(fr ? "Numéro WhatsApp" : "WhatsApp number", { exact: true }).fill("+237670000001");
  await page.getByRole("button", { name: fr ? "Continuer →" : "Continue →", exact: true }).click();
  await page.getByRole("button", { name: fr ? "Enregistrer et ajouter un produit →" : "Save and add a product →", exact: true }).click();
  await page.getByLabel(fr ? "Nom du produit" : "Product name", { exact: true }).waitFor();
}
try {
  await mkdir(output, { recursive: true }); let ready = false;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await delay(100); } assert.ok(ready, logs);
  browser = await chromium.launch({ headless: true });
  for (const [language, width] of [["fr", 1440], ["fr", 390], ["en", 320]]) {
    const f = await fixture({ language, width }), { page, state, context } = f, fr = language === "fr";
    await page.goto(base + "/app");
    await page.getByRole("heading", { name: fr ? "Donnons vie à votre boutique." : "Let’s bring your store to life.", level: 1, exact: true }).waitFor();
    assert.equal(await page.getByLabel(fr ? "Email de contact public" : "Public contact email", { exact: true }).isVisible(), false);
    await screen(page, "identity-" + language + "-" + width);
    await page.getByLabel(fr ? "Nom de la boutique" : "Store name", { exact: true }).fill("Maison Sève");
    assert.match(await page.locator(".setup-link").innerText(), /maison-seve/);
    await page.getByRole("button", { name: fr ? "Beauté & soins" : "Beauty & haircare", exact: false }).click();
    if (width < 1051) {
      const toggle = page.getByRole("button", { name: fr ? "Voir l’aperçu ↗" : "View preview ↗", exact: true });
      await toggle.click(); await page.getByRole("dialog").waitFor();
      assert.ok(await page.getByRole("dialog").getByText("Maison Sève", { exact: true }).count());
      await screen(page, "preview-" + language + "-" + width);
      await page.keyboard.press("Escape"); assert.equal(await toggle.evaluate(e => e === document.activeElement), true);
    }
    await page.getByRole("button", { name: fr ? "Continuer →" : "Continue →", exact: true }).click();
    await page.getByRole("button", { name: fr ? "Continuer →" : "Continue →", exact: true }).click();
    assert.equal(await page.getByLabel(fr ? "Numéro WhatsApp" : "WhatsApp number", { exact: true }).getAttribute("aria-invalid"), "true");
    await page.getByLabel(fr ? "Numéro WhatsApp" : "WhatsApp number", { exact: true }).fill("+237670000001");
    await screen(page, "contact-" + language + "-" + width);
    await page.getByRole("button", { name: fr ? "← Retour" : "← Back", exact: true }).click();
    assert.equal(await page.getByLabel(fr ? "Nom de la boutique" : "Store name", { exact: true }).inputValue(), "Maison Sève");
    await page.reload();
    assert.equal(await page.getByLabel(fr ? "Nom de la boutique" : "Store name", { exact: true }).inputValue(), "Maison Sève");
    await page.getByRole("button", { name: fr ? "Continuer →" : "Continue →", exact: true }).click();
    assert.equal(await page.getByLabel(fr ? "Numéro WhatsApp" : "WhatsApp number", { exact: true }).inputValue(), "+237670000001");
    await page.getByRole("button", { name: fr ? "Continuer →" : "Continue →", exact: true }).click();
    assert.equal(await page.getByLabel(fr ? "Secteur d’activité" : "Business sector", { exact: true }).inputValue(), "beauty");
    assert.equal(await page.locator(".theme-picker-grid > button").count(), 2);
    await screen(page, "style-" + language + "-" + width);
    await page.getByRole("button", { name: fr ? "Enregistrer et ajouter un produit →" : "Save and add a product →", exact: true }).click();
    await page.getByLabel(fr ? "Nom du produit" : "Product name", { exact: true }).fill("Sérum éclat");
    await page.getByLabel(fr ? "Prix" : "Price", { exact: true }).fill("12500");
    assert.equal(state.store.contactEmail, ""); assert.equal(state.store.status, "draft"); assert.equal(state.products.length, 0);
    assert.equal(state.calls.filter(c => c.path === "/v1/admin/stores" && c.method === "POST").length, 1);
    await page.getByLabel(fr ? "Ajouter des images" : "Add images", { exact: true }).setInputFiles({ name: "serum.webp", mimeType: "image/webp", buffer: photo });
    assert.equal(f.uploads, 0, "Files are not uploaded before save");
    await screen(page, "first-product-" + language + "-" + width);
    await page.reload();
    await page.getByLabel(fr ? "Nom du produit" : "Product name", { exact: true }).waitFor();
    assert.equal(await page.getByLabel(fr ? "Nom du produit" : "Product name", { exact: true }).inputValue(), "Sérum éclat");
    assert.equal(await page.locator(".setup-queued-note").count(), 0, "Files are not falsely persisted across reload");
    await page.getByLabel(fr ? "Ajouter des images" : "Add images", { exact: true }).setInputFiles({ name: "serum.webp", mimeType: "image/webp", buffer: photo });
    let failedAttachment = false;
    await page.route(/\/v1\/admin\/stores\/[^/]+\/products\/[^/]+$/, async route => {
      if (route.request().method() === "PATCH" && !failedAttachment) { failedAttachment = true; return route.fulfill({ status: 503, headers: { "Access-Control-Allow-Origin": "*" }, json: { error: "UNAVAILABLE" } }); }
      return route.fallback();
    });
    await page.getByRole("button", { name: fr ? "Enregistrer le produit" : "Save product", exact: true }).click();
    await page.locator(".catalog-editor").waitFor(); await page.getByRole("alert").first().waitFor();
    assert.equal(state.products.length, 1); assert.equal(state.products[0].status, "draft"); assert.equal(f.uploads, 1);
    await page.getByRole("button", { name: fr ? "Enregistrer le produit" : "Save product", exact: true }).click();
    await page.locator(".catalog-editor").waitFor({ state: "hidden" });
    assert.equal(state.products.length, 1); assert.equal(f.uploads, 1, "Retry retains confirmed media");
    assert.equal(state.products[0].status, "active");
    assert.equal(state.calls.filter(c => c.path.endsWith("/products") && c.method === "POST").length, 1);
    await page.getByRole("button", { name: fr ? "Vérifier ma boutique →" : "Review my store →", exact: true }).click();
    await page.getByRole("button", { name: fr ? "Publier ma boutique ↗" : "Publish my store ↗", exact: true }).waitFor();
    assert.equal(state.store.status, "draft");
    await screen(page, "review-" + language + "-" + width);
    let failedPublish = false;
    await page.route("**/publish", async route => {
      if (!failedPublish) { failedPublish = true; return route.fulfill({ status: 503, headers: { "Access-Control-Allow-Origin": "*" }, json: { error: "UNAVAILABLE" } }); }
      return route.fallback();
    });
    await page.getByRole("button", { name: fr ? "Publier ma boutique ↗" : "Publish my store ↗", exact: true }).click();
    await page.locator(".setup-operation-error").waitFor(); assert.equal(state.store.status, "draft");
    await page.getByRole("button", { name: fr ? "Publier ma boutique ↗" : "Publish my store ↗", exact: true }).click();
    await page.getByRole("heading", { name: fr ? "Votre boutique est en ligne !" : "Your store is live!", level: 1, exact: true }).waitFor();
    assert.equal(state.store.status, "published"); await screen(page, "published-" + language + "-" + width);
    assert.equal(await page.locator(".setup-card-heading").count(), 0);
    report.checks.push(language + "/" + width + ": guided creation, preview, validation, draft reload, queued media, partial-failure recovery, explicit publishing");
    await context.close();
  }
  {
    const f = await fixture({ hasStore: true }), { context, page, state } = f; state.store.status = "draft";
    await page.goto(base + "/app"); await page.getByRole("heading", { name: "Tableau de bord", level: 1, exact: true }).waitFor();
    await page.getByRole("link", { name: "Reprendre la création guidée de ma boutique ↗", exact: true }).click();
    await page.getByRole("heading", { name: "Place à votre premier produit.", level: 1, exact: true }).waitFor();
    assert.equal(await page.locator(".catalog-editor").count(), 0, "Existing products never create an empty duplicate editor");
    await page.getByRole("button", { name: "Vérifier ma boutique →", exact: true }).click();
    await page.getByRole("button", { name: "Enregistrer en brouillon", exact: true }).click();
    await page.getByRole("heading", { name: "Tableau de bord", exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.has("setup"), false); assert.equal(state.store.status, "draft");
    state.products[0].status = "draft";
    await page.goto(base + "/app?store=" + storeId + "&setup=1");
    const publish = page.getByRole("button", { name: "Publier ma boutique ↗", exact: true });
    await publish.waitFor(); assert.equal(await publish.isEnabled(), false);
    let failCatalog = true;
    await page.route("**/products", route => route.request().method() === "GET" && failCatalog ? route.fulfill({ status: 503, headers: { "Access-Control-Allow-Origin": "*" }, json: { error: "UNAVAILABLE" } }) : route.fallback());
    await page.reload(); await page.getByRole("alert").waitFor(); assert.equal(await publish.isEnabled(), false);
    failCatalog = false; await page.getByRole("button", { name: "Réessayer", exact: true }).click();
    await page.locator(".setup-review").getByText("0", { exact: true }).waitFor();
    assert.equal(state.calls.filter(c => c.path === "/v1/admin/stores" && c.method === "POST").length, 0);
    report.checks.push("Existing-store opt-in, save-as-draft exit, resume, no active product and catalog-failure publish guards");
    await context.close();
  }
  for (const profile of ["staff", "owner"]) {
    const f = await fixture({ hasStore: true, profile });
    f.state.store.status = profile === "staff" ? "draft" : "published";
    await f.page.goto(base + "/app?store=" + storeId + "&setup=1");
    await f.page.getByRole("heading", { name: "Tableau de bord", exact: true }).waitFor();
    assert.equal(await f.page.locator(".setup-flow").count(), 0);
    report.checks.push(profile + ": existing workspace remains authoritative");
    await f.context.close();
  }
  {
    const f = await fixture();
    await f.context.addInitScript(() => {
      sessionStorage.setItem("commerce-onboarding:owner@example.com", JSON.stringify({
        name: "Ancien brouillon", slug: "ancien-brouillon", whatsappNumber: "", countryCode: "CM", currencyCode: "XAF",
        description: "Description conservée", businessLocation: "", contactEmail: "", theme: "clean", themeSettings: {}
      }));
      sessionStorage.setItem("commerce-onboarding:progress:owner@example.com", JSON.stringify({ version: 1, step: 99, storeId: null, sector: "invalid", slugTouched: true }));
    });
    await f.page.goto(base + "/app"); await f.page.getByLabel("Nom de la boutique", { exact: true }).waitFor();
    assert.equal(await f.page.getByLabel("Nom de la boutique", { exact: true }).inputValue(), "Ancien brouillon");
    await f.page.locator(".setup-optional").getByText("Ajouter une description et des coordonnées", { exact: false }).click();
    assert.equal(await f.page.getByLabel("Courte description", { exact: true }).inputValue(), "Description conservée");
    assert.equal(f.state.calls.filter(c => c.method === "POST").length, 0);
    report.checks.push("Old validated drafts survive; malformed progress cannot skip required setup");
    await f.context.close();
  }
  assert.deepEqual(runtimeErrors, [], "No browser runtime or React state errors");
  await writeFile(output + "/report.json", JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) {
  report.error = error.stack; await mkdir(output, { recursive: true });
  await current?.screenshot({ path: output + "/failure.png", fullPage: true }).catch(() => {});
  await writeFile(output + "/failure-dom.txt", await current?.locator("body").innerText().catch(() => "") || "");
  await writeFile(output + "/report.json", JSON.stringify(report, null, 2)); throw error;
} finally { await browser?.close(); server.kill("SIGTERM"); }
