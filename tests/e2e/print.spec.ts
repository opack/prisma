/** L'impression : la feuille ne montre que la partition, rien de ce qui sert à l'écran. */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { CLAIR_SECTIONS, TABLET, openApp } from "../support/app.ts";

/** Ce que le navigateur imprimerait : la page entière, vue en mode impression. */
async function printed(page: Page) {
  await page.emulateMedia({ media: "print" });
  const sheet = await page.screenshot({ fullPage: true });
  await page.emulateMedia({ media: "screen" });
  return sheet;
}

test.describe("l'impression", () => {
  test("ni le curseur de lecture, ni la section jouée, ni un panneau ouvert ne paraissent sur la feuille", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS });
    const clean = await printed(page);
    // un clic sur le second système y place le curseur de lecture (et entoure sa section dans l'ordre de jeu)
    const system = (await page.locator("rect.system-area").nth(1).boundingBox())!;
    await page.mouse.click(system.x + 60, system.y + system.height / 2);
    await page.getByRole("button", { name: "Battre" }).click();
    await expect(page.getByRole("dialog", { name: "Battre" })).toBeVisible();
    expect(await printed(page)).toEqual(clean);
  });

  // « Imprimer… » est dans un menu, encore ouvert quand le navigateur fige la page à imprimer
  test("le menu ouvert ne paraît pas sur la feuille", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS });
    await page.getByRole("button", { name: "Partition", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: /Imprimer/ })).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("menu")).toBeHidden();
  });

  test("le menu unique d'une tablette ne paraît pas non plus", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS, editing: false, size: TABLET });
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("menuitem", { name: /Partition/ }).click();
    await expect(page.getByRole("menuitem", { name: /Imprimer/ })).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("menu")).toBeHidden();
  });
});
