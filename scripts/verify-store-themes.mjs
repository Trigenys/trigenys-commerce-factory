import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { storeThemeIds } from "../shared/store-themes.ts";
import { merchantAppHref, productionMerchantAppUrl } from "../src/merchant-navigation.ts";

for (const [hostname, expected] of [
  ["trigenys-commerce-factory.pages.dev", "/app"],
  ["localhost", "/app"],
  ["127.0.0.1", "/app"],
  ["feat-55-multi-sector-storefr.trigenys-commerce-factory.pages.dev", productionMerchantAppUrl],
  ["8c24169d.trigenys-commerce-factory.pages.dev", productionMerchantAppUrl],
  ["another-project.pages.dev", "/app"],
  ["trigenys-commerce-factory.pages.dev.example.com", "/app"]
]) assert.equal(merchantAppHref(hostname), expected, hostname + ": merchant entry origin");

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
let single = false;
let themeSettings = { accent: "#ffcc33" };
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
  await page.route("**/v1/public/stores/theme-test", (route) => route.fulfill({ json: { store: { ...store, theme, themeSettings }, products: empty ? [] : single ? products.slice(0, 1) : products } }));
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
      const activeFilter = await page.locator(".public-category-filter button.active").evaluate((button) => {
        const styles = getComputedStyle(button);
        return { background: styles.backgroundColor, foreground: styles.color };
      });
      assert.deepEqual(activeFilter, { background: "rgb(255, 204, 51)", foreground: "rgb(0, 0, 0)" }, theme + ": active filter uses the readable accent pair");
      await page.goto(base + "/store/theme-test/p/sac-signature");
      await page.locator(".product-detail-copy").waitFor();
      await checkPage(page, `${theme}/${viewport.width}/product`);
      await page.getByRole("button", { name: "Noir", exact: true }).click();
      assert.ok((await page.getByRole("button", { name: "Noir", exact: true }).getAttribute("class"))?.includes("active"));
      await page.getByRole("button", { name: "Sac Signature 2", exact: true }).click();
      assert.ok((await page.locator(".product-gallery-main img").getAttribute("src"))?.includes("watch"));
    }
  }

  await mkdir("artifacts/themes", { recursive: true });
  // Review real compositions with their native palette, not only the shared test accent.
  const directions = ["beauty-ecrin", "fashion-editorial", "sport-club", "home-habitat", "tech-precision", "food-menu", "gifts-celebration"];
  themeSettings = {};
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (theme of directions) {
      await page.goto(base + "/store/theme-test");
      await page.locator('.theme-hero').waitFor();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
      });
      await checkPage(page, `${theme}/${width}/art-direction`);
      await page.screenshot({ path: `artifacts/themes/direction-${theme}-${width}.png`, fullPage: true });
      // Photos and their product metadata must stay separate at every width.
      for (const card of await page.locator('.theme-feature-card, .theme-panel, .theme-catalog-picks > a').all()) {
        const image = await card.locator('.theme-feature-visual, .theme-panel-visual, .theme-catalog-visual').boundingBox();
        const copy = await card.locator(':scope > div').boundingBox();
        assert.ok(image && copy, "Featured products expose a visible photo and visible metadata");
        assert.ok(copy.y >= image.y + image.height - 1 || copy.x >= image.x + image.width - 1, `${theme}: product text never covers its photo`);
      }
      if (theme === "fashion-editorial" && width === 1440) {
        const photo = await page.locator('.theme-editorial-image').boundingBox();
        const story = await page.locator('.theme-introduction').boundingBox();
        assert.ok(photo && story && photo.x < story.x, "Editorial spread leads with photography on desktop");
      }
      if (theme === "beauty-ecrin") {
        await page.getByRole('button', { name: "Collection de soins", exact: true }).click();
        assert.equal(await page.locator('.theme-spotlight-copy h1').textContent(), "Collection de soins");
        assert.ok((await page.locator('.theme-spotlight-copy .theme-cta').getAttribute('href'))?.endsWith('/collection-soins'));
      }
      await page.goto(base + "/store/theme-test/p/sac-signature");
      await page.locator('.product-detail-copy').waitFor();
      await checkPage(page, `${theme}/${width}/product-art-direction`);
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode().catch(() => {}))); });
      await page.screenshot({ path: `artifacts/themes/product-${theme}-${width}.png` });
      if (["tech-precision", "food-menu", "gifts-celebration"].includes(theme)) {
        await page.getByRole("button", { name: "Noir", exact: true }).click();
        await page.getByRole("button", { name: "Ajouter au panier", exact: true }).click();
        await page.goto(base + "/store/theme-test/cart");
        await page.locator('.cart-form').waitFor();
        await checkPage(page, `${theme}/${width}/checkout-art-direction`);
        await page.screenshot({ path: `artifacts/themes/cart-${theme}-${width}.png`, fullPage: true });
      }
    }
  }
  themeSettings = { accent: "#ffcc33" };
  single = true;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (theme of ["clean", "fashion-editorial", "fashion-collection", "beauty-ecrin", "food-menu", "gifts-celebration"]) {
      themeSettings = theme === "gifts-celebration" ? { accent: "#cf24db", font: "sans", imageFit: "contain" } : {};
      await page.goto(base + "/store/theme-test");
      await page.locator('.theme-hero[data-products="1"]').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await checkPage(page, `${theme}/${width}/single-product`);
      assert.equal(await page.locator('.theme-hero').getByText("Sac Signature", { exact: true }).count() > 0, true, "A single product is featured, including Clean");
      if (await page.locator('.theme-feature-visual').count()) {
        const visual = await page.locator('.theme-feature-visual').first().boundingBox();
        const card = await page.locator('.theme-feature-card').first().boundingBox();
        assert.ok(visual && card && Math.abs(visual.width - card.width) < 1, "The product scene fills its card instead of leaving an empty side strip");
      }
      await page.screenshot({ path: `artifacts/themes/single-${theme}-${width}.png` });
      if (theme === "gifts-celebration") {
        assert.equal(await page.locator('[data-theme]').getAttribute('data-image-fit'), "contain");
        const fit = await page.locator('.theme-feature-visual img').evaluate((image) => getComputedStyle(image).objectFit);
        assert.equal(fit, "contain", "Custom artwork keeps its full image instead of inheriting a crop");
        const price = await page.locator('.theme-feature-caption > strong').boundingBox();
        const action = await page.locator('.theme-card-link').boundingBox();
        assert.ok(price && price.y + price.height < 844, "Single-product name/price appear in the first viewport");
        assert.ok(action && action.y + action.height < 844, "The first viewport contains a product action");
        assert.equal(await page.locator('.theme-kicker').textContent(), "Mode", "The merchant category replaces the template's sample sector");
      }
    }
  }
  single = false;
  theme = "gifts-celebration";
  empty = true;
  await page.goto(base + "/store/theme-test");
  await page.locator('.theme-empty-hero').waitFor();
  assert.equal(await page.locator('[data-theme]').getAttribute('data-theme'), theme);
  assert.equal(await page.locator('.theme-empty-hero .theme-cta').count(), 0, "An empty store has no collection CTA leading to nothing");
  await checkPage(page, "branded empty theme");
  await page.screenshot({ path: "artifacts/themes/empty-theme-390.png" });
  empty = false;

  theme = "sport-stadium";
  await page.goto(base + "/store/theme-test/p/sac-signature");
  await page.getByRole("button", { name: "Noir", exact: true }).click();
  await Promise.all([page.waitForURL("https://wa.me/**"), page.getByRole("button", { name: /Acheter sur WhatsApp/ }).click()]);
  assert.deepEqual(handoffBody.variants, [{ name: "Couleur", value: "Noir" }]);
  empty = true;
  await page.goto(base + "/store/theme-test");
  await page.locator(".public-empty-catalog").waitFor();
  await checkPage(page, "empty catalog");

  const sectorExamples = [
    ["beauty-ecrin", "Collection de soins", "/themes/beauty-v1-960.webp"],
    ["fashion-editorial", "Ensemble en lin", "/landing/fashion-960.webp"],
    ["sport-stadium", "Maillot Tricolore", "/themes/sport-v1-960.webp"],
    ["home-habitat", "Fauteuil Raphia", "/themes/home-v1-960.webp"],
    ["tech-precision", "Casque Studio", "/landing/headphones-960.webp"],
    ["food-menu", "L’Assiette Maison", "/themes/food-v1-960.webp"],
    ["grocery-marche", "Panier fraîcheur", "/themes/grocery-v1-960.webp"],
    ["gifts-celebration", "Coffret Jolis Instants", "/themes/gifts-v1-960.webp"],
    ["kids-play", "Coffret Petits Soleils", "/themes/kids-v1-960.webp"],
    ["auto-performance", "Roue Graphite", "/themes/auto-v1-960.webp"],
    ["accessories-street", "Sac Sillage", "/themes/accessories-v1-960.webp"],
    ["jewelry-joaillerie", "Montre Atelier", "/landing/watch-960.webp"]
  ];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [preset, productName, imagePath] of sectorExamples) {
      await page.goto(base + "/themes/" + preset);
      await page.locator('.theme-hero img').first().waitFor();
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode().catch(() => {}))); });
      assert.ok((await page.locator('.theme-hero img').first().getAttribute('src'))?.endsWith(imagePath), preset + ": sector-appropriate hero image");
      assert.ok((await page.locator('.theme-hero').getByText(productName, { exact: true }).count()) > 0, preset + ": sector-appropriate product");
      await checkPage(page, `${preset}/${width}/curated-showroom`);
      await page.locator('.public-store-shell').screenshot({ path: `artifacts/themes/showroom-${preset}-${width}.png` });
    }
  }
  // WCAG reflow width: the public store also fits a narrow 320px viewport.
  await page.setViewportSize({ width: 320, height: 844 });
  empty = false;
  for (theme of ["beauty-ecrin", "fashion-editorial", "sport-club", "home-habitat", "tech-precision", "food-menu"]) {
    await page.goto(base + "/store/theme-test");
    await page.locator('.theme-hero').waitFor();
    await checkPage(page, theme + "/320/reflow");
  }
  await page.setViewportSize({ width: 390, height: 844 });

  // The showroom's introduction and creation link must work while its
  // interactive workspace is still downloading, including reduced motion.
  let releaseWorkspace;
  const workspaceDownload = new Promise((resolve) => { releaseWorkspace = resolve; });
  await page.route("**/src/themes/ThemeGalleryWorkspace.tsx*", async (route) => {
    await workspaceDownload;
    await route.continue();
  });
  await page.goto(base + "/themes/beauty-ecrin", { waitUntil: "domcontentloaded" });
  await page.locator(".theme-gallery-loading").waitFor();
  assert.equal(await page.locator(".theme-gallery-create").isVisible(), true);
  assert.equal(await page.locator(".theme-gallery-create").getAttribute("href"), "/app");
  assert.equal(parseInt(await page.locator(".theme-gallery-intro h1").textContent(), 10), 25);
  releaseWorkspace();
  await page.unroute("**/src/themes/ThemeGalleryWorkspace.tsx*");
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
  assert.ok(new URL(page.url()).pathname.includes("/p/"));
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

  // Exercise the built application on a Pages preview origin. Serve only local
  // build assets and intercept the destination; CI does not create an account
  // or grant a PR preview access to the production API.
  const previewOrigin = "https://qa-merchant.trigenys-commerce-factory.pages.dev";
  const previewPage = await browser.newPage({ locale: "fr-FR" });
  const previewErrors = [];
  previewPage.on("pageerror", (error) => previewErrors.push(error.message));
  await previewPage.route(previewOrigin + "/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const asset = pathname.startsWith("/assets/") || pathname.startsWith("/landing/") || /^\/[a-zA-Z0-9-]+\.(png|svg|ico)$/.test(pathname);
    const file = asset ? pathname : "/index.html";
    const extension = file.split(".").pop();
    const contentType = { js: "application/javascript", css: "text/css", webp: "image/webp", avif: "image/avif", png: "image/png", svg: "image/svg+xml", html: "text/html" }[extension] || "application/octet-stream";
    await route.fulfill({ contentType, body: await readFile(new URL("../dist" + file, import.meta.url)) });
  });
  await previewPage.route(productionMerchantAppUrl, (route) => route.fulfill({
    contentType: "text/html",
    body: '<h1>Espace marchand</h1><label>Email <input type="email"></label>'
  }));
  await previewPage.goto(previewOrigin + "/");
  await previewPage.locator(".cfh-primary").waitFor();
  await checkPage(previewPage, "preview landing");
  const creationLinks = await previewPage.locator('a[href$="/app"]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  assert.ok(creationLinks.length > 0);
  assert.ok(creationLinks.every((href) => href === productionMerchantAppUrl), "All landing creation/login links use the canonical merchant origin");
  await previewPage.goto(previewOrigin + "/themes/beauty-ecrin");
  await previewPage.locator(".theme-gallery-cta").waitFor();
  for (const selector of [".theme-gallery-create", ".theme-gallery-cta"]) {
    assert.equal(await previewPage.locator(selector).getAttribute("href"), productionMerchantAppUrl);
  }
  await Promise.all([
    previewPage.waitForURL(productionMerchantAppUrl),
    previewPage.locator(".theme-gallery-create").click()
  ]);
  assert.equal(await previewPage.getByLabel("Email").isVisible(), true);
  await previewPage.goto(previewOrigin + "/app");
  await previewPage.waitForURL(productionMerchantAppUrl);
  assert.equal(await previewPage.getByLabel("Email").isVisible(), true, "An old preview /app link also reaches the canonical merchant entry");
  assert.deepEqual(previewErrors, [], "Preview merchant navigation errors");
  await previewPage.close();
  assert.deepEqual(errors, [], "Browser errors");
  console.log(`Verified ${storeThemeIds.length} themes at desktop/mobile sizes, product pages, filtering, variants, handoff, gallery deep links, transparent WebP resizing and preview-to-canonical merchant navigation.`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
