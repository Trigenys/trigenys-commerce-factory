import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { brandFixture } from "./brand-fixture.mjs";

const base = "http://127.0.0.1:5195", output = "artifacts/motion-brand";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5195", "--strictPort"], {
  stdio: "pipe", env: { ...process.env, VITE_API_BASE_URL: "http://127.0.0.1:8787" }
});
const report = { motion: [], pages: [], accessibility: [], overflow: [], errors: [], limitation: "Sessions and API data are isolated fixtures. Automated checks do not establish full accessibility conformity or human creative acceptance." };
const axeSource = await readFile("node_modules/axe-core/axe.min.js", "utf8");
let browser, currentPage, serverLog = "";
server.stdout.on("data", value => serverLog += value);
server.stderr.on("data", value => serverLog += value);

async function axe(page, label) {
  await page.evaluate(axeSource);
  const violations = await page.evaluate(async () => (await axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] }
  })).violations.filter(item => ["serious", "critical"].includes(item.impact)).map(item => ({ id: item.id, targets: item.nodes.map(node => node.target), details: item.nodes.map(node => node.failureSummary) })));
  report.accessibility.push({ label, violations });
  assert.deepEqual(violations, [], label + ": accessibility");
}
async function ready(page) {
  await page.locator("h1").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function overflow(page, label) {
  const metrics = await page.evaluate(() => {
    window.scrollTo({ left: 100000, top: scrollY, behavior: "instant" });
    return { viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, x: scrollX, shell: document.querySelector(".brand-page")?.getBoundingClientRect().toJSON() };
  });
  report.overflow.push({ label, ...metrics });
  assert.ok(metrics.document <= metrics.viewport + 1, label + ": document overflow " + JSON.stringify(metrics));
  assert.equal(metrics.x, 0, label + ": horizontal viewport scrolling exposes an empty strip");
  assert.ok(Math.abs(metrics.shell.left) < 1 && metrics.shell.right <= metrics.viewport + 1, label + ": brand shell does not fill the viewport");
}
async function screenshot(page, label, fullPage = false) {
  await page.screenshot({ path: output + "/" + label + ".png", fullPage });
}
try {
  await mkdir(output, { recursive: true });
  let available = false;
  for (let attempt = 0; attempt < 70; attempt++) {
    try { if ((await fetch(base, { signal: AbortSignal.timeout(700) })).ok) { available = true; break; } } catch {}
    await delay(100);
  }
  assert.ok(available, serverLog);
  browser = await chromium.launch({ headless: true });

  // Real timers demonstrate visible auto-rotation; there is no shortened test interval.
  for (const width of [1440, 390, 768]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "no-preference", locale: "fr-FR" });
    const page = await context.newPage(), errors = [];
    currentPage = page;
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await ready(page);
    const hero = page.locator(".cfh-stage");
    await hero.locator(".cfh-photo").waitFor();
    await page.waitForFunction(() => document.querySelector(".cfh-photo")?.complete);
    await screenshot(page, "hero-normal-" + width);
    if (width !== 768) {
      await page.mouse.move(2, 2);
      await page.locator('.cfh-stage[data-running="true"]').waitFor();
      await page.locator(".cfh-stage--tech").waitFor({ timeout: 12000 });
      const current = await hero.locator(".cfh-product-name").innerText();
      await hero.hover();
      await page.locator('.cfh-stage[data-running="false"]').waitFor();
      await delay(8200);
      assert.equal(await hero.locator(".cfh-product-name").innerText(), current, "Hover suspends auto-rotation");
      await hero.locator(".carousel-rotation").focus();
      await page.mouse.move(2, 2);
      assert.equal(await hero.getAttribute("data-playing"), "false", "Keyboard focus stops rotation until explicit restart");
      await hero.locator(".carousel-rotation").press("Space");
      await page.locator('.cfh-stage[data-running="true"]').waitFor();
      await hero.locator(".carousel-next").click();
      assert.equal(await hero.getAttribute("data-playing"), "false", "Manual selection preserves the reading state");
    }
    const origin = await page.locator(".cfh-photo-plane").evaluate(node => getComputedStyle(node).translate);
    await page.evaluate(() => scrollTo({ top: 450, behavior: "instant" }));
    await page.waitForFunction(previous => getComputedStyle(document.querySelector(".cfh-photo-plane")).translate !== previous, origin);
    report.motion.push({ width, parallax: true, nativeScroll: await page.evaluate(() => scrollY) });

    const rail = page.locator(".journey-scroll-track");
    await page.locator('.journey-scroll-track[data-scroll-enabled="true"]').waitFor({ timeout: 5000 });
    for (const phase of [0, 1, 2, 3, 1]) {
      await rail.evaluate((track, phase) => {
        const scene = track.querySelector(".journey-stage");
        const header = document.querySelector(".site-header");
        const span = track.getBoundingClientRect().height - scene.getBoundingClientRect().height;
        const start = scrollY + track.getBoundingClientRect().top - header.getBoundingClientRect().height - 12;
        scrollTo({ top: start + span * phase / 3, behavior: "instant" });
      }, phase);
      await page.locator('.journey-stage[data-stage="' + phase + '"]').waitFor();
      const pinned = await page.evaluate(() => ({ top: document.querySelector(".journey-stage").getBoundingClientRect().top, expected: document.querySelector(".site-header").getBoundingClientRect().height + 12 }));
      assert.ok(Math.abs(pinned.top - pinned.expected) <= 3, "Scene must remain in view during the story: " + JSON.stringify(pinned));
      assert.equal(await page.locator(".journey-step").nth(phase).getAttribute("aria-pressed"), "true");
      if (phase === 3) assert.ok(await page.locator(".journey-message-reply").isVisible());
      await page.locator('.cfh-stage[data-running="false"]').waitFor();
      await overflow(page, "story-" + phase + "-" + width);
      await delay(300); // Capture the selected state after its color transition.
      await screenshot(page, "story-" + phase + "-" + width);
      if (phase === 2) await axe(page, "story-normal-" + width);
    }
    await page.locator(".journey-skip").click();
    await page.waitForFunction(() => {
      const box = document.getElementById("dashboard").getBoundingClientRect();
      return box.top >= 65 && box.top < 150;
    });
    assert.ok(await page.locator("#dashboard h2").isVisible(), "Native scroll leaves the story normally");
    await page.evaluate(() => document.getElementById("pricing").scrollIntoView({ behavior: "instant" }));
    await page.locator("#pricing .landing-section-heading.is-revealed").waitFor();
    await page.locator(".landing-pricing-clarity").evaluate(node => node.scrollIntoView({ behavior: "instant", block: "center" }));
    await page.locator(".landing-pricing-clarity.is-revealed").waitFor();
    assert.match(await page.locator(".landing-pricing-clarity").innerText(), /0 FCFA/);
    await screenshot(page, "pricing-normal-" + width);
    if (width === 768) {
      await page.locator(".showcase-carousel").evaluate(node => node.scrollIntoView({ behavior: "instant", block: "center" }));
      await page.mouse.move(2, 2);
      await page.locator('.showcase-carousel[data-running="true"]').waitFor();
      await page.locator('.showcase-carousel .landing-concept:not([hidden]) h3').filter({ hasText: "TechPulse" }).waitFor({ timeout: 12000 });
      await page.locator(".showcase-carousel-picker button").nth(2).click();
      assert.equal(await page.locator(".showcase-carousel").getAttribute("data-playing"), "false");
      assert.equal(await page.locator(".showcase-carousel .landing-concept:not([hidden])").count(), 1);
      await screenshot(page, "showcase-auto-and-manual-" + width);
    }
    assert.deepEqual(errors, [], "Normal-motion browser errors");
    report.motion.push({ width, scrollStory: true, reverse: true, skip: true, reveals: true, errors });
    await context.close();
  }

  for (const width of [320, 980, 1920, 2560]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage(); currentPage = page;
    await page.goto(base); await ready(page);
    await page.mouse.move(width - 1, 350); await page.mouse.wheel(1600, 0);
    await overflow(page, "edges-" + width);
    await page.evaluate(() => document.getElementById("showcase").scrollIntoView({ behavior: "instant" }));
    await overflow(page, "showcase-edges-" + width);
    await screenshot(page, "edges-" + width);
    await context.close();
  }

  const manual = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: "reduce" });
  const page = await manual.newPage(); currentPage = page;
  await page.goto(base); await ready(page);
  assert.equal(await page.locator(".cfh-stage").getAttribute("data-running"), "false");
  assert.equal(await page.locator(".journey-scroll-track").getAttribute("data-scroll-enabled"), "false");
  assert.equal(await page.locator(".landing-shell").evaluate(node => node.classList.contains("motion-enabled")), false);
  await page.locator(".cfh-pick").nth(2).click();
  assert.match(await page.locator(".cfh-product-name").innerText(), /Kit éclat/);
  await page.locator(".journey-step").nth(3).click();
  assert.ok(await page.locator(".journey-message-reply").isVisible());
  await axe(page, "reduced-motion");
  await manual.close();
  const laptop = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: "no-preference" });
  const laptopPage = await laptop.newPage(); currentPage = laptopPage;
  await laptopPage.goto(base); await ready(laptopPage);
  await laptopPage.locator('.journey-scroll-track[data-scroll-enabled="true"]').waitFor();
  await laptopPage.locator(".journey-scroll-track").evaluate(track => {
    const scene = track.querySelector(".journey-stage");
    const header = document.querySelector(".site-header");
    const start = scrollY + track.getBoundingClientRect().top - header.getBoundingClientRect().height - 12;
    scrollTo({ top: start + track.getBoundingClientRect().height - scene.getBoundingClientRect().height, behavior: "instant" });
  });
  await laptopPage.locator('.journey-stage[data-stage="3"]').waitFor();
  assert.ok(await laptopPage.locator(".journey-stage").evaluate(node => node.getBoundingClientRect().bottom < innerHeight - 10), "Pinned walkthrough must fit a laptop viewport");
  await delay(700);
  await screenshot(laptopPage, "laptop-scroll-story");
  await axe(laptopPage, "laptop-scroll-story");
  await laptop.close();
  const short = await browser.newContext({ viewport: { width: 390, height: 650 }, reducedMotion: "no-preference" });
  const shortPage = await short.newPage(); currentPage = shortPage;
  await shortPage.goto(base); await ready(shortPage);
  assert.equal(await shortPage.locator(".journey-scroll-track").getAttribute("data-scroll-enabled"), "false");
  await shortPage.locator(".journey-step").nth(3).click();
  assert.ok(await shortPage.locator(".journey-message-reply").isVisible(), "Short viewports retain working manual controls");
  await screenshot(shortPage, "short-viewport-fallback");
  await short.close();

  for (const width of [390, 1440]) for (const language of ["fr", "en"]) {
    const { page, context, state } = await brandFixture(browser, base, { width, language });
    currentPage = page;
    for (const route of ["/help", "/contact", "/privacy", "/terms", "/missing-brand-page"]) {
      await page.goto(base + route); await ready(page);
      const color = await page.locator(".info-header").evaluate(node => getComputedStyle(node).backgroundColor);
      assert.match(color, /251, 245, 235/);
      assert.ok(await page.locator(".info-footer").count());
      const destinations = await page.locator(".info-header a").evaluateAll(links => links.map(link => link.getAttribute("href")));
      assert.ok(!destinations.some(href => href.startsWith("#")), "Subpage navigation must resolve to real routes");
      await overflow(page, route + "-" + language + "-" + width);
      await axe(page, route + "-" + language + "-" + width);
      await screenshot(page, route.slice(1) + "-" + language + "-" + width, true);
      report.pages.push({ route, width, language, header: color });
    }
    for (const route of ["/app", "/app/products", "/app/orders", "/app/analytics", "/app/settings"]) {
      await page.goto(base + route + "?store=11111111-1111-4111-8111-111111111111"); await ready(page);
      await page.locator(".merchant-sidebar").waitFor();
      assert.ok(!/page.*(introuvable|not found)/i.test(await page.locator("h1").first().innerText()));
      const color = await page.locator(".admin-header").evaluate(node => getComputedStyle(node).backgroundColor);
      assert.match(color, /251, 245, 235/);
      await overflow(page, route + "-" + language + "-" + width);
      await axe(page, route + "-" + language + "-" + width);
      await screenshot(page, "workspace-" + route.split("/").pop() + "-" + language + "-" + width);
      report.pages.push({ route, width, language, header: color });
    }
    assert.equal(state.calls.filter(call => call.path.startsWith("/v1/") && !["GET", "OPTIONS"].includes(call.method)).length, 0, "Brand review does not write merchant data");
    await context.close();
    for (const authenticated of [false, true]) {
      const { page, context } = await brandFixture(browser, base, { width, language, authenticated, hasStore: false });
      currentPage = page;
      await page.goto(base + "/app"); await ready(page);
      await page.locator(authenticated ? ".merchant-form-card" : ".auth-card").waitFor();
      await overflow(page, "account-" + authenticated + "-" + language + "-" + width);
      await axe(page, "account-" + authenticated + "-" + language + "-" + width);
      await screenshot(page, (authenticated ? "onboarding" : "account") + "-" + language + "-" + width, true);
      if (!authenticated) {
        await page.locator(".auth-tabs button").nth(1).click();
        await page.locator("#account-consent").waitFor();
        await overflow(page, "signup-" + language + "-" + width);
        await axe(page, "signup-" + language + "-" + width);
        await screenshot(page, "signup-" + language + "-" + width, true);
      }
      await context.close();
    }
  }
} catch (error) {
  report.errors.push(String(error?.stack ?? error)); process.exitCode = 1;
  if (currentPage && !currentPage.isClosed()) await screenshot(currentPage, "failure", true).catch(() => {});
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await mkdir(output, { recursive: true });
  await writeFile(output + "/report.json", JSON.stringify(report, null, 2) + "\n");
  if (report.errors.length) process.stderr.write(report.errors.join("\n") + "\n");
  else process.stdout.write(JSON.stringify({ motion: report.motion.length, pages: report.pages.length, axeStates: report.accessibility.length, overflowChecks: report.overflow.length }) + "\n");
}
