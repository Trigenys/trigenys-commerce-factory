import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const base = "http://127.0.0.1:5186";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5186", "--strictPort"], { stdio: "pipe" });
let log = "";
server.stdout.on("data", data => log += data);
server.stderr.on("data", data => log += data);
let browser;
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw Error(log);
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch { /* booting */ }
    await delay(100);
  }
  assert.ok(ready, "Vite server failed: " + log);
  browser = await chromium.launch({ headless: true });
  await mkdir("artifacts/wow-lab", { recursive: true });
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base + "/labs/cinematic-product-story");
    await page.getByRole("heading", { level: 1 }).waitFor();
    assert.equal(await page.locator(".cinematic-scene-choice button").count(), 3);
    await page.getByRole("button", { name: "Produit suivant" }).click();
    assert.equal(await page.locator(".cinematic-lab").getAttribute("data-tone"), "sage");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    await page.getByRole("button", { name: "Next product" }).click();
    assert.equal(await page.locator(".cinematic-lab").getAttribute("data-tone"), "plum");
    assert.equal(await page.locator(".cinematic-selected-story a").getAttribute("href"), "/themes/accessories-signature");
    await page.locator(".cinematic-lab img").evaluateAll(images => images.forEach(image => image.loading = "eager"));
    await page.waitForFunction(() => [...document.querySelectorAll(".cinematic-lab img")].every(img => img.complete), null, { timeout: 15000 });
    const broken = await page.locator(".cinematic-lab img").evaluateAll(images => images.filter(img => !img.naturalWidth).map(img => img.src));
    assert.deepEqual(broken, [], "Broken media at " + width);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, "Horizontal overflow at " + width);
    assert.deepEqual(errors, [], "Page errors at " + width);
    await page.screenshot({ path: "artifacts/wow-lab/cinematic-" + width + ".png", fullPage: true });
    await page.close();
  }
  console.log("Cinematic lab routes, media, mobile widths, controls and screenshots verified");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
