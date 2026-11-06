/** L'éditeur : la barre d'état sous le texte, et la complétion. */
import { expect, test } from "@playwright/test";
import { APPS, CLAIR_SECTIONS, TECHNIQUES, openApp } from "../support/app.ts";

for (const { name, root } of APPS)
  test.describe(`l'éditeur (${name})`, () => {
    test("la barre d'état dit où est le curseur dans la musique, et ce que veut dire le signe dessous", async ({ page }) => {
      await openApp(page, { root, source: CLAIR_SECTIONS });
      await page.locator(".cm-line").nth(10).click();
      await page.keyboard.press("Home");
      for (let step = 0; step < 4; step++) await page.keyboard.press("ArrowRight");
      const status = page.getByRole("status").filter({ hasText: /^Ligne/ });
      await expect(status).toContainText("Ligne 11, col. 5");
      await expect(status).toContainText(/mesure \d+/);
    });

    test("Ctrl+Espace propose ce qui peut s'écrire là ; un choix s'écrit", async ({ page }) => {
      await openApp(page, { root, source: TECHNIQUES });
      await page.locator(".cm-line").nth(8).click();
      await page.keyboard.press("Home");
      for (let step = 0; step < 4; step++) await page.keyboard.press("ArrowRight");
      const line = page.locator(".cm-line").nth(8);
      await expect(line).toHaveText(/^3  \|5    \|/);
      await page.keyboard.press("Control+Space");
      // sur le 5 d'une guitare : ses techniques, la première d'abord (le glissé)
      const choices = page.getByRole("listbox").getByRole("option");
      await expect(choices.first()).toContainText("5/");
      await choices.first().click();
      await expect(page.getByRole("listbox")).toHaveCount(0);
      await expect(line).toHaveText(/^3  \|5\/   \|/);
    });
  });
