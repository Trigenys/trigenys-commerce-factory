import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { brandFixture, storeId, product } from "./brand-fixture.mjs";

// This suite is executed on the external CI runner, with isolated API/session data.
const base = "http://127.0.0.1:5196", output = "artifacts/workspace";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5196", "--strictPort"], { stdio: "pipe", env: { ...process.env, VITE_API_BASE_URL: "http://127.0.0.1:8787" } });
let serverLog = "", browser, currentPage;
server.stdout.on("data", value => serverLog += value); server.stderr.on("data", value => serverLog += value);
const report = { checks: [], pages: [], errors: [], limitation: "Isolated browser fixtures; no real merchant data or credentials. Automated checks do not establish complete WCAG conformity or usability validation." };
const axeSource = await readFile("node_modules/axe-core/axe.min.js", "utf8");
async function fixture(options = {}) { const result = await brandFixture(browser, base, options); currentPage = result.page; return result; }
async function ready(page) { await page.locator(".workspace-mode h1").first().waitFor(); await page.evaluate(() => document.fonts.ready); }
async function capture(page, label, accessibility = true) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, label + ": no page overflow");
  const heading = await page.locator(".workspace-page-heading h1").first().boundingBox();
  const header = await page.locator(".admin-header").boundingBox();
  if (heading && await page.evaluate(() => scrollY) === 0) assert.ok(heading.y >= header.height && heading.y < header.height + 64, label + ": page title follows compact app header");
  if (accessibility) {
    await page.evaluate(axeSource);
    const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations.filter(item => ["serious", "critical"].includes(item.impact)).map(item => ({ id: item.id, targets: item.nodes.map(node => node.target), details: item.nodes.map(node => node.failureSummary) })));
    report.pages.push({ label, violations }); assert.deepEqual(violations, [], label + ": accessibility");
  }
  await page.screenshot({ path: `${output}/${label}.png` });
}
try {
  await mkdir(output, { recursive: true });
  let started = false;
  for (let i = 0; i < 70; i++) { try { if ((await fetch(base)).ok) { started = true; break; } } catch {} await delay(200); }
  assert.ok(started, serverLog); browser = await chromium.launch({ headless: true });
  // All management pages retain the same title/action placement in both languages.
  for (const language of ["fr", "en"]) for (const width of [390, 1440]) {
    const { context, page, state } = await fixture({ language, width, profile: "support" });
    for (const route of ["/app", "/app/products", "/app/orders", "/app/analytics", "/app/settings", "/app/appearance", "/app/team", "/app/connections", "/app/platform"]) {
      await page.goto(base + route + "?store=" + storeId); await ready(page);
      await capture(page, route.split("/").pop() + "-" + language + "-" + width);
      assert.ok(await page.locator(".workspace-page-heading").count(), route + ": operational page header");
      if (width >= 1024) assert.equal(await page.locator('.merchant-sidebar [aria-current="page"]').count(), 1);
    }
    assert.equal(state.calls.filter(call => call.path.startsWith("/v1/") && !["GET", "OPTIONS"].includes(call.method)).length, 0, "Layout inspection does not mutate merchant data");
    assert.deepEqual(state.browserErrors, [], "No failed requests or browser exceptions"); await context.close();
  }
  // Dashboard uses persisted counts, real order rows and truthful launch prerequisites.
  for (const width of [320, 768, 1280, 1920]) {
    const { context, page, state } = await fixture({ width }); state.store.status = "draft";
    state.products = []; state.orders = [];
    await page.goto(base + "/app"); await ready(page);
    await page.getByText("1/3 étapes terminées", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Publier la boutique", exact: true }).isEnabled(), false);
    const add = page.getByRole("link", { name: "Ajouter un produit", exact: true });
    assert.ok((await add.boundingBox()).y < 350, "Primary action is available in the first viewport");
    assert.equal(await add.evaluate(node=>getComputedStyle(node).color), "rgb(255, 253, 248)", "Primary link text stays legible against its dark background");
    await capture(page, "dashboard-empty-" + width);
    state.products = [structuredClone(product)]; await page.reload(); await ready(page);
    await page.getByText("2/3 étapes terminées", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Publier la boutique", exact: true }).click();
    await page.getByText("Votre boutique est publiée.", { exact: true }).waitFor(); assert.equal(state.store.status, "published");
    report.checks.push("Truthful dashboard prerequisites and publication at " + width); await context.close();
  }
  // Navigation uses a real modal dialog on mobile, with focus containment/restoration.
  for (const width of [320, 390, 768]) {
    const { context, page } = await fixture({ width }); await page.goto(base + "/app/products"); await ready(page);
    const toggle = page.locator(".workspace-navigation-toggle");
    await toggle.focus(); await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Navigation", exact: true }); await dialog.waitFor();
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    for (let i = 0; i < 18; i++) { await page.keyboard.press("Tab"); assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true, "Focus stays inside navigation"); }
    await capture(page, "navigation-open-" + width);
    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
    assert.equal(await toggle.evaluate(node => node === document.activeElement), true, "Escape returns focus to the trigger");
    await toggle.click(); await dialog.getByRole("link", { name: "Commandes", exact: true }).click();
    await page.getByRole("heading", { name: "Commandes", level: 1, exact: true }).waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0, "Navigation closes after route change");
    await toggle.click(); await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator(".merchant-sidebar").waitFor();
    await page.waitForFunction(() => !document.querySelector(".merchant-drawer")?.open && document.body.style.overflow !== "hidden", { timeout: 3000 });
    assert.equal(await page.evaluate(() => document.body.style.overflow), "", "Resize releases body scroll lock");
    report.checks.push("Keyboard drawer and responsive navigation at " + width); await context.close();
  }
  // Search/filter and direct add actions work; an existing draft wins over new=1.
  for (const width of [390, 1440]) {
    const { context, page, state } = await fixture({ width }); await page.goto(base + "/app/products"); await ready(page);
    await page.locator(".catalog-card").waitFor();
    await page.getByLabel("Rechercher un produit", { exact: true }).fill("introuvable");
    await page.getByText("Aucun produit ne correspond", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Effacer les filtres", exact: true }).click(); assert.equal(await page.locator(".catalog-card").count(), 1);
    await page.getByLabel("Statut du produit", { exact: true }).selectOption("draft"); await page.getByText("Aucun produit ne correspond", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Effacer les filtres", exact: true }).click();
    await page.goto(base + "/app"); await ready(page); await page.getByRole("link", { name: "Ajouter un produit", exact: true }).click();
    const name = page.getByLabel("Nom du produit", { exact: true }); await name.waitFor();
    assert.equal(await name.evaluate(node => node === document.activeElement), true, "Direct add opens and focuses the editor");
    await name.fill("Brouillon à conserver"); await page.reload(); await name.waitFor(); assert.equal(await name.inputValue(), "Brouillon à conserver");
    await capture(page, "product-editor-" + width);
    await page.goto(base + "/app/orders"); await ready(page); await page.locator(".order-card").waitFor();
    await page.getByLabel("Rechercher une commande", { exact: true }).fill("introuvable"); await page.getByText("Aucune commande ne correspond", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Effacer les filtres", exact: true }).click();
    await page.locator(".order-card>summary").focus(); await page.keyboard.press("Enter"); await capture(page, "order-detail-" + width);
    await page.goto(base + "/app/settings"); await ready(page);
    await page.getByLabel("Nom de la boutique", { exact: true }).fill("Atelier enregistré");
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    const save = page.getByRole("button", { name: "Enregistrer", exact: true });
    const saveBox = await save.boundingBox(), headerBox = await page.locator(".admin-header").boundingBox();
    assert.ok(saveBox.y >= headerBox.height - 1 && saveBox.y + saveBox.height < 900, "Settings save remains visible below sticky header");
    await save.click(); await page.getByText("Modifications enregistrées.", { exact: true }).waitFor(); assert.equal(state.store.name, "Atelier enregistré");
    await capture(page, "settings-saved-" + width);
    await page.goto(base + "/app/products"); await ready(page); await page.getByRole("button", { name: "Modifier", exact: true }).click();
    await page.evaluate(() => scrollTo(0, 700));
    assert.ok(Math.abs((await page.locator(".admin-header").boundingBox()).y) < 1, "App header stays visible while editing");
    if (width >= 1024) { const nav = await page.locator(".merchant-sidebar").boundingBox(); assert.ok(Math.abs(nav.y - (await page.locator(".admin-header").boundingBox()).height) < 2, "Sidebar stays visible while editing"); }
    report.checks.push("Product/order search, draft recovery, sticky settings save and header at " + width); await context.close();
  }
  // Staff get only permitted navigation; platform support remains explicitly gated.
  for (const profile of ["staff", "owner", "support"]) {
    const { context, page } = await fixture({ profile, width: 1440 }); await page.goto(base + "/app"); await ready(page);
    if (profile === "staff") { assert.deepEqual(await page.locator(".merchant-sidebar nav a").allTextContents(), ["Tableau de bord", "Commandes", "Produits"]); await page.goto(base + "/app/settings"); await page.getByRole("heading", { name: "Accès réservé au propriétaire", exact: true }).waitFor(); }
    if (profile === "owner") assert.equal(await page.getByRole("link", { name: "Support Trigenys", exact: true }).count(), 0);
    if (profile === "support") await page.getByRole("link", { name: "Support Trigenys", exact: true }).waitFor();
    await capture(page, "role-" + profile); await context.close();
  }
  // Account utility exposes the current identity, supports Escape, and signs out.
  {
    const { context, page, state } = await fixture({ width: 390 }); await page.goto(base + "/app"); await ready(page);
    await page.locator(".admin-account>summary").click(); await page.getByText("owner@example.com", { exact: true }).waitFor();
    await capture(page, "account-menu"); await page.keyboard.press("Escape"); assert.equal(await page.locator(".admin-account").getAttribute("open"), null);
    await page.locator(".admin-account>summary").click(); await page.getByRole("button", { name: "Se déconnecter", exact: true }).click();
    await page.locator(".auth-card").waitFor(); assert.equal(state.authenticated, false); assert.equal(await page.locator(".merchant-workspace-shell").count(), 0);
    report.checks.push("Account identity, Escape dismissal and real SDK sign-out"); await context.close();
  }
} catch (error) {
  report.errors.push(String(error?.stack ?? error)); process.exitCode = 1;
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: output + "/failure.png", fullPage: true }).catch(() => {});
} finally {
  await writeFile(output + "/report.json", JSON.stringify(report, null, 2));
  if (browser) await browser.close(); server.kill("SIGTERM");
  console.log(JSON.stringify({ checks: report.checks.length, pages: report.pages.length, errors: report.errors }));
}
