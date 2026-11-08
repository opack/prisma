/**
 * Le site qui présente Prisma : la navigation entre les pages et dans une page, et ses exemples.
 */
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
    await page
      .getByRole("menuitem", { name: /le temps/i })
      .first()
      .click();
    await settle(page);
    await expect(page.locator('[id="3-le-temps"]')).toBeInViewport();
  });

  test("un exemple montre son texte, que son bouton copie", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize(DESKTOP);
    await page.goto("/index.html");
    await settle(page);
    const example = page.getByRole("figure", { name: /La gamme de do/ });
    await example.getByRole("tab", { name: "Texte" }).click();
    await expect(example.getByRole("tab", { name: "Texte" })).toHaveAttribute("aria-selected", "true");
    await expect(example).toContainText("m1 |1  |2  |3  |4  ||");
    await example.getByRole("button", { name: "Copier le texte" }).click();
    await expect(example.getByRole("button", { name: "Copié" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("format: 1");
    await example.getByRole("tab", { name: "Partition" }).click();
    await expect(example.locator("svg.excerpt")).toBeVisible();
  });

  test("sur l'accueil, les réglages à essayer changent la partition", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/index.html");
    await settle(page);
    const settings = page.getByRole("group", { name: "Essayer trois réglages" });
    const score = page.getByRole("figure", { name: /avec les réglages choisis/ });
    const before = await score.locator("svg.excerpt").innerHTML();
    await settings.getByRole("button", { name: "Une ligne par note" }).click();
    await expect(settings.getByRole("button", { name: "Une ligne par note" })).toHaveAttribute("aria-pressed", "true");
    await expect(settings.getByRole("button", { name: "En haut" })).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => score.locator("svg.excerpt").innerHTML()).not.toBe(before);
  });
});
