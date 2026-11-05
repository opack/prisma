/** La bibliothèque : un dossier du disque, ou le dossier de l'app sur pCloud. */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { CLAIR_SECTIONS, GREENSLEEVES_CHORDS, GYMNOPEDIE_XML, TECHNIQUES, chooseMenu, connectPcloud, fakePcloud, openApp, provideFolder, settle } from "../support/app.ts";

const library = (page: Page) => page.locator("[data-library]");

/** Un dossier de quelques morceaux, dont un dans un sous-dossier et un MusicXML, choisi comme bibliothèque. */
async function openFolderLibrary(page: Page) {
  await provideFolder(page, "bibliotheque", [
    ["Au clair de la lune.prisma", CLAIR_SECTIONS],
    ["Techniques.prisma", TECHNIQUES],
    ["Guitare/Greensleeves.prisma", GREENSLEEVES_CHORDS],
    ["Satie/Gymnopedie 1.musicxml", GYMNOPEDIE_XML],
  ]);
  await openApp(page, { source: CLAIR_SECTIONS });
  await chooseMenu(page, "Fichier", "Bibliothèque");
  await page.getByRole("button", { name: "Choisir un dossier" }).click();
  await settle(page);
  await page.getByRole("button", { name: "En liste" }).click();
}

test.describe("la bibliothèque d'un dossier", () => {
  test("montre les morceaux qu'elle sait lire, sous-dossiers compris, par leur titre", async ({ page }) => {
    await openFolderLibrary(page);
    for (const title of ["Au clair de la lune", "Techniques", "Greensleeves", "Gymnopédie"]) await expect(library(page)).toContainText(title);
  });

  test("filtre par sorte de fichier, et cherche sans tenir compte des accents", async ({ page }) => {
    await openFolderLibrary(page);
    await page.getByRole("combobox", { name: "Afficher" }).selectOption({ label: "MusicXML à importer (1)" });
    await expect(library(page)).toContainText("Gymnopédie");
    await expect(library(page)).not.toContainText("Techniques");
    await page.getByRole("combobox", { name: "Afficher" }).selectOption({ index: 0 });
    await page.getByRole("searchbox", { name: "Chercher" }).fill("gymnopedie");
    await expect(library(page)).toContainText("Gymnopédie");
    await expect(library(page)).not.toContainText("Au clair de la lune");
  });

  test("un morceau choisi s'ouvre, et la bibliothèque se referme", async ({ page }) => {
    await openFolderLibrary(page);
    page.once("dialog", (confirm) => confirm.accept());
    await library(page).getByRole("button", { name: /Techniques/ }).click();
    await settle(page);
    await expect(library(page)).toHaveCount(0);
    await expect(page.getByRole("banner")).toContainText("Techniques.prisma");
  });

  test("Retour à la partition la referme sans rien ouvrir", async ({ page }) => {
    await openFolderLibrary(page);
    await page.getByRole("button", { name: "Retour à la partition" }).click();
    await expect(library(page)).toHaveCount(0);
    await expect(page.getByRole("banner")).toContainText("morceau.prisma");
  });
});

test.describe("la bibliothèque sur pCloud", () => {
  async function openPcloud(page: Page, files: Record<string, string>, options: { refused?: boolean } = {}) {
    await fakePcloud(page, files, options);
    await openApp(page, { source: CLAIR_SECTIONS });
    await connectPcloud(page);
    await chooseMenu(page, "Fichier", "Bibliothèque");
  }

  test("vide, elle dit comment y mettre ses partitions", async ({ page }) => {
    await openPcloud(page, {});
    await expect(library(page)).toContainText("Aucune partition pour l'instant");
  });

  test("une connexion refusée le dit, avec la raison", async ({ page }) => {
    await openPcloud(page, {}, { refused: true });
    await expect(library(page)).toContainText("code 2094");
  });

  test("un morceau s'ouvre de pCloud", async ({ page }) => {
    await openPcloud(page, { "Au clair de la lune.prisma": CLAIR_SECTIONS, "Techniques.prisma": TECHNIQUES });
    await page.getByRole("button", { name: "En liste" }).click();
    await expect(library(page)).toContainText("Au clair de la lune");
    page.once("dialog", (confirm) => confirm.accept());
    await library(page).getByRole("button", { name: /Techniques/ }).click();
    await settle(page);
    await expect(page.locator(".page").first()).toContainText("Guitare");
  });
});
