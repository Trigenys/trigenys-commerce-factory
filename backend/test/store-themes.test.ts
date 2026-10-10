import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { accentForeground, resolveStoreTheme, storeThemeIds } from "../../shared/store-themes.ts";

function luminance(hex: string) {
  const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}

test("custom accent buttons maintain WCAG AA text contrast", () => {
  for (let red = 0; red <= 255; red += 17) {
    for (let green = 0; green <= 255; green += 17) {
      for (let blue = 0; blue <= 255; blue += 17) {
        const accent = "#" + [red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("");
        const foreground = accentForeground(accent);
        const values = [luminance(accent), luminance(foreground)].sort((a, b) => a - b);
        assert.ok((values[1] + .05) / (values[0] + .05) >= 4.5, accent);
      }
    }
  }
});

test("legacy stores and unknown future themes render with a safe default", () => {
  assert.equal(resolveStoreTheme(undefined).id, "clean");
  assert.equal(resolveStoreTheme("future-theme", { css: "unsafe" }).id, "clean");
  assert.equal(resolveStoreTheme("beauty-ecrin").imageFit, "contain");
});

test("database migration accepts exactly the same stable IDs as the runtime", async () => {
  const sql = await readFile(new URL("../../db/migrations/0006_store_theme_library.sql", import.meta.url), "utf8");
  const constraint = sql.match(/theme IN \(([\s\S]*?)\)\)/)?.[1] ?? "";
  const ids = [...constraint.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(ids.sort(), [...storeThemeIds].sort());
});
