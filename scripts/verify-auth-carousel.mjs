// Regression test: login media never collapses during slide changes.
// Uses the existing isolated Neon/API fixture; no real account is touched.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { brandFixture } from "./brand-fixture.mjs";

const base = "http://127.0.0.1:5198";
const output = "artifacts/auth-carousel";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5198", "--strictPort"], {
  stdio: "pipe", env: { ...process.env, VITE_API_BASE_URL: "http://127.0.0.1:8787" }
});
let log = "", browser, pageForFailure;
server.stdout.on("data", data => log += data);
server.stderr.on("data", data => log += data);
const report = { checks: [], note: "Browser tests run with isolated auth fixtures, not live user accounts." };

async function geometry(page) {
  return page.locator(".auth-showcase-frame").evaluate(element => {
    const frame = element.getBoundingClientRect();
    return { width: frame.width, height: frame.height, ratio: frame.width / frame.height };
  });
}

try {
  await mkdir(output, { recursive: true });
  let started = false;
  for (let i = 0; i < 70; i++) {
    try { if ((await fetch(base)).ok) { started = true; break; } } catch {}
    await delay(200);
  }
  assert.ok(started, log);
  browser = await chromium.launch({ headless: true });
  for (const width of [390, 1440, 1920]) {
    const { context, page, state } = await brandFixture(browser, base, { authenticated: false, width });
    pageForFailure = page;
    // The existing fixture defaults to reduced motion; explicitly exercise the crossfade.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(base + "/app/login");
    const frame = page.locator(".auth-showcase-frame");
    await frame.waitFor();
    assert.equal(await page.locator(".auth-showcase-slide").count(), 6, "All six slides are mounted");
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll(".auth-showcase-slide img")).every(image => image.complete && image.naturalWidth > 0)
    );
    const before = await geometry(page);
    assert.ok(Math.abs(before.ratio - 16 / 9) < .02, "Fixed 16:9 stage ratio");
    assert.ok(before.height > 180, "Stage must never collapse");
    if (width >= 1440) assert.ok(before.width >= width * .59, "Large desktop stage must dominate the layout");
    else assert.ok(before.width >= width * .84, "Mobile image must use available width");
    assert.equal(await page.locator(".auth-showcase-slide.is-active").count(), 1);
    const transition = await page.locator(".auth-showcase-slide").first().evaluate(el => getComputedStyle(el).transitionDuration);
    assert.ok(transition.includes(".8s") || transition.includes("0.8s"), "Crossfade duration is applied");
    for (const expected of [1, 2, 3, 4, 5, 0]) {
      await page.getByRole("button", { name: "Image suivante" }).click();
      await page.waitForFunction(index => {
        const active = document.querySelector(".auth-showcase-slide.is-active");
        return active && Array.from(active.parentElement.children).indexOf(active) === index;
      }, expected);
      const after = await geometry(page);
      assert.ok(Math.abs(after.height - before.height) < 1, "Stage height stays constant across transitions");
      assert.ok(Math.abs(after.width - before.width) < 1, "Stage width stays constant across transitions");
      assert.equal(await page.locator(".auth-showcase-slide").count(), 6, "No slide is unmounted");
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "No horizontal overflow");
    assert.ok(await page.locator(".auth-card").isVisible(), "Login form remains visible");
    await page.screenshot({ path: `${output}/login-${width}.png`, fullPage: true });
    assert.deepEqual(state.browserErrors, [], "No browser errors or failed requests");
    report.checks.push(`Width ${width}: constant frame, six images, fluid crossfade, no crop, visible auth form`);
    await context.close();
  }
  {
    const { context, page } = await brandFixture(browser, base, { authenticated: false, width: 390 });
    await page.goto(base + "/app/login");
    await page.locator(".auth-showcase-frame").waitFor();
    assert.equal(await page.locator(".auth-showcase-actions button").last().isDisabled(), true, "Reduced motion disables automatic slideshow");
    const transition = await page.locator(".auth-showcase-slide").first().evaluate(el => getComputedStyle(el).transitionDuration);
    assert.ok(transition === "0s", "Reduced motion removes the crossfade");
    await page.getByRole("button", { name: "Image suivante" }).click();
    await page.waitForFunction(() => document.querySelector(".auth-showcase-slide.is-active") === document.querySelectorAll(".auth-showcase-slide")[1]);
    report.checks.push("Reduced-motion mode remains navigable without animation");
    await context.close();
  }
  await writeFile(output + "/report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  report.error = error.stack;
  await pageForFailure?.screenshot({ path: output + "/failure.png", fullPage: true }).catch(() => {});
  await writeFile(output + "/report.json", JSON.stringify(report, null, 2));
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
