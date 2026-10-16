import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const base = "http://127.0.0.1:5177", output = "artifacts/catalog";
const storeId = "11111111-1111-4111-8111-111111111111";
const path = `/v1/admin/stores/${storeId}/products`;
const now = "2026-10-12T08:00:00.000Z";
const store = { id: storeId, role: "owner", name: "Urban 237 — Test", slug: "urban-237-test", status: "draft", whatsappNumber: "+237670000001", countryCode: "CM", currencyCode: "XAF", description: "Catalogue de test", businessLocation: "Douala", contactEmail: null, theme: "fashion-collection", themeSettings: {}, logoUrl: null };
const product = { id: "22222222-2222-4222-8222-222222222222", storeId, name: "T-shirt existant", slug: "t-shirt-existant", description: "Une ancienne fiche conserve ses valeurs.", price: "12000.00", currencyCode: "XAF", category: "Collection artisanale", stockLabel: "3 exemplaires — livraison lundi", status: "draft", sortOrder: 10, imageUrls: [], variants: [] };
const report = { checks: [], pages: [], limitations: ["API and session responses are isolated browser fixtures; no real merchant data is written.", "Automated accessibility checks do not establish complete WCAG conformity."] };
const axeSource = await readFile("node_modules/axe-core/axe.min.js", "utf8");
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5177", "--strictPort"], { stdio: "pipe", env: { ...process.env, VITE_API_BASE_URL: "http://127.0.0.1:8787" } });
let browser, currentPage, currentState, serverLog = "";
server.stdout.on("data", value => serverLog += value);
server.stderr.on("data", value => serverLog += value);

