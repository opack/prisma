/** À propos : la version et les nouveautés, ouvertes d'elles-mêmes une fois après une mise à jour. */
import { expect, test } from "@playwright/test";
import { CLAIR_SECTIONS, PHONE, chooseMenu, openApp, settle } from "../support/app.ts";

test.describe("à propos", () => {
  test("Aide › À propos… dit la version et les nouveautés", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS });
    await chooseMenu(page, "Aide", "À propos…");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Version");
    await expect(dialog.getByLabel("Nouveautés")).toBeVisible();
  });

  test("sur un téléphone, il s'ouvre du menu unique", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS, size: PHONE });
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("menuitem", { name: /Aide/ }).click();
    await page.getByRole("menuitem", { name: "À propos…" }).click();
    await expect(page.getByRole("dialog")).toContainText("Version");
  });

  test("rien à la première visite ; après une mise à jour, les nouveautés s'ouvrent une fois", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.evaluate(() => localStorage.setItem("prisma:version", "0.0.1"));
    await page.reload();
    await settle(page);
    await expect(page.getByRole("dialog")).toContainText("À propos de Prisma");
    await page.getByRole("button", { name: "Fermer" }).click();
    await page.reload();
    await settle(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
