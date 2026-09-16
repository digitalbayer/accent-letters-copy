import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const values = [];
    Object.defineProperty(window, "__copiedValues", { value: values, configurable: false });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value) => values.push(value) },
    });
  });
  await page.goto("/");
});

test("renders all letter families and copies representative values exactly", async ({ page }) => {
  await expect(page.getByRole("tab")).toHaveCount(26);
  await expect(page.getByRole("heading", { name: "A with accents" })).toBeVisible();
  await expect(page.locator(".character-button")).toHaveCount(58);

  for (const { letter, glyph } of [
    { letter: "A", glyph: "á" },
    { letter: "O", glyph: "Ǭ" },
    { letter: "S", glyph: "ṩ" },
    { letter: "Z", glyph: "Ź" },
    { letter: "Q", glyph: "Q\u0301" },
    { letter: "Q", glyph: "q\u0301" },
  ]) {
    await page.getByRole("tab", { name: new RegExp(`^${letter},`) }).click();
    const button = page.locator(`.character-button[data-glyph="${glyph}"]`);
    await button.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => document.scrollingElement.scrollTop);
    await button.click();
    await expect(page.getByRole("status")).toHaveText(`Copied “${glyph}”`);
    await expect(button).toBeFocused();
    expect(await page.evaluate(() => document.scrollingElement.scrollTop)).toBe(before);
  }

  expect(await page.evaluate(() => window.__copiedValues)).toEqual(["á", "Ǭ", "ṩ", "Ź", "Q\u0301", "q\u0301"]);
});

test("every tile sends its exact visible value to the clipboard", async ({ page }) => {
  const expected = [];
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    await page.getByRole("tab", { name: new RegExp(`^${letter},`) }).click();
    const buttons = page.locator(".character-button");
    const total = await buttons.count();
    for (let index = 0; index < total; index += 1) {
      const button = buttons.nth(index);
      const glyph = await button.getAttribute("data-glyph");
      expected.push(glyph);
      await button.click();
    }
  }
  expect(expected).toHaveLength(490);
  expect(await page.evaluate(() => window.__copiedValues)).toEqual(expected);
});

test("uses the local selection fallback when the Clipboard API rejects", async ({ page }) => {
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw new Error("Clipboard API unavailable");
    };
    document.execCommand = (command) => command === "copy";
  });
  const button = page.locator('.character-button[data-glyph="á"]');
  await button.click();
  await expect(page.getByRole("status")).toHaveText('Copied “á”');
  await expect(button).toBeFocused();
});

test("reports a truthful failure when both copy methods fail", async ({ page }) => {
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw new Error("Clipboard API unavailable");
    };
    document.execCommand = () => false;
  });
  const button = page.locator('.character-button[data-glyph="á"]');
  await button.click();
  await expect(page.getByRole("status")).toHaveText("Could not copy. Select the character and try again.");
  await expect(button).not.toHaveAttribute("data-copied");
  await expect(button).toBeFocused();
});

test("supports keyboard selection and has no unrestricted axe violations", async ({ page }) => {
  const firstTab = page.getByRole("tab", { name: /^A,/ });
  await firstTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /^B,/ })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: /^Z,/ })).toBeFocused();

  await page.addScriptTag({ path: axePath });
  const results = await page.evaluate(async () => window.axe.run(document));
  expect(results.violations).toEqual([]);
});

test("reflows at 320 pixels and 200 percent text without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.getByRole("tab", { name: /^Q,/ }).click();
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    buttons: [...document.querySelectorAll("button")].every((button) => {
      const box = button.getBoundingClientRect();
      return box.width >= 24 && box.height >= 24;
    }),
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  expect(metrics.buttons).toBe(true);
});