async function fixture(language, width, role = "owner") {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: language === "fr" ? "fr-FR" : "en-GB", reducedMotion: "reduce" });
  await context.addInitScript(language => localStorage.setItem("commerce-factory-language", language), language);
  const page = await context.newPage();
  const state = { products: [structuredClone(product)], calls: [], errors: [], rejectSave: false, failRead: false, gate: null, media: new Map(), uploads: 0, failUploadAt: 0, failPreview: false };
  await page.addInitScript(() => {
    window.mediaLifecycle = { created: [], revoked: [] };
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = value => { const url = create(value); window.mediaLifecycle.created.push(url); return url; };
    URL.revokeObjectURL = url => { window.mediaLifecycle.revoked.push(url); revoke(url); };
  });
  currentPage = page; currentState = state;
  page.on("dialog", dialog => dialog.accept());
  page.on("pageerror", error => state.errors.push(error.message));
  await page.route("**/neondb/auth/**", async route => {
    const endpoint = new URL(route.request().url()).pathname;
    const headers = { "Access-Control-Allow-Origin": base, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const user = { id: role, email: `${role}@example.com`, name: "Commerce Test", emailVerified: true, createdAt: now, updatedAt: now };
    if (endpoint.endsWith("/get-session")) return route.fulfill({ headers, json: { user, session: { id: "test-session", userId: role, token: "test-session", expiresAt: "2027-01-01T00:00:00Z", createdAt: now, updatedAt: now } } });
    if (endpoint.endsWith("/token")) {
      const token = [{ alg: "EdDSA", typ: "JWT" }, { sub: role, email: user.email, emailVerified: true, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) }].map(value => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".") + ".signature";
      return route.fulfill({ headers, json: { token } });
    }
    return route.fulfill({ status: 404, headers, json: { error: "UNMOCKED_AUTH" } });
  });
  await page.route("**/v1/**", async route => {
    const endpoint = new URL(route.request().url()).pathname, method = route.request().method();
    const body = route.request().headers()["content-type"]?.includes("application/json") && route.request().postData() ? route.request().postDataJSON() : undefined;
    const send = (json, status = 200) => route.fulfill({ status, json, headers: { "Access-Control-Allow-Origin": "*" } });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" } });
    state.calls.push({ path: endpoint, method, body });
    if (endpoint === "/v1/config") return send({ authBaseUrl: "https://auth.example.test/neondb/auth" });
    if (endpoint === "/v1/admin/me/stores") return send({ stores: [{ ...store, role }] });
    if (endpoint === "/v1/admin/me/access") return send({ platform: false, email: `${role}@example.com`, emailVerified: true });
    if (endpoint === `/v1/admin/stores/${storeId}/orders`) return send({ orders: [] });
    if (endpoint === `/v1/admin/stores/${storeId}/media` && method === "POST") {
      state.uploads++;
      if (state.uploads === state.failUploadAt) return send({ error: "MEDIA_UPLOAD_FAILED" }, 502);
      const request = new Request(route.request().url(), { method, headers: route.request().headers(), body: route.request().postDataBuffer() });
      const form = await request.formData();
      const file = form.get("file");
      assert.equal(file.type, "image/webp");
      const publicId = crypto.randomUUID();
      const media = { id: crypto.randomUUID(), publicId, storeId, productId: form.get("productId"), kind: form.get("kind"), publicUrl: `https://media.example.test/v1/media/${publicId}` };
      state.media.set(publicId, { media, bytes: Buffer.from(await file.arrayBuffer()) });
      return send({ media }, 201);
    }
    if (endpoint.startsWith(`/v1/admin/stores/${storeId}/media/public/`)) {
      assert.match(route.request().headers().authorization || "", /^Bearer /, "Private previews carry the merchant JWT in a header");
      const publicId = endpoint.split("/").pop(), value = state.media.get(publicId);
      if (!value) return send({ error: "MEDIA_NOT_FOUND" }, 404);
      if (method === "DELETE") { state.media.delete(publicId); return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*" } }); }
      if (state.failPreview) return send({ error: "UNAVAILABLE" }, 503);
      return route.fulfill({ body: value.bytes, contentType: "image/webp", headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "private, no-store" } });
    }
    if (endpoint.startsWith("/v1/media/")) return send({ error: "MEDIA_NOT_FOUND" }, 404);
    if (endpoint === path && method === "GET") return state.failRead ? send({ error: "UNAVAILABLE" }, 503) : send({ products: state.products });
    if ((endpoint === path && method === "POST") || (endpoint.startsWith(path + "/") && method === "PATCH")) {
      if (state.gate) await state.gate;
      if (state.rejectSave) return send({ error: "UNAVAILABLE" }, 503);
      if (method === "POST") {
        const saved = { ...body, id: crypto.randomUUID(), storeId };
        state.products.push(saved); return send({ product: saved }, 201);
      }
      const index = state.products.findIndex(item => item.id === endpoint.split("/").pop());
      assert.ok(index >= 0, "Unknown product write");
      state.products[index] = { ...state.products[index], ...body };
      return send({ product: state.products[index] });
    }
    return send({ error: "UNMOCKED_API" }, 404);
  });
  return { context, page, state };
}

async function capture(page, label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, label + ": horizontal overflow");
  await page.screenshot({ path: `${output}/${label}.png` });
  await page.evaluate(axeSource);
  const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations.filter(item => ["critical", "serious"].includes(item.impact)).map(item => ({ id: item.id, targets: item.nodes.map(node => node.target), details: item.nodes.map(node => node.failureSummary) })));
  report.pages.push({ label, violations });
  assert.deepEqual(violations, [], label + ": accessibility");
}

async function sticky(page, width) {
  const header = await page.locator(".admin-header").boundingBox();
  assert.ok(header && Math.abs(header.y) <= 1, "Header stays at the top after scroll");
  if (width < 1024) {
    assert.ok(await page.getByRole("button", { name: /Ouvrir la navigation|Open navigation/ }).isVisible(), "Mobile navigation is available in the sticky header");
  } else {
    const nav = await page.locator(".merchant-sidebar").boundingBox();
    assert.ok(nav && Math.abs(nav.y - header.height) <= 2, "Merchant navigation stays below the header");
  }
  return header.height;
}

async function noticePosition(page, width) {
  const below = await sticky(page, width);
  const card = await page.locator('.merchant-notice[data-visible="true"]').boundingBox();
  assert.ok(card && card.x >= 0 && card.x <= 20 && card.y >= below + 10 && card.y + card.height <= 900, "Notice is visible in the upper-left viewport below navigation");
  assert.equal(await page.locator(".catalog-panel .merchant-notice").count(), 0, "Notice is outside the scrolled form container");
}

