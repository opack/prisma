/** La barre des menus de l'application : à la souris, au clavier, et en un seul menu quand la place manque. */
import { expect, test } from "@playwright/test";
import { CLAIR_SECTIONS, PHONE, TABLET, openApp } from "../support/app.ts";

test.describe("la barre des menus", () => {
  test("un menu ouvert : le survol d'un autre titre l'ouvre à sa place, les flèches passent au voisin, Tab et un clic ailleurs le ferment", async ({
    page,
  }) => {
    await openApp(page, { source: CLAIR_SECTIONS });
    const opened = page.getByRole("menu");
    await page.getByRole("button", { name: "Fichier", exact: true }).click();
    await expect(opened).toHaveAttribute("aria-label", "Fichier");
    await page.getByRole("button", { name: "Affichage", exact: true }).hover();
    await expect(opened).toHaveAttribute("aria-label", "Affichage");
    await page.keyboard.press("ArrowRight");
    await expect(opened).toHaveAttribute("aria-label", "Aide");
    await page.keyboard.press("Tab");
    await expect(opened).toHaveCount(0);
    await page.getByRole("button", { name: "Partition", exact: true }).click();
    await expect(opened).toHaveAttribute("aria-label", "Partition");
    // Reka UI n'écoute les clics ailleurs qu'un instant après l'ouverture : on reclique tant qu'il n'a pas entendu
    await expect(async () => {
      await page.mouse.click(900, 600);
      await expect(opened).toHaveCount(0, { timeout: 500 });
    }).toPass();
  });

  test("au clavier : Entrée ouvre le menu, les flèches parcourent ses actions, Échap le ferme et rend le focus à son titre", async ({
    page,
  }) => {
    await openApp(page, { source: CLAIR_SECTIONS });
    const title = page.getByRole("button", { name: "Affichage", exact: true });
    await title.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toHaveAttribute("aria-label", "Affichage");
    await page.keyboard.press("ArrowDown");
    await expect(page.locator('[role^="menuitem"]:focus')).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(title).toBeFocused();
  });

  test("Tab passe des menus aux boutons de l'écoute", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS });
    await page.getByRole("button", { name: "Fichier", exact: true }).focus();
    for (let step = 0; step < 9; step++) await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Écouter" })).toBeFocused();
  });

  test("une action qui se coche le dit", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS });
    await page.getByRole("button", { name: "Affichage", exact: true }).click();
    await expect(page.getByRole("menuitemcheckbox", { name: /Ajuster à la hauteur/ })).toBeChecked();
    await expect(page.getByRole("menuitemcheckbox", { name: /Ajuster à la largeur/ })).not.toBeChecked();
  });

  test("sur une tablette, un seul menu : un titre montre ses actions, « Menu » revient aux titres", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS, editing: false, size: TABLET });
    await expect(page.getByRole("button", { name: "Fichier", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("menuitem", { name: /Fichier/ }).click();
    await expect(page.getByRole("menu")).toHaveAttribute("aria-label", "Fichier");
    await page.getByRole("menuitem", { name: "Menu", exact: true }).click();
    await expect(page.getByRole("menu")).toHaveAttribute("aria-label", "Menu");
    await page.getByRole("menuitem", { name: /Affichage/ }).click();
    await page.getByRole("menuitemcheckbox", { name: /Éditeur/ }).click();
    await expect(page.getByRole("textbox", { name: "Source .prisma" })).toBeVisible();
  });

  test("sur un téléphone, le menu porte le nom du morceau en tête", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS, editing: false, size: PHONE });
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(page.locator("p", { hasText: "morceau.prisma" })).toBeVisible();
  });
});
