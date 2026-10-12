import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const base = "http://127.0.0.1:5194", output = "artifacts/landing";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5194", "--strictPort"], {
  stdio: "pipe", env: { ...process.env, VITE_API_BASE_URL: "https://api.example.invalid" }
});
const axeSource = await readFile("node_modules/axe-core/axe.min.js", "utf8");
const report = { checks: [], accessibility: [], errors: [], limitation: "Automated gates do not establish complete accessibility conformity or human creative approval." };
let browser, currentPage, serverLog = "";
server.stdout.on("data", value => serverLog += value);
server.stderr.on("data", value => serverLog += value);

async function accessibility(page, label) {
  await page.evaluate(axeSource);
  const violations = await page.evaluate(async () => (await axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] }
  })).violations.filter(item => ["serious", "critical"].includes(item.impact)).map(item => ({
    id: item.id, targets: item.nodes.map(node => node.target), details: item.nodes.map(node => node.failureSummary)
  })));
  report.accessibility.push({ label, violations });
  assert.deepEqual(violations, [], label + ": accessibility violations");
}

try {
  await mkdir(output, { recursive: true });
  let ready = false;
  for (let attempt = 0; attempt < 70; attempt++) {
    try { if ((await fetch(base, { signal: AbortSignal.timeout(700) })).ok) { ready = true; break; } } catch {}
    await delay(100);
  }
  assert.ok(ready, serverLog);
  browser = await chromium.launch({ headless: true });
  for (const width of [390, 768, 1440]) for (const language of ["fr", "en"]) {
    const fr = language === "fr", label = language + "-" + width;
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", locale: fr ? "fr-FR" : "en-GB" });
    await context.addInitScript(language => localStorage.setItem("commerce-factory-language", language), language);
    const page = await context.newPage(), errors = [];
    currentPage = page;
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.locator(".cfh-photo").waitFor();
    await page.waitForFunction(() => document.querySelector(".cfh-photo")?.complete && document.querySelector(".cfh-photo")?.naturalWidth > 0);
    await page.evaluate(() => document.fonts.ready);
    const initial = await page.evaluate(() => {
      const header = document.querySelector(".landing-header"), photo = document.querySelector(".cfh-photo");
      return {
        scrollY, viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        background: getComputedStyle(header).backgroundColor, headerHeight: header.getBoundingClientRect().height,
        headerTop: header.getBoundingClientRect().top, photoTop: photo.getBoundingClientRect().top
      };
    });
    assert.equal(initial.scrollY, 0, "First fold must be checked before scrolling");
    assert.equal(initial.headerTop, 0);
    assert.ok(initial.scrollWidth <= width + 1, "Initial horizontal overflow");
    const color = initial.background.match(/[\d.]+/g).map(Number);
    assert.ok(color[0] - color[2] > 8, "Header should use the warm hero palette, not the old white/lavender strip");
    if (width === 390) assert.ok(initial.photoTop < 730, "Product proof falls below the first mobile window: " + JSON.stringify(initial));
    if (width === 768) assert.ok(initial.photoTop < 900, "Tablet product proof falls below the first window: " + JSON.stringify(initial));
    await page.screenshot({ path: output + "/first-fold-" + label + ".png" });
    await accessibility(page, "initial-" + label);
    assert.equal(await page.locator(".cfh-primary").getAttribute("href"), "/app");
    assert.equal(await page.locator(".landing-offer.is-available a").getAttribute("href"), "/app");
    assert.equal(await page.locator(".landing-offer.is-planned a").getAttribute("href"), "/contact");
    assert.match(await page.locator(".landing-offer.is-planned").innerText(), fr ? /En préparation/ : /In preparation/);
    assert.equal(await page.locator(".landing-theme-count").innerText().then(text => parseInt(text, 10)), 25);
    assert.equal(await page.locator(".landing-theme-copy a").getAttribute("href"), "/themes");
    assert.ok(!/\bMVP\b/.test(await page.locator("main").innerText()), "Public copy should describe the merchant experience");
    assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(links => links.map(link => link.getAttribute("href")).filter(href => !document.getElementById(href.slice(1)))), [], "Every landing anchor has a real destination");

    if (width <= 1200) {
      const toggle = page.locator(".landing-menu-toggle"), menu = page.locator("#landing-mobile-menu");
      await toggle.click();
      assert.equal(await toggle.getAttribute("aria-expanded"), "true");
      assert.ok(await menu.isVisible());
      await accessibility(page, "menu-" + label);
      await page.screenshot({ path: output + "/menu-" + label + ".png" });
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("href")), "#how", "Keyboard enters the disclosed navigation");
      await page.keyboard.press("Escape");
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.equal(await toggle.evaluate(element => element === document.activeElement), true, "Escape returns focus to the menu button");
      await toggle.click();
      await menu.locator('a[href="#whatsapp"]').click();
      assert.equal(await toggle.getAttribute("aria-expanded"), "false", "Choosing a section closes the menu");
    } else await page.locator('.desktop-nav a[href="#whatsapp"]').click();
    await page.waitForFunction(() => {
      const header = document.querySelector(".landing-header").getBoundingClientRect();
      const section = document.querySelector("#whatsapp").getBoundingClientRect();
      return scrollY > 300 && Math.abs(header.top) < 2 && section.top >= header.bottom && section.top < header.bottom + 30;
    });
    await page.locator('.landing-header[data-scrolled="true"]').waitFor();
    assert.equal(await page.locator(".landing-header").getAttribute("data-scrolled"), "true");
    await page.screenshot({ path: output + "/sticky-" + label + ".png" });

    // Hero controls and the interactive WhatsApp walkthrough remain functional.
    await page.locator(".journey-product-choice").nth(1).click();
    await page.locator(".journey-next").click();
    assert.ok((await page.locator(".journey-message").innerText()).includes(fr ? "35 000 FCFA" : "35,000 FCFA"));
    await page.locator(".cfh-pick").nth(1).click();
    assert.match(await page.locator(".cfh-product-name").innerText(), /Sony/);
    await page.locator(".cfh-pick").nth(0).click();
    await page.getByRole("button", { name: fr ? "EN" : "FR", exact: true }).click();
    assert.match(await page.locator("#cfh-heading").innerText(), fr ? /Show your products/ : /Montrez vos produits/);
    await page.getByRole("button", { name: fr ? "FR" : "EN", exact: true }).click();
    assert.match(await page.locator("#cfh-heading").innerText(), fr ? /Montrez vos produits/ : /Show your products/);

    await page.locator("#faq summary").first().press("Enter");
    assert.equal(await page.locator("#faq details").first().getAttribute("open"), "");
    await accessibility(page, "faq-" + label);
    for (const id of ["how", "showcase", "dashboard", "pricing", "faq", "launch"]) {
      await page.evaluate(id => document.getElementById(id).scrollIntoView({ behavior: "instant", block: "start" }), id);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), id + ": horizontal overflow");
      if (id === "showcase") {
        for (const image of await page.locator(".landing-concept img").all()) {
          await image.scrollIntoViewIfNeeded();
          await page.waitForFunction(() => [...document.querySelectorAll(".landing-concept img")].filter(image => {
            const box = image.getBoundingClientRect();
            return box.bottom > 0 && box.top < innerHeight;
          }).every(image => image.complete && image.naturalWidth > 0));
        }
        await page.evaluate(() => document.getElementById("showcase").scrollIntoView({ behavior: "instant", block: "start" }));
      }
      if (language === "fr") await page.screenshot({ path: output + "/" + id + "-" + width + ".png" });
    }
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: output + "/full-" + label + ".png", fullPage: true });
    assert.deepEqual(errors, [], "Uncaught browser errors");
    report.checks.push({ language, width, ...initial, passed: true, scenarios: "Warm header, first-fold product, navigation/anchors, mobile keyboard/Escape, sticky scroll, themes/merchant/contact paths, honest planned offer, hero and WhatsApp controls, language switch, FAQ and whole-page layout" });
    await context.close();
  }
} catch (error) {
  report.errors.push(String(error?.stack || error));
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({ path: output + "/failure.png", fullPage: true }).catch(() => {});
    await writeFile(output + "/failure-dom.txt", await currentPage.locator("body").innerText().catch(() => ""));
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await writeFile(output + "/report.json", JSON.stringify(report, null, 2));
  if (report.errors.length) console.error(report.errors.join("\n")); else console.log(JSON.stringify(report));
}
