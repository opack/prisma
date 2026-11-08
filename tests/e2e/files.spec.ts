/** Le morceau ouvert : en commencer un, l'exporter, en recevoir un par un lien, en déposer un. */
import { expect, test } from "@playwright/test";
import {
  CLAIR_SECTIONS,
  TECHNIQUES,
  chooseMenu,
  dropFiles,
  openApp,
  provideFolder,
  listProvided,
  provideSaveTarget,
  readProvided,
  receiveShared,
  settle,
  shareLinkFor,
} from "../support/app.ts";

const firstPage = (page: import("@playwright/test").Page) => page.locator(".page").first();

test.describe("le morceau", () => {
  test("Fichier › Nouveau… commence un morceau d'après le modèle choisi", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS });
    // le morceau en cours, jamais enregistré : on confirme de le remplacer
    page.on("dialog", (dialog) => dialog.accept());
    await chooseMenu(page, "Fichier", "Nouveau…");
    const dialog = page.getByRole("dialog", { name: "Nouveau morceau" });
    await dialog.getByRole("radio", { name: /^Guitare/ }).check();
    await dialog.getByRole("button", { name: "Créer" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".cm-content")).not.toContainText("Au clair de la lune");
    await expect(page.locator(".cm-content")).toContainText(/Guitar/i);
  });

  test("Fichier › Exporter en MusicXML… écrit le morceau en MusicXML", async ({ page }) => {
    await provideSaveTarget(page, "exports");
    await openApp(page, { source: CLAIR_SECTIONS });
    await chooseMenu(page, "Fichier", "Exporter en MusicXML…");
    await page.getByRole("dialog", { name: "Exporter en MusicXML" }).getByRole("button", { name: "Exporter" }).click();
    await settle(page);
    expect(await listProvided(page, "exports")).toEqual(["morceau.musicxml"]);
    expect(await readProvided(page, "exports", "morceau.musicxml")).toContain("<work-title>Au clair de la lune</work-title>");
  });

  test("Ctrl+S enregistre le morceau, puis le réécrit en place", async ({ page }) => {
    await provideSaveTarget(page, "enregistres");
    await openApp(page, { source: CLAIR_SECTIONS, options: { autoEngrave: true } });
    const banner = page.getByRole("banner");
    await expect(banner).toContainText("non enregistré");
    await page.keyboard.press("Control+s");
    await settle(page);
    await expect(banner).not.toContainText("non enregistré");
    expect(await listProvided(page, "enregistres")).toEqual(["morceau.prisma"]);
    expect(await readProvided(page, "enregistres", "morceau.prisma")).toContain("title: Au clair de la lune");
    await page.locator(".cm-line", { hasText: "title:" }).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" (bis)");
    await page.keyboard.press("Control+s");
    await settle(page);
    expect(await readProvided(page, "enregistres", "morceau.prisma")).toContain("title: Au clair de la lune (bis)");
    expect(await listProvided(page, "enregistres")).toEqual(["morceau.prisma"]);
  });

  test("un morceau reçu par un lien : son titre ; ouvert, il remplace le morceau en cours", async ({ page }) => {
    await openApp(page, { source: TECHNIQUES, editing: false });
    await receiveShared(page, CLAIR_SECTIONS);
    const dialog = page.getByRole("dialog", { name: "Partition reçue" });
    await expect(dialog).toContainText("Au clair de la lune");
    page.once("dialog", (confirm) => confirm.accept());
    await dialog.getByRole("button", { name: "Ouvrir", exact: true }).click();
    await settle(page);
    await expect(firstPage(page)).toContainText("Au clair de la lune");
  });

  test("Fichier › Importer un lien… : un lien coupé le dit, le bon montre la partition reçue", async ({ page }) => {
    await openApp(page, { source: TECHNIQUES, editing: false });
    const link = await shareLinkFor(page, CLAIR_SECTIONS);
    await chooseMenu(page, "Fichier", "Importer un lien…");
    await page.keyboard.type(link.slice(0, link.length - 12));
    await page.getByRole("button", { name: "Importer", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("ne se lit pas");
    await page.getByRole("textbox", { name: "Lien", exact: true }).fill(link);
    await page.getByRole("button", { name: "Importer", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Partition reçue" })).toContainText("Au clair de la lune");
  });

  test("reçu avec une bibliothèque : il s'y enregistre avec ses réglages, puis s'ouvre", async ({ page }) => {
    await provideFolder(page, "recus");
    await openApp(page, { source: "", editing: false });
    await chooseMenu(page, "Fichier", "Bibliothèque");
    await page.getByRole("button", { name: "Choisir un dossier" }).click();
    await settle(page);
    await receiveShared(page, CLAIR_SECTIONS, { tempo: 72 });
    const dialog = page.getByRole("dialog", { name: "Partition reçue" });
    await expect(dialog).toContainText("Dossier « recus »");
    await dialog.getByRole("button", { name: "Enregistrer dans la bibliothèque" }).click();
    await settle(page);
    expect(await readProvided(page, "recus", "Au clair de la lune.prisma")).toContain("title: Au clair de la lune");
    expect(JSON.parse(await readProvided(page, "recus", "Au clair de la lune.prisma.json")).tempo).toBe(72);
    await expect(page.getByRole("spinbutton", { name: "Tempo de l'écoute" })).toHaveValue("72");
  });

  test("un fichier .prisma déposé sur la fenêtre s'ouvre", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS, editing: false });
    page.once("dialog", (confirm) => confirm.accept());
    await dropFiles(page, [["Techniques.prisma", TECHNIQUES]]);
    await settle(page);
    await expect(page.getByRole("banner")).toContainText("Techniques.prisma");
    await expect(firstPage(page)).toContainText("Guitare");
  });

  test("un fichier qui ne s'ouvre pas : la barre le dit", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS });
    await dropFiles(page, [["photo.png", "x"]]);
    await expect(page.getByRole("banner")).toContainText("photo.png");
  });

  test("les notes du morceau se lisent sous un bouton, à côté de son nom", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS.replace("bpm: 100", "bpm: 100\nnotes: À jouer lentement"), editing: false });
    await page.getByRole("button", { name: "Notes du morceau" }).click();
    await expect(page.getByRole("dialog", { name: "Notes du morceau" })).toContainText("À jouer lentement");
  });
});
