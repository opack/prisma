/** La retouche : une case de la partition, double-cliquée, change sa note sans passer par le texte. */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { CLAIR_SECTIONS, SCALE, TECHNIQUES, openApp, retouchAt } from "../support/app.ts";

const card = (page: Page) => page.getByRole("dialog", { name: "Note de la case" });
const digits = (page: Page, digit: string) => page.locator(".page text", { hasText: new RegExp(`^${digit}$`) });

test.describe("la retouche", () => {
  test("une note choisie remplace celle de la case, dans la partition et dans le texte", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS, editing: false });
    const fives = await digits(page, "5").count();
    await retouchAt(page, /^5$/);
    await card(page).getByRole("button", { name: /^7/ }).first().click();
    await expect(digits(page, "5")).toHaveCount(fives - 1);
  });

  test("une case vide reçoit une note, puis propose sa durée", async ({ page }) => {
    await openApp(page, { source: SCALE, editing: false });
    // la case au-dessus du 10, sur la ligne +1, est vide
    const box = (await digits(page, "10").first().boundingBox())!;
    await page.mouse.dblclick(box.x + box.width / 2, box.y - box.height / 2);
    await expect(card(page)).toContainText("La note choisie");
    await card(page).getByRole("button", { name: /^5 / }).click();
    await expect(card(page)).toContainText("Durée");
  });

  test("Échap referme la carte sans rien changer", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS, editing: false });
    const fives = await digits(page, "5").count();
    await retouchAt(page, /^5$/);
    await expect(card(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card(page)).toHaveCount(0);
    await expect(digits(page, "5")).toHaveCount(fives);
  });

  test("sur un instrument à cordes, la carte propose les cordes", async ({ page }) => {
    await openApp(page, { source: TECHNIQUES, editing: false });
    await retouchAt(page, /^8$/);
    await expect(card(page).getByRole("group", { name: "Corde" })).toBeVisible();
  });
});
