/** L'application : la lecture et l'édition, la mise en page, la vue de la partition. */
import { expect, test } from "@playwright/test";
import { APPS, CLAIR_SECTIONS, GYMNOPEDIE, chooseMenu, openApp, settle } from "../support/app.ts";

const scorePane = (page: import("@playwright/test").Page) => page.locator("section[data-fit]");

for (const { name, root } of APPS)
  test.describe(`lecture et édition (${name})`, () => {
    test("en lecture, la partition seule ; l'éditeur s'ouvre et se ferme, et le choix tient au rechargement", async ({ page }) => {
      await openApp(page, { root, source: CLAIR_SECTIONS, editing: false });
      const editor = page.getByRole("textbox", { name: "Source .prisma" });
      await expect(page.getByRole("region", { name: "Partition" })).toBeVisible();
      await expect(editor).toBeHidden();
      await page.getByRole("button", { name: "Éditeur", exact: true }).click();
      await expect(editor).toBeVisible();
      await expect(page.getByRole("region", { name: "Aperçu" })).toBeVisible();
      await page.reload();
      await settle(page);
      await expect(editor).toBeVisible();
      await page.keyboard.press("Control+e");
      await expect(editor).toBeHidden();
      await chooseMenu(page, "Affichage", "Éditeur");
      await expect(editor).toBeVisible();
    });

    test("un texte qui ne se lit pas s'ouvre en édition, avec son erreur", async ({ page }) => {
      await openApp(page, { root, source: CLAIR_SECTIONS.replace("|1  |1  |1  |3  ||", "|1  |1  |13 |3  ||"), editing: false });
      await expect(page.getByRole("textbox", { name: "Source .prisma" })).toBeVisible();
      await expect(page.getByTitle("aller à l'erreur")).toContainText(/13/);
    });
  });

for (const { name, root } of APPS)
  test.describe(`mise en page (${name})`, () => {
    test("le bouton ne sert que si le texte a changé depuis la dernière mise en page", async ({ page }) => {
      await openApp(page, { root, source: CLAIR_SECTIONS, options: { autoEngrave: false } });
      const engrave = page.getByRole("button", { name: "Mettre en page", exact: true });
      await expect(engrave).toBeDisabled();
      await page.locator(".cm-line", { hasText: "title:" }).click();
      await page.keyboard.press("End");
      await page.keyboard.type(" (bis)");
      await expect(engrave).toBeEnabled();
      await expect(page.locator(".page").first()).not.toContainText("(bis)");
      await engrave.click();
      await expect(page.locator(".page").first()).toContainText("(bis)");
      await expect(engrave).toBeDisabled();
    });

    test("en automatique, la partition suit la frappe", async ({ page }) => {
      await openApp(page, { root, source: CLAIR_SECTIONS, options: { autoEngrave: true } });
      await page.locator(".cm-line", { hasText: "title:" }).click();
      await page.keyboard.press("End");
      await page.keyboard.type(" (ter)");
      await expect(page.locator(".page").first()).toContainText("(ter)");
    });

    test("Ctrl+Entrée met en page", async ({ page }) => {
      await openApp(page, { root, source: CLAIR_SECTIONS, options: { autoEngrave: false } });
      await page.locator(".cm-line", { hasText: "title:" }).click();
      await page.keyboard.press("End");
      await page.keyboard.type(" (quater)");
      await page.keyboard.press("Control+Enter");
      await expect(page.locator(".page").first()).toContainText("(quater)");
    });
  });

