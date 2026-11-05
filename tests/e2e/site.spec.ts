/** Le site qui présente Prisma : la navigation entre les pages et dans une page. */
import { expect, test } from "@playwright/test";
import { DESKTOP, PHONE, settle } from "../support/app.ts";

test.describe("le site", () => {
  test("sur un téléphone, les pages se choisissent sous le bouton du haut, qu'un clic ailleurs referme", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/apprendre.html");
    await settle(page);
    await page.getByRole("button", { name: "Pages du site" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.mouse.click(20, 600);
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.getByRole("button", { name: "Pages du site" }).click();
    await page.getByRole("menuitem", { name: "Prisma et la partition classique" }).click();
    await expect(page).toHaveURL(/comparaison\.html$/);
  });

  test("« Sur cette page » mène à une partie de la page", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/index.html");
    await settle(page);
    await page.locator("#temps").evaluate((element) => element.scrollIntoView({ behavior: "instant" }));
    await settle(page);
    await page.getByRole("button", { name: /^Sur cette page/ }).click();
    const parts = page.getByRole("menu");
    await expect(parts).toBeVisible();
    await parts.getByRole("menuitem", { name: "Le nombre, c'est la note" }).click();
    await settle(page);
    await expect(page.getByRole("heading", { name: "Le nombre, c'est la note" })).toBeInViewport();
  });

  test("plus bas sur la page, un bouton ramène aux parties de la page", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/guitare.html");
    await settle(page);
    const back = page.getByRole("button", { name: "Retour aux parties de la page" });
    await expect(back).toHaveCount(0);
    await page.mouse.wheel(0, 2400);
    await settle(page);
    await back.click();
    await settle(page);
    await expect(page.getByRole("navigation", { name: "Sur cette page" })).toBeInViewport();
    await expect(back).toHaveCount(0);
  });

  test("plus bas dans la référence, un bouton ramène en haut", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/reference.html");
    await settle(page);
    await page.mouse.wheel(0, 3000);
    await settle(page);
    const back = page.getByRole("button", { name: "Retour en haut de la référence" });
    await back.click();
    await settle(page);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await expect(back).toHaveCount(0);
  });

  test("la référence sur un téléphone : son sommaire mène à une partie", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/reference.html");
    await settle(page);
    await page.getByRole("button", { name: /^Sommaire/ }).click();
    await page.getByRole("menuitem", { name: /le temps/i }).first().click();
    await settle(page);
    await expect(page.locator('[id="3-le-temps"]')).toBeInViewport();
  });
});
