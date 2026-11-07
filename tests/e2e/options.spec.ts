/** Les options : générales, ou propres à la partition ouverte. */
import { expect, test } from "@playwright/test";
import { APPS, CLAIR_SECTIONS, chooseMenu, openApp, settle } from "../support/app.ts";

const drawer = (page: import("@playwright/test").Page) => page.getByRole("complementary", { name: "Options" });

for (const { name, root } of APPS)
  test.describe(`les options (${name})`, () => {
    test("le bouton les ouvre et les ferme ; Échap et la croix les ferment aussi", async ({ page }) => {
      await openApp(page, { root, source: CLAIR_SECTIONS });
      const button = page.getByRole("button", { name: "Options", exact: true });
      await button.click();
      await expect(drawer(page)).toBeVisible();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await page.keyboard.press("Escape");
      await expect(drawer(page)).toHaveCount(0);
      await chooseMenu(page, "Partition", "Options");
      await expect(drawer(page)).toBeVisible();
      await page.getByRole("button", { name: "Fermer les options" }).click();
      await expect(drawer(page)).toHaveCount(0);
    });

    test("un réglage changé s'applique et tient au rechargement, avec son explication", async ({ page }) => {
      await openApp(page, { root, source: CLAIR_SECTIONS });
      await page.getByRole("button", { name: "Options", exact: true }).click();
      const sections = drawer(page).getByRole("combobox", { name: "Sections" });
      await sections.selectOption({ label: "À la suite" });
      await expect(drawer(page)).not.toContainText("chaque section commence une nouvelle ligne");
      await page.reload();
      await settle(page);
      await page.getByRole("button", { name: "Options", exact: true }).click();
      await expect(drawer(page).getByRole("combobox", { name: "Sections" })).toHaveValue("inline");
    });

    test("les onglets rangent les réglages", async ({ page }) => {
      await openApp(page, { root, source: CLAIR_SECTIONS });
      await page.getByRole("button", { name: "Options", exact: true }).click();
      await drawer(page).getByRole("tab", { name: "Métronome" }).click();
      await expect(drawer(page).getByRole("tab", { name: "Métronome" })).toHaveAttribute("aria-selected", "true");
      await expect(drawer(page).getByRole("checkbox", { name: /Une mesure avant de jouer/ })).toBeVisible();
    });

    test("côté partition, une option se définit pour elle seule, puis se retire", async ({ page }) => {
      await openApp(page, { root, source: CLAIR_SECTIONS });
      await page.getByRole("button", { name: "Options", exact: true }).click();
      await drawer(page)
        .getByRole("radio", { name: /^Partition/ })
        .click();
      await expect(drawer(page).getByRole("tab", { name: "Édition" })).toHaveCount(0);
      const define = drawer(page).getByRole("button", { name: "Définir pour la partition", exact: true });
      const remove = drawer(page).getByRole("button", { name: "Retirer", exact: true });
      const before = await define.count();
      await expect(remove).toHaveCount(0);
      await define.first().click();
      await expect(define).toHaveCount(before - 1);
      await expect(remove).toHaveCount(1);
      await remove.click();
      await expect(define).toHaveCount(before);
    });

    test("côté partition, tout se définit puis se retire d'un coup", async ({ page }) => {
      await openApp(page, { root, source: CLAIR_SECTIONS });
      await page.getByRole("button", { name: "Options", exact: true }).click();
      await drawer(page)
        .getByRole("radio", { name: /^Partition/ })
        .click();
      const define = drawer(page).getByRole("button", { name: "Définir pour la partition", exact: true });
      await drawer(page).getByRole("button", { name: "Tout définir pour la partition" }).click();
      await expect(define).toHaveCount(0);
      await drawer(page).getByRole("button", { name: "Tout retirer" }).click();
      await expect(define).not.toHaveCount(0);
      await expect(drawer(page).getByRole("button", { name: "Tout retirer" })).toHaveCount(0);
    });
  });