for (const { name, root } of APPS)
  test.describe(`les erreurs (${name})`, () => {
    const twoErrors = CLAIR_SECTIONS.replace("|1  |1  |1  |3  ||", "|1  |1  |13 |3  ||").replace(
      "|3  |3  |3  |3  ||",
      "|3  |3  |33 |3  ||",
    );

    test("la barre montre une erreur à la fois, et passe à la suivante", async ({ page }) => {
      await openApp(page, { root, source: twoErrors });
      const message = page.getByTitle("aller à l'erreur");
      await expect(message).toContainText("13");
      await page.getByRole("button", { name: "Erreur suivante" }).click();
      await expect(message).toContainText("33");
      await page.getByRole("button", { name: "Erreur précédente" }).click();
      await expect(message).toContainText("13");
    });

    test("le message mène à l'erreur ; corrigée, la barre disparaît", async ({ page }) => {
      await openApp(page, {
        root,
        source: CLAIR_SECTIONS.replace("|1  |1  |1  |3  ||", "|1  |1  |13 |3  ||"),
        options: { autoEngrave: true },
      });
      await page.getByTitle("aller à l'erreur").click();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Delete");
      await page.keyboard.type(" ");
      await expect(page.getByTitle("aller à l'erreur")).toHaveCount(0);
    });
  });

for (const { name, root } of APPS)
  test.describe(`la vue de la partition (${name})`, () => {
    test("le zoom agrandit la partition, et Taille normale y revient", async ({ page }) => {
      await openApp(page, { root, source: GYMNOPEDIE, editing: false });
      const zoom = () => scorePane(page).evaluate((element) => getComputedStyle(element).getPropertyValue("--zoom"));
      expect(await zoom()).toBe("1");
      await chooseMenu(page, "Affichage", "Zoom avant");
      expect(Number(await zoom())).toBeGreaterThan(1);
      await chooseMenu(page, "Affichage", "Taille normale");
      expect(await zoom()).toBe("1");
    });

    test("les pages s'ajustent à la hauteur ou à la largeur, et le choix tient au rechargement", async ({ page }) => {
      await openApp(page, { root, source: GYMNOPEDIE, editing: false });
      await expect(scorePane(page)).toHaveAttribute("data-fit", "height");
      await chooseMenu(page, "Affichage", "Ajuster à la largeur");
      await expect(scorePane(page)).toHaveAttribute("data-fit", "width");
      await page.reload();
      await settle(page);
      await expect(scorePane(page)).toHaveAttribute("data-fit", "width");
    });

    test("la lecture focalisée montre deux systèmes", async ({ page }) => {
      test.skip(name === "Vue", "la lecture focalisée n'est pas encore passée à Vue");
      await openApp(page, { root, source: GYMNOPEDIE, editing: false });
      await chooseMenu(page, "Affichage", "Lecture focalisée");
      await expect(scorePane(page)).toHaveAttribute("data-fit", "focus");
      await expect(page.locator("div.animate-focus-in > svg")).toHaveCount(2);
    });

    for (const [fit, zoom, direction] of [
      ["height", 2, "scrollLeft"],
      ["width", 1, "scrollTop"],
    ] as const)
      test(`la première page sortie de l'écran, un bouton ramène au début (${fit === "height" ? "de côté" : "de haut en bas"})`, async ({
        page,
      }) => {
        test.skip(name === "Vue", "le retour au début n'est pas encore passé à Vue");
        await openApp(page, { root, source: GYMNOPEDIE, editing: false, view: { fit, zoom } });
        const back = page.getByRole("button", { name: "Retour au début de la partition" });
        await expect(back).toHaveCount(0);
        await scorePane(page).evaluate((element) => element.scrollTo({ left: element.scrollWidth, top: element.scrollHeight }));
        await back.click();
        await settle(page);
        await expect(scorePane(page)).toHaveJSProperty(direction, 0);
        await expect(back).toHaveCount(0);
      });

    test("Affichage › Piste de lecture la masque, et le choix tient au rechargement", async ({ page }) => {
      test.skip(name === "Vue", "la piste de lecture n'est pas encore passée à Vue");
      await openApp(page, { root, source: CLAIR_SECTIONS, editing: false });
      const track = page.getByRole("slider", { name: "Position dans le morceau" });
      await expect(track).toBeVisible();
      await chooseMenu(page, "Affichage", "Piste de lecture");
      await expect(track).toHaveCount(0);
      await page.reload();
      await settle(page);
      await expect(track).toHaveCount(0);
      await chooseMenu(page, "Affichage", "Piste de lecture");
      await expect(track).toBeVisible();
    });
  });
