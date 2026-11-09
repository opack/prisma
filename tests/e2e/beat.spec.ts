/** La retouche d'un temps : un double-clic sur la règle de la partition le divise ou le referme. */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { SCALE, openApp } from "../support/app.ts";

const menu = (page: Page) => page.getByRole("menu", { name: "Découpage du temps" });
/** Le numéro d'un temps sur la règle de la partition (en italique, comme dans le texte). */
const beatLabel = (page: Page, label: string) =>
  page.locator('.page text[font-style="italic"]', { hasText: new RegExp(`^${label}$`) }).first();
/** Les graduations de la règle : les astérisques des premiers découpages, les points des seconds. */
const stars = (page: Page) => page.locator(".page path[stroke-linecap='round']");

async function openBeat(page: Page, label: string) {
  // la zone cliquable du système couvre la règle : on double-clique à la place du numéro
  const box = (await beatLabel(page, label).boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await expect(menu(page)).toBeVisible();
}

test.describe("la retouche d'un temps", () => {
  test("divise un temps en 2, puis le referme", async ({ page }) => {
    await openApp(page, { source: SCALE, editing: false });
    const before = await stars(page).count();
    await openBeat(page, "2");
    await expect(menu(page).getByRole("menuitem")).toHaveText(["Diviser en 2", "Diviser en 3"]);
    await menu(page).getByRole("menuitem", { name: "Diviser en 2" }).click();
    await expect(stars(page)).toHaveCount(before + 1);

    await openBeat(page, "2");
    await expect(menu(page).getByRole("menuitem")).toHaveText(["Diviser en 2", "Refermer"]);
    await menu(page).getByRole("menuitem", { name: "Refermer" }).click();
    await expect(stars(page)).toHaveCount(before);
  });

  test("ne referme pas un temps quand une note commence sur la case refermée", async ({ page }) => {
    await openApp(page, { source: "---\nformat: 1\n---\n\nm1 |1  *  |2  ||\n0  |1  3  |5  ||\n", editing: false });
    await openBeat(page, "1");
    const close = menu(page).getByRole("menuitem", { name: /^Refermer/ });
    await expect(close).toHaveAttribute("aria-disabled", "true");
    await expect(close).toContainText("une note commence ou s'arrête");
  });

  test("Échap referme le menu sans rien changer", async ({ page }) => {
    await openApp(page, { source: SCALE, editing: false });
    const before = await stars(page).count();
    await openBeat(page, "3");
    await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveCount(0);
    await expect(stars(page)).toHaveCount(before);
  });

  test("avec la règle détaillée, une case ajoutée reçoit une note", async ({ page }) => {
    await openApp(page, { source: SCALE, editing: false, options: { rulerDetail: "division" } });
    const notes = page.locator(".page text", { hasText: /^7$/ });
    await expect(notes).toHaveCount(0);
    // la case ajoutée après le 1 de la mesure 1 : sous l'astérisque de la règle, sur la ligne du 1 (couloir 0)
    const star = (await stars(page).first().boundingBox())!;
    const one = (await page.locator(".page text:not([font-style])", { hasText: /^1$/ }).last().boundingBox())!;
    await page.mouse.dblclick(star.x + star.width / 2 + 1, one.y + one.height / 2);
    const card = page.getByRole("dialog", { name: "Note de la case" });
    await card.getByRole("button", { name: /^7/ }).first().click();
    await expect(notes).toHaveCount(1);
  });
});
