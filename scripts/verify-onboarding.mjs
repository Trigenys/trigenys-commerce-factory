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
  await page.evaluate(() => document.fonts.ready);
  const docks = page.locator('.setup-flow .setup-actions:visible, .setup-first-product .catalog-editor-actions:visible');
  if (await docks.count()) {
    assert.equal(await docks.count(), 1, label + ": one active action group");
    const bounds = await docks.boundingBox(), viewport = page.viewportSize();
    assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height + 1, label + ": actions stay within viewport");
    for (const button of await docks.getByRole("button").all()) {
      const box = await button.boundingBox();
      assert.ok(box && box.height >= 44 && box.y + box.height <= viewport.height + 1, label + ": action target visible");
    }
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, label + ": overflow");
  await page.evaluate(axe);
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations.filter(v => ["serious", "critical"].includes(v.impact)).map(v => ({ id: v.id, targets: v.nodes.map(n => n.target), details: v.nodes.map(n => n.failureSummary) })));
  assert.deepEqual(violations, [], label + ": accessibility");
  assert.deepEqual(await page.locator("img:visible").evaluateAll(images => images.filter(image => image.complete && !image.naturalWidth).map(image => image.src)), [], label + ": images");
  await page.screenshot({ path: output + "/" + label + ".png", fullPage: true }); report.screens.push(label);
}
async function locationValue(page, field, expected) {
  const id = await field.getAttribute("id");
  await page.waitForFunction(({ id, expected }) => document.getElementById(id)?.value === expected, { id, expected });
  assert.equal(await field.inputValue(), expected);
}
async function checkLocation(page, language, width) {
  const fr = language === "fr";
  await page.locator(".setup-optional").first().locator("summary").click();
  const location = page.getByRole("combobox", { name: fr ? "Localisation" : "Business location", exact: true });
  await location.fill("Doula");
  await page.getByRole("option", { name: /^Douala / }).waitFor();
  await screen(page, "location-" + language + "-" + width);
  await location.press("ArrowDown"); assert.equal(await location.inputValue(), "Doula");
  await location.press("Enter"); await locationValue(page, location, "Douala");
  assert.equal(await page.getByRole("heading", { name: fr ? "Donnons vie à votre boutique." : "Let’s bring your store to life.", exact: true }).count(), 1, "Selecting a city does not submit the form");
  await location.fill("Duoala"); await location.press("ArrowDown"); await location.press("Enter");
  await locationValue(page, location, "Douala");
  await location.fill("yaounde"); await page.getByRole("option", { name: /^Yaoundé / }).click();
  await locationValue(page, location, "Yaoundé");
  await location.fill("Doula"); await location.press("ArrowDown"); await location.press("Tab");
  await page.locator(".location-options").waitFor({ state: "hidden" });
  assert.equal(await location.inputValue(), "Doula", "Blur never accepts a highlighted suggestion");
  await location.click(); await location.press("Escape"); assert.equal(await location.inputValue(), "Doula");
  await location.press("Escape"); assert.equal(await location.inputValue(), "Doula", "Escape on a closed list does not erase input");
  await location.fill("Doula, Bonapriso"); await page.getByRole("option", { name: /^Douala, Bonapriso / }).click();
  await locationValue(page, location, "Douala, Bonapriso");
  await location.fill("Bonapriso, face au marché");
  await page.getByRole("option", { name: fr ? /^Conserver « Bonapriso, face au marché »/ : /^Keep « Bonapriso, face au marché »/ }).click();
  assert.equal(await location.inputValue(), "Bonapriso, face au marché");
  report.checks.push(language + "/" + width + ": location typo/accents, repeat selection, explicit free text, preserved neighbourhood, blur and Escape");
}
async function phoneValue(page, expected) {
  await page.waitForFunction(expected => {
    const key = Object.keys(sessionStorage).find(key => key.startsWith("commerce-onboarding:owner@example.com") && !key.includes(":progress:"));
    return key && JSON.parse(sessionStorage.getItem(key))?.whatsappNumber === expected;
  }, expected);
}
async function checkPhone(page, language, width) {
  const fr = language === "fr";
  const phone = page.getByLabel(fr ? "Numéro WhatsApp" : "WhatsApp number", { exact: true });
  const code = page.getByLabel(fr ? "Indicatif WhatsApp" : "WhatsApp calling code", { exact: true });
  assert.equal(await code.inputValue(), "CM");
  const label = await page.locator('label[for="' + await phone.getAttribute("id") + '"]').boundingBox();
  const select = await code.boundingBox(), number = await phone.boundingBox();
  assert.ok(label && select && number && label.y + label.height <= Math.min(select.y, number.y), "Phone label is above the two controls");
  await phone.fill("670000001"); await phoneValue(page, "+237670000001");
  await phone.fill("237670000001"); await phoneValue(page, "+237670000001");
  await phone.fill(""); await code.selectOption("CI");
  await phone.fill("0700000001"); await phoneValue(page, "+2250700000001");
  await phone.fill("+33612345678"); await phoneValue(page, "+33612345678");
  assert.equal(await code.inputValue(), "FR", "A complete foreign number changes its calling code");
  const preferences = page.locator(".setup-optional"); await preferences.locator("summary").click();
  await page.getByLabel(fr ? "Pays" : "Country", { exact: true }).selectOption("SN");
  await phoneValue(page, "+33612345678"); assert.equal(await code.inputValue(), "FR", "Business country never overwrites an existing foreign phone");
  await page.getByLabel(fr ? "Pays" : "Country", { exact: true }).selectOption("CM");
  await preferences.locator("summary").click();
  // Dispatch a real paste event: the component uses the native input event path.
  await phone.fill("");
  await phone.evaluate(element => {
    element.focus(); const transfer = new DataTransfer(); transfer.setData("text/plain", "+237 670 00 00 01");
    const paste = new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true });
    if (element.dispatchEvent(paste)) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(element, transfer.getData("text/plain")); element.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await phoneValue(page, "+237670000001"); assert.equal(await code.inputValue(), "CM");
  report.checks.push(language + "/" + width + ": calling code default/selection, national and full international input/paste, no doubled code, foreign phone preserved across business-country changes");
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
    await checkLocation(page, language, width);
    if (width < 1051) {
      const toggle = page.getByRole("button", { name: fr ? "Voir l’aperçu" : "View preview", exact: true });
      await toggle.click(); await page.getByRole("dialog").waitFor();
      assert.ok(await page.getByRole("dialog").getByText("Maison Sève", { exact: true }).count());
      await screen(page, "preview-" + language + "-" + width);
      await page.keyboard.press("Escape"); assert.equal(await toggle.evaluate(e => e === document.activeElement), true);
    }
    await page.getByRole("button", { name: fr ? "Continuer →" : "Continue →", exact: true }).click();
    await page.getByRole("button", { name: fr ? "Continuer →" : "Continue →", exact: true }).click();
    assert.equal(await page.getByLabel(fr ? "Numéro WhatsApp" : "WhatsApp number", { exact: true }).getAttribute("aria-invalid"), "true");
    await checkPhone(page, language, width);
    assert.equal(await page.getByLabel(fr ? "Numéro WhatsApp" : "WhatsApp number", { exact: true }).getAttribute("aria-invalid"), "false");
    await screen(page, "contact-" + language + "-" + width);
    await page.getByRole("button", { name: fr ? "← Retour" : "← Back", exact: true }).click();
    assert.equal(await page.getByLabel(fr ? "Nom de la boutique" : "Store name", { exact: true }).inputValue(), "Maison Sève");
    await page.reload();
    assert.equal(await page.getByLabel(fr ? "Nom de la boutique" : "Store name", { exact: true }).inputValue(), "Maison Sève");
    assert.equal(await page.getByLabel(fr ? "Localisation" : "Business location", { exact: true }).inputValue(), "Bonapriso, face au marché");
    await page.getByRole("button", { name: fr ? "Continuer →" : "Continue →", exact: true }).click();
    assert.equal((await page.getByLabel(fr ? "Numéro WhatsApp" : "WhatsApp number", { exact: true }).inputValue()).replace(/\D/g, "").slice(-9), "670000001");
    assert.equal(await page.getByLabel(fr ? "Indicatif WhatsApp" : "WhatsApp calling code", { exact: true }).inputValue(), "CM");
    await page.getByRole("button", { name: fr ? "Continuer →" : "Continue →", exact: true }).click();
    assert.equal(await page.getByLabel(fr ? "Secteur d’activité" : "Business sector", { exact: true }).inputValue(), "beauty");
    assert.equal(await page.locator(".theme-picker-grid > button").count(), 2);
    await screen(page, "style-" + language + "-" + width);
    await page.getByRole("button", { name: fr ? "Enregistrer et ajouter un produit →" : "Save and add a product →", exact: true }).click();
    await page.getByLabel(fr ? "Nom du produit" : "Product name", { exact: true }).fill("Sérum éclat");
    await page.getByLabel(fr ? "Prix" : "Price", { exact: true }).fill("12500");
    assert.equal(state.store.contactEmail, ""); assert.equal(state.store.status, "draft"); assert.equal(state.products.length, 0);
    assert.equal(state.store.businessLocation, "Bonapriso, face au marché");
    assert.equal(state.calls.filter(c => c.path === "/v1/admin/stores" && c.method === "POST").length, 1);
    await page.getByLabel(fr ? "Ajouter des images" : "Add images", { exact: true }).setInputFiles({ name: "serum.webp", mimeType: "image/webp", buffer: photo });
    assert.equal(f.uploads, 0, "Files are not uploaded before save");
    await screen(page, "first-product-" + language + "-" + width);
    await page.getByRole("button", { name: fr ? "← Retour" : "← Back", exact: true }).click();
    await page.getByRole("button", { name: fr ? "Enregistrer et ajouter un produit →" : "Save and add a product →", exact: true }).click();
    await page.getByLabel(fr ? "Nom du produit" : "Product name", { exact: true }).waitFor();
    assert.equal(await page.getByLabel(fr ? "Nom du produit" : "Product name", { exact: true }).inputValue(), "Sérum éclat");
    assert.equal(await page.locator(".setup-queued-note").count(), 1, "Back keeps selected unsent photos");
    await page.reload();
    await page.getByLabel(fr ? "Nom du produit" : "Product name", { exact: true }).waitFor();
    assert.equal(await page.getByLabel(fr ? "Nom du produit" : "Product name", { exact: true }).inputValue(), "Sérum éclat");
    assert.equal(await page.locator(".setup-queued-note").count(), 0, "Files are not falsely persisted across reload");
    await page.getByLabel(fr ? "Ajouter des images" : "Add images", { exact: true }).setInputFiles({ name: "serum.webp", mimeType: "image/webp", buffer: photo });
    let failedAttachment = false, releaseAttachment, attachmentStarted;
    const attachmentWait = new Promise(resolve => { attachmentStarted = resolve; });
    const attachmentGate = new Promise(resolve => { releaseAttachment = resolve; });
    await page.route(/\/v1\/admin\/stores\/[^/]+\/products\/[^/]+$/, async route => {
      if (route.request().method() === "PATCH" && !failedAttachment) { failedAttachment = true; attachmentStarted(); await attachmentGate; return route.fulfill({ status: 503, headers: { "Access-Control-Allow-Origin": "*" }, json: { error: "UNAVAILABLE" } }); }
      return route.fallback();
    });
    await page.getByRole("button", { name: fr ? "Enregistrer le produit" : "Save product", exact: true }).click();
    let attachmentTimeout;
    try { await Promise.race([attachmentWait, new Promise((_, reject) => { attachmentTimeout = setTimeout(() => reject(new Error("Product attachment did not start")), 30000); })]); }
    finally { clearTimeout(attachmentTimeout); }
    try {
      assert.equal(await page.getByRole("button", { name: fr ? "← Retour" : "← Back", exact: true }).isDisabled(), true);
      assert.equal(await page.locator(".setup-progress button:enabled").count(), 0, "Navigation is blocked during a product mutation");
    } finally { releaseAttachment(); }
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
  for (const [width, height] of [[1366, 768], [1536, 834], [1024, 600]]) {
    const f = await fixture({ width, height }), { page, context } = f;
    await page.goto(base + "/app");
    await page.getByLabel("Nom de la boutique", { exact: true }).fill("Boutique compacte");
    await page.getByRole("button", { name: "Beauté & soins", exact: false }).click();
    await page.getByRole("button", { name: "Continuer →", exact: true }).click();
    await page.getByLabel("Numéro WhatsApp", { exact: true }).fill("670000001");
    await screen(page, "compact-contact-" + width + "x" + height);
    await page.getByRole("button", { name: "Continuer →", exact: true }).click();
    await page.getByRole("button", { name: "Enregistrer et ajouter un produit →", exact: true }).waitFor();
    await screen(page, "compact-style-" + width + "x" + height);
    if (width > 1050) {
      const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollHeight, viewport: innerHeight }));
      assert.ok(dimensions.content <= dimensions.viewport + 2, "Default style fits " + width + "x" + height + ": " + JSON.stringify(dimensions));
    }
    await page.locator(".theme-picker-compact summary").click();
    const font = page.getByLabel("Typographie", { exact: true }); await font.focus();
    await font.evaluate(element => element.scrollIntoView({ block: "center" }));
    const box = await font.boundingBox(), dock = await page.locator(".setup-actions:visible").boundingBox();
    assert.ok(box && dock && box.y + box.height <= dock.y, "Expanded controls remain scrollable above the actions");
    await context.close();
    report.checks.push(width + "x" + height + ": compact contact/style, action viewport bounds and expanded controls reachable");
  }
  {
    const f = await fixture({ hasStore: true, width: 390, hasTouch: true }), { page, state, context } = f;
    state.store.businessLocation = "Mon quartier personnel";
    await page.goto(base + "/app/settings?store=" + storeId);
    const location = page.getByRole("combobox", { name: "Localisation", exact: true });
    await location.waitFor(); assert.equal(await location.inputValue(), "Mon quartier personnel");
    await page.getByLabel("Pays", { exact: true }).selectOption("CI");
    assert.equal(await location.inputValue(), "Mon quartier personnel", "Changing country keeps the current location");
    await location.fill("Dou"); assert.equal(await page.getByRole("option", { name: /^Douala / }).count(), 0, "Country filtering excludes Cameroon cities");
    await location.fill("Abijan"); await page.getByRole("option", { name: /^Abidjan / }).tap();
    await locationValue(page, location, "Abidjan");
    const settingsPhone = page.getByLabel("Numéro WhatsApp", { exact: true });
    await settingsPhone.fill("+33612345678");
    assert.equal(await page.getByLabel("Indicatif WhatsApp", { exact: true }).inputValue(), "FR");
    await screen(page, "location-settings-touch-390");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).first().click();
    await page.getByText("Modifications enregistrées.", { exact: true }).waitFor(); assert.equal(state.store.businessLocation, "Abidjan"); assert.equal(state.store.whatsappNumber, "+33612345678");
    await page.reload(); await location.waitFor(); assert.equal(await location.inputValue(), "Abidjan"); assert.equal(await page.getByLabel("Indicatif WhatsApp", { exact: true }).inputValue(), "FR");
    await location.fill(""); await location.press("Escape");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).first().click();
    await page.getByText("Modifications enregistrées.", { exact: true }).waitFor(); assert.equal(state.store.businessLocation, "");
    report.checks.push("Settings: shared location field, country filtering, preserved custom input, touch selection, save/reload and optional empty value");
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
    assert.equal(await page.locator(".setup-first-product").count(), 0, "Resuming review does not initialize a hidden editor");
    let failCatalog = true;
    await page.route("**/products", route => route.request().method() === "GET" && failCatalog ? route.fulfill({ status: 503, headers: { "Access-Control-Allow-Origin": "*" }, json: { error: "UNAVAILABLE" } }) : route.fallback());
    await page.reload(); await page.locator(".setup-review").getByRole("alert").waitFor(); assert.equal(await publish.isEnabled(), false);
    assert.equal(await page.getByRole("alert").count(), 1, "The catalog outage is announced once");
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
        name: "Ancien brouillon", slug: "ancien-brouillon", whatsappNumber: "237670000001", countryCode: "CM", currencyCode: "XAF",
        description: "Description conservée", businessLocation: "", contactEmail: "", theme: "clean", themeSettings: {}
      }));
      sessionStorage.setItem("commerce-onboarding:progress:owner@example.com", JSON.stringify({ version: 1, step: 99, storeId: null, sector: "invalid", slugTouched: true }));
    });
    await f.page.goto(base + "/app"); await f.page.getByLabel("Nom de la boutique", { exact: true }).waitFor();
    assert.equal(await f.page.getByLabel("Nom de la boutique", { exact: true }).inputValue(), "Ancien brouillon");
    await f.page.locator(".setup-optional").getByText("Ajouter une description et des coordonnées", { exact: false }).click();
    assert.equal(await f.page.getByLabel("Courte description", { exact: true }).inputValue(), "Description conservée");
    assert.equal(f.state.calls.filter(c => c.method === "POST").length, 0);
    await f.page.getByRole("button", { name: "Continuer →", exact: true }).click();
    const legacyPhone = f.page.getByLabel("Numéro WhatsApp", { exact: true }); await legacyPhone.waitFor();
    assert.equal((await legacyPhone.inputValue()).replace(/\D/g, "").slice(-9), "670000001");
    assert.equal(await f.page.getByLabel("Indicatif WhatsApp", { exact: true }).inputValue(), "CM");
    await phoneValue(f.page, "237670000001");
    await f.page.locator(".setup-optional summary").click();
    await f.page.getByLabel("Pays", { exact: true }).selectOption("SN");
    await phoneValue(f.page, "+237670000001");
    assert.equal(await f.page.getByLabel("Indicatif WhatsApp", { exact: true }).inputValue(), "CM");
    await f.page.getByRole("button", { name: "Continuer →", exact: true }).click();
    await f.page.getByRole("button", { name: "Enregistrer et ajouter un produit →", exact: true }).click();
    await f.page.getByLabel("Nom du produit", { exact: true }).waitFor();
    assert.equal(f.state.store.whatsappNumber, "+237670000001"); assert.equal(f.state.store.countryCode, "SN");
    report.checks.push("Old validated drafts survive; malformed progress cannot skip setup; legacy national phone keeps its original calling code on country change and saves canonically");
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