try {
  await mkdir(output, { recursive: true });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await delay(100); }
  assert.ok(ready, serverLog);
  browser = await chromium.launch({ headless: true });
  for (const language of ["fr", "en"]) for (const width of [1440, 390]) {
    const fr = language === "fr";
    const labels = { category: fr ? "Catégorie" : "Category", stock: fr ? "Indication de stock" : "Stock label", name: fr ? "Nom du produit" : "Product name", price: fr ? "Prix" : "Price", save: fr ? "Enregistrer" : "Save", create: fr ? "Créer le produit" : "Create product", add: fr ? "Ajouter un produit" : "Add product", edit: fr ? "Modifier" : "Edit", categoryName: fr ? "Nouvelle catégorie" : "New category", addCategory: fr ? "Ajouter une catégorie…" : "Add a category…", close: fr ? "Fermer la notification" : "Dismiss notification" };
    const { context, page, state } = await fixture(language, width);
    await page.goto(base + "/app/products?store=" + storeId);
    await page.getByRole("button", { name: labels.edit, exact: true }).click();
    const category = () => page.getByRole("combobox", { name: labels.category, exact: true });
    const stock = () => page.getByRole("combobox", { name: labels.stock, exact: true });
    assert.equal(await category().inputValue(), product.category);
    assert.equal(await stock().inputValue(), product.stockLabel);
    await page.getByRole("button", { name: fr ? "EN" : "FR", exact: true }).click();
    assert.equal(await page.locator(".catalog-category-control select").inputValue(), product.category);
    assert.equal(await page.locator(".catalog-fields select").last().inputValue(), product.stockLabel);
    await page.getByRole("button", { name: fr ? "FR" : "EN", exact: true }).click();
    await page.getByRole("button", { name: labels.save, exact: true }).click();
    await page.locator('.merchant-notice [role="status"]').filter({ hasText: fr ? "Produit enregistré." : "Product saved." }).waitFor();
    assert.equal(state.products[0].category, product.category);
    assert.equal(state.products[0].stockLabel, product.stockLabel);
    await page.getByRole("button", { name: labels.add, exact: true }).click();
    await page.getByLabel(labels.name, { exact: true }).fill("T-shirt Urban 237");
    await page.getByLabel(labels.price, { exact: true }).fill("12000");
    await category().selectOption(product.category);
    await category().selectOption({ label: labels.addCategory });
    const entry = page.getByLabel(labels.categoryName, { exact: true });
    await entry.waitFor();
    assert.equal(await entry.evaluate(element => element === document.activeElement), true, "Category entry receives focus");
    assert.equal(await page.getByRole("button", { name: labels.create, exact: true }).isDisabled(), true);
    await entry.fill(" Mode urbaine ");
    await entry.press("Enter");
    assert.equal(await category().inputValue(), "Mode urbaine");
    assert.equal(await category().evaluate(element => element === document.activeElement), true, "Focus returns to the category list");
    assert.equal(state.calls.filter(call => call.path === path && call.method === "POST").length, 0, "Enter adds a category without creating a product");
    await stock().selectOption(fr ? "Sur commande" : "Made to order");
    await page.reload();
    await page.getByLabel(labels.name, { exact: true }).waitFor();
    assert.equal(await category().inputValue(), "Mode urbaine");
    assert.equal(await stock().inputValue(), fr ? "Sur commande" : "Made to order");
    // The save bar is now sticky. Scroll the actual form before testing a save
    // notification so the scenario still proves the user's original friction.
    await page.evaluate(() => scrollTo(0, 400));
    await page.getByRole("button", { name: labels.create, exact: true }).scrollIntoViewIfNeeded();
    const initialScroll = await page.evaluate(() => scrollY);
    assert.ok(initialScroll > 100, "Scenario submits from a scrolled product form");
    await sticky(page, width);
    state.rejectSave = true;
    await page.getByRole("button", { name: labels.create, exact: true }).click();
    await page.locator('.merchant-notice [role="alert"]').filter({ hasText: fr ? "Une erreur" : "Something went wrong" }).waitFor();
    await noticePosition(page, width);
    assert.equal(await page.getByLabel(labels.name, { exact: true }).inputValue(), "T-shirt Urban 237");
    await capture(page, `error-${language}-${width}`);
    await page.getByRole("button", { name: labels.close, exact: true }).click();
    state.rejectSave = false;
    state.failRead = true;
    let release;
    state.gate = new Promise(resolve => release = resolve);
    await page.getByRole("button", { name: labels.create, exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".catalog-fields")?.disabled);
    assert.equal(await category().isDisabled(), true, "Controls cannot change during an in-flight save");
    release(); state.gate = null;
    await page.locator('.merchant-notice [role="status"]').filter({ hasText: fr ? "Produit créé." : "Product created." }).waitFor();
    await page.locator('.merchant-notice [role="status"]').filter({ hasText: fr ? "actualisé" : "refresh" }).waitFor();
    await noticePosition(page, width);
    assert.ok(await page.evaluate(() => scrollY) > 100, "Success does not jump the user back to the top");
    assert.equal(state.products.length, 2);
    const createdId = state.products[1].id;
    await page.getByRole("button", { name: labels.save, exact: true }).waitFor();
    assert.equal(await page.getByLabel(fr ? "Ajouter des images" : "Add images", { exact: true }).isEnabled(), true);
    await page.locator(".merchant-notice").hover();
    await capture(page, `created-${language}-${width}`);
    // The saved ID survives a failed list refresh and becomes an update, never another create.
    state.failRead = false;
    await page.getByRole("button", { name: labels.close, exact: true }).click();
    await page.getByRole("button", { name: labels.save, exact: true }).click();
    await page.locator('.merchant-notice [role="status"]').filter({ hasText: fr ? "Produit enregistré." : "Product saved." }).waitFor();
    assert.ok(state.calls.some(call => call.method === "PATCH" && call.path === path + "/" + createdId));
    assert.equal(state.calls.filter(call => call.path === path && call.method === "POST").length, 2, "One rejected create, one successful create, no duplicate retry");
    assert.equal(state.products.length, 2);
    await page.getByRole("button", { name: labels.close, exact: true }).focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator('.merchant-notice[data-visible="true"]').count(), 0);
    if (width < 1024) await page.getByRole("button", { name: fr ? "Ouvrir la navigation" : "Open navigation", exact: true }).click();
    await page.getByRole("navigation", { name: fr ? "Espace marchand" : "Merchant workspace", exact: true }).getByRole("link", { name: fr ? "Commandes" : "Orders", exact: true }).click();
    await page.getByRole("heading", { name: fr ? "Commandes" : "Orders", level: 1, exact: true }).waitFor();
    assert.deepEqual(state.errors, [], "No browser exceptions");
    report.checks.push(`${language}/${width}: native lists, legacy values, language switch, custom category keyboard/focus, draft reload, sticky navigation, visible failure/success, pending save, failed refresh without duplicate, keyboard dismissal and navigation`);
    await context.close();
  }
  for (const [language, width] of [["fr", 390], ["en", 1440]]) {
    const { context, page, state } = await fixture(language, width);
    const fr = language === "fr";
    await page.goto(base + "/app/products?store=" + storeId);
    await page.getByRole("button", { name: fr ? "Modifier" : "Edit", exact: true }).click();
    const png = await page.evaluate(() => {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 200;
      const context = canvas.getContext("2d"); context.fillStyle = "#142d25"; context.fillRect(0, 0, 200, 200);
      context.fillStyle = "#f9cf79"; context.font = "bold 64px sans-serif"; context.fillText("237", 38, 125);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    state.failUploadAt = 2;
    await page.getByLabel(fr ? "Ajouter des images" : "Add images", { exact: true }).setInputFiles([
      { name: "urban-237.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") },
      { name: "second.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") }
    ]);
    await page.locator('.merchant-notice [role="alert"]').waitFor();
    await page.waitForFunction(() => document.querySelector(".catalog-media-grid img")?.naturalWidth > 0);
    assert.equal(await page.locator(".catalog-media-grid img").count(), 1, "The first successful image survives a later upload failure");
    assert.equal(state.products[0].imageUrls.length, 0, "Uploading does not silently save the product draft");
    await capture(page, `private-media-upload-${language}-${width}`);
    await page.getByRole("button", { name: fr ? "Enregistrer" : "Save", exact: true }).click();
    await page.locator('.merchant-notice [role="status"]').filter({ hasText: fr ? "Produit enregistré." : "Product saved." }).waitFor();
    assert.equal(state.products[0].imageUrls.length, 1);
    assert.match(state.products[0].imageUrls[0], /\/v1\/media\/[0-9a-f-]{36}$/);
    assert.ok(state.calls.filter(call => call.method === "PATCH").every(call => !JSON.stringify(call.body).includes("blob:")), "Object URLs are never persisted");
    await page.reload();
    await page.waitForFunction(() => document.querySelector(".catalog-thumb img")?.naturalWidth > 0);
    await page.getByRole("button", { name: fr ? "Modifier" : "Edit", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".catalog-media-grid img")?.naturalWidth > 0);
    await capture(page, `private-media-reloaded-${language}-${width}`);
    state.failPreview = true;
    await page.reload();
    await page.locator(".catalog-media-grid").getByRole("button", { name: fr ? "Réessayer" : "Retry", exact: true }).waitFor();
    state.failPreview = false;
    await page.locator(".catalog-media-grid").getByRole("button", { name: fr ? "Réessayer" : "Retry", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".catalog-media-grid img")?.naturalWidth > 0);
    await page.getByRole("button", { name: fr ? "Retirer" : "Remove", exact: true }).click();
    await page.getByRole("button", { name: fr ? "Enregistrer" : "Save", exact: true }).click();
    await page.locator('.merchant-notice [role="status"]').filter({ hasText: fr ? "Produit enregistré." : "Product saved." }).waitFor();
    assert.equal(state.products[0].imageUrls.length, 0);
    assert.equal(state.media.size, 0, "Saved removal deletes the uploaded media");
    await page.waitForFunction(() => window.mediaLifecycle.created.length === window.mediaLifecycle.revoked.length);
    assert.equal(state.calls.filter(call => call.path.startsWith("/v1/media/")).length, 0, "The merchant view never requests the gated public draft URL");
    assert.deepEqual(state.errors, []);
    report.checks.push(`${language}/${width}: authenticated draft preview, partial-upload recovery, stable-URL save/reload, error/retry, removal and blob cleanup`);
    await context.close();
  }
  {
    const { context, page } = await fixture("fr", 390, "staff");
    await page.goto(base + "/app/products?store=" + storeId);
    await page.getByRole("button", { name: "Modifier", exact: true }).waitFor();
    await page.getByRole("button", { name: "Ouvrir la navigation", exact: true }).click();
    assert.deepEqual(await page.getByRole("dialog", { name: "Navigation" }).locator("nav a").evaluateAll(links => links.map(link => new URL(link.href).pathname.split("/")[2] || "overview")), ["overview", "orders", "products"]);
    await page.goto(base + "/app/team?store=" + storeId);
    await page.getByRole("heading", { name: "Accès réservé au propriétaire", exact: true }).waitFor();
    report.checks.push("Staff mobile navigation retains the existing role restrictions");
    await context.close();
  }
  await writeFile(output + "/report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: report.checks, screenshots: report.pages.length, accessibility: "No serious or critical violations in checked catalog states" }));
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({ path: output + "/failure.png", fullPage: true }).catch(() => {});
    await writeFile(output + "/failure-dom.txt", await currentPage.locator("body").innerText().catch(() => ""));
  }
  await writeFile(output + "/failure-state.json", JSON.stringify(currentState || {}, null, 2));
  await writeFile(output + "/report.json", JSON.stringify(report, null, 2));
  throw error;
} finally { await browser?.close(); server.kill("SIGTERM"); }

