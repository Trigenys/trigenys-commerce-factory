import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { storeThemeIds } from "../shared/store-themes.ts";

const base = "http://127.0.0.1:5174";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5174", "--strictPort"], { stdio: "pipe" });
let serverOutput = "";
server.stdout.on("data", (data) => { serverOutput += data; });
server.stderr.on("data", (data) => { serverOutput += data; });
let browser;

const products = [
  { id: "one", name: "Sac Signature", slug: "sac-signature", description: "Une description pour le produit.", price: "18500", currencyCode: "XAF", category: "Mode", stockLabel: "Disponible", imageUrls: ["/landing/fashion-480.webp", "/landing/watch-480.webp"], variants: [{ name: "Couleur", value: "Camel" }, { name: "Couleur", value: "Noir" }] },
  { id: "two", name: "Collection de soins", slug: "collection-soins", description: null, price: "12500", currencyCode: "XAF", category: "Beauté", stockLabel: null, imageUrls: ["/landing/beauty-480.webp"], variants: [] },
  { id: "three", name: "Montre Atelier", slug: "montre-atelier", description: null, price: "28000", currencyCode: "XAF", category: "Mode", stockLabel: null, imageUrls: ["/landing/watch-480.webp"], variants: [] }
];
let theme = "clean";
let empty = false;
let handoffBody;
const store = { name: "Atelier des essentiels de Douala", slug: "theme-test", whatsappNumber: "+237670000001", countryCode: "CM", currencyCode: "XAF", description: "Des essentiels bien choisis. Des détails qui font la différence.", businessLocation: "Douala, Cameroun", logoUrl: null };

async function checkPage(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, label + ": horizontal overflow");
  const broken = await page.locator("img").evaluateAll((images) => images.filter((image) => image.complete && !image.naturalWidth).map((image) => image.src));
  assert.deepEqual(broken, [], label + ": broken images");
  await page.locator("h1").first().waitFor();
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(serverOutput);
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch { /* Server starting. */ }
    await delay(100);
  }
  assert.ok(ready, "Vite did not start: " + serverOutput);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: "fr-FR", reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/v1/public/stores/theme-test", (route) => route.fulfill({ json: { store: { ...store, theme, themeSettings: { accent: "#ffcc33" } }, products: empty ? [] : products } }));
  await page.route("**/v1/public/events", (route) => route.fulfill({ status: 202, json: {} }));
  await page.route("**/v1/public/stores/theme-test/products/sac-signature/whatsapp", (route) => {
    handoffBody = route.request().postDataJSON();
    return route.fulfill({ json: { href: "https://wa.me/237670000001?text=theme-test", eventName: "whatsapp_order_click" } });
  });
  await page.route("https://wa.me/**", (route) => route.fulfill({ contentType: "text/html", body: "<p>Test handoff</p>" }));

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (theme of storeThemeIds) {
      await page.goto(base + "/store/theme-test");
      await page.locator("[data-theme]").waitFor();
      assert.equal(await page.locator("[data-theme]").getAttribute("data-theme"), theme);
      assert.equal(await page.locator(".public-product-card").count(), 3);
      await checkPage(page, `${theme}/${viewport.width}/store`);
      await page.locator(".public-category-filter button", { hasText: "Beauté" }).click();
      assert.equal(await page.locator(".public-product-card").count(), 1);
      await page.goto(base + "/store/theme-test/p/sac-signature");
      await page.locator(".product-detail-copy").waitFor();
      await checkPage(page, `${theme}/${viewport.width}/product`);
      await page.getByRole("button", { name: "Noir", exact: true }).click();
      assert.ok((await page.getByRole("button", { name: "Noir", exact: true }).getAttribute("class"))?.includes("active"));
      await page.getByRole("button", { name: "Sac Signature 2", exact: true }).click();
      assert.ok((await page.locator(".product-gallery-main img").getAttribute("src"))?.includes("watch"));
    }
  }

  theme = "sport-stadium";
  await page.goto(base + "/store/theme-test/p/sac-signature");
  await page.getByRole("button", { name: "Noir", exact: true }).click();
  await Promise.all([page.waitForURL("https://wa.me/**"), page.getByRole("button", { name: /Acheter sur WhatsApp/ }).click()]);
  assert.deepEqual(handoffBody.variants, [{ name: "Couleur", value: "Noir" }]);
  empty = true;
  await page.goto(base + "/store/theme-test");
  await page.locator(".public-empty-catalog").waitFor();
  await checkPage(page, "empty catalog");

  await page.goto(base + "/themes?theme=beauty-ecrin");
  await page.locator(".theme-choice").first().waitFor();
  assert.equal(await page.locator(".theme-choice").count(), storeThemeIds.length);
  await page.getByLabel("Secteur d’activité").selectOption("sport");
  assert.equal(await page.locator(".theme-choice").count(), 2);
  await page.getByRole("button", { name: /Stadium/ }).click();
  assert.equal(await page.locator("[data-theme]").getAttribute("data-theme"), "sport-stadium");
  await page.getByLabel("Typographie").selectOption("serif");
  await page.getByLabel("Images des produits").selectOption("contain");
  await page.locator(".theme-spotlight-image").click();
  await page.locator(".product-detail-copy").waitFor();
  assert.equal(await page.locator(".public-wa-button").isDisabled(), true);
  assert.ok(new URL(page.url()).searchParams.get("product"));
  await page.reload();
  await page.locator(".product-detail-copy").waitFor();

  const alpha = await page.evaluate(async () => {
    const { prepareImageForUpload } = await import("/src/admin/media.ts");
    const source = document.createElement("canvas"); source.width = 2000; source.height = 1000;
    const context = source.getContext("2d"); context.fillStyle = "#e86b35"; context.fillRect(500, 250, 1000, 500);
    const png = await new Promise((resolve) => source.toBlob(resolve, "image/png"));
    const output = await prepareImageForUpload(new File([png], "cutout.png", { type: "image/png" }));
    const bitmap = await createImageBitmap(output);
    const target = document.createElement("canvas"); target.width = bitmap.width; target.height = bitmap.height;
    const decoded = target.getContext("2d"); decoded.drawImage(bitmap, 0, 0);
    return { type: output.type, width: bitmap.width, height: bitmap.height, corner: decoded.getImageData(0, 0, 1, 1).data[3], center: decoded.getImageData(bitmap.width / 2, bitmap.height / 2, 1, 1).data[3] };
  });
  assert.deepEqual(alpha, { type: "image/webp", width: 1600, height: 800, corner: 0, center: 255 });
  assert.deepEqual(errors, [], "Browser errors");
  console.log(`Verified ${storeThemeIds.length} themes at desktop/mobile sizes, product pages, filtering, variants, handoff, gallery deep links and transparent WebP resizing.`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
