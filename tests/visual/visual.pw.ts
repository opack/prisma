/**
 * Les scènes du banc de captures (voir playwright.config.ts) : chaque page du site, au bureau et
 * sur un téléphone ; les écrans et panneaux de l'application ; la gravure d'un petit corpus, à
 * plusieurs réglages et à l'impression. Chaque scène part d'un état connu : le texte, les options
 * et la vue sont posés avant le chargement.
 */
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { importMusicXml, writePrisma } from "../../src/core/index.ts";
import { CLAIR_SECTIONS, GREENSLEEVES_CHORDS, SCALE, TECHNIQUES } from "../../src/site/examples/pieces.ts";

const GYMNOPEDIE = writePrisma(importMusicXml(readFileSync(new URL("../fixtures/gymnopedie1.musicxml", import.meta.url), "utf8")));
const DESKTOP = { width: 1300, height: 850 };
const PHONE = { width: 390, height: 844 };
const TABLET = { width: 820, height: 1180 };

type State = { source: string; editing?: boolean; options?: Record<string, unknown>; view?: Record<string, unknown>; size?: { width: number; height: number } };

/** L'application, dans un état connu : son texte, l'éditeur ouvert ou non, ses options, sa vue, la taille de l'écran. */
async function openApp(page: Page, { source, editing = true, options, view, size = DESKTOP }: State) {
  await page.setViewportSize(size);
  await page.addInitScript(
    ([s, e, o, v]) => {
      if (sessionStorage.getItem("visual")) return;
      sessionStorage.setItem("visual", "1");
      localStorage.clear();
      localStorage.setItem("prisma:source", s);
      localStorage.setItem("prisma:editing", e);
      if (o) localStorage.setItem("prisma:options", o);
      if (v) localStorage.setItem("prisma:view", v);
    },
    [source, String(editing), options ? JSON.stringify(options) : "", view ? JSON.stringify(view) : ""] as const,
  );
  await page.goto("/app/");
  await settle(page);
}

/** Les polices chargées, la gravure faite, plus rien ne bouge. */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
}

const menu = async (page: Page, name: string, item: string) => {
  await page.getByRole("button", { name, exact: true }).click();
  await page.getByText(item, { exact: true }).click();
  await settle(page);
};

// le site : chaque page, entière, au bureau et sur un téléphone
for (const [name, size] of [["bureau", DESKTOP], ["telephone", PHONE]] as const)
  for (const pagePath of ["index", "apprendre", "reference", "guitare", "comparaison"])
    test(`site ${pagePath} ${name}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`/${pagePath}.html`);
      await settle(page);
      await expect(page).toHaveScreenshot(`site-${pagePath}-${name}.png`, { fullPage: true });
    });

// sur un téléphone, les pages du site sous le bouton du haut
test("site menu telephone", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/apprendre.html");
  await settle(page);
  await page.getByRole("button", { name: "Pages du site" }).click();
  await expect(page).toHaveScreenshot("site-menu-telephone.png");
  // un clic ailleurs le ferme
  await page.mouse.click(20, 600);
  await expect(page.getByRole("menu")).toHaveCount(0);
});

// l'accueil, plus bas que son haut : ses parties sous le bouton fixé en haut, et le retour en haut
for (const [name, size] of [["bureau", DESKTOP], ["telephone", PHONE]] as const)
  test(`site parties ${name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/index.html");
    await settle(page);
    await page.locator("#temps").evaluate((el) => el.scrollIntoView({ behavior: "instant" }));
    await settle(page);
    await page.getByRole("button", { name: /^Sur cette page/ }).click();
    await expect(page).toHaveScreenshot(`site-parties-${name}.png`);
  });

// la référence sur un téléphone : son sommaire, sous le bouton collé en haut, ouvert plus bas dans la page
test("site sommaire telephone", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/reference.html");
  await settle(page);
  await page.locator("[id=\"3-le-temps\"]").evaluate((h) => h.scrollIntoView({ behavior: "instant" }));
  await settle(page);
  await page.getByRole("button", { name: /^Sommaire/ }).click();
  await expect(page).toHaveScreenshot("site-sommaire-telephone.png");
});

// le clavier de l'accueil, une touche noire puis une blanche survolées : la même dans les deux octaves
for (const n of ["2", "5"])
  test(`site clavier ${n}`, async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/index.html");
    await settle(page);
    const keyboard = page.getByRole("img", { name: /Deux octaves du clavier/ });
    await keyboard.locator("text", { hasText: new RegExp(`^${n}$`) }).first().locator("..").hover();
    await expect(keyboard).toHaveScreenshot(`site-clavier-${n}.png`);
  });

// plus bas sur la page, le bouton qui ramène à « Sur cette page »
test("site retour aux parties", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/guitare.html");
  await settle(page);
  await page.mouse.wheel(0, 2400);
  await settle(page);
  await expect(page.getByRole("button", { name: "Retour aux parties de la page" })).toHaveScreenshot("site-retour.png");
  await page.getByRole("button", { name: "Retour aux parties de la page" }).click();
  await settle(page);
  await expect(page.getByRole("navigation", { name: "Sur cette page" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Retour aux parties de la page" })).toHaveCount(0);
});

// la référence, plus bas : le bouton qui ramène en haut
test("site retour en haut de la référence", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/reference.html");
  await settle(page);
  await page.mouse.wheel(0, 3000);
  await settle(page);
  const back = page.getByRole("button", { name: "Retour en haut de la référence" });
  await expect(back).toHaveScreenshot("site-retour-reference.png");
  await back.click();
  await settle(page);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(back).toHaveCount(0);
});

// l'application : ses écrans et ses panneaux
test("app éditeur et partition", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS });
  await expect(page).toHaveScreenshot("app-editeur.png");
});

test("app lecture", async ({ page }) => {
  await openApp(page, { source: GYMNOPEDIE, editing: false });
  await expect(page).toHaveScreenshot("app-lecture.png");
});

test("app options", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS });
  await menu(page, "Partition", "Options");
  await expect(page).toHaveScreenshot("app-options.png");
});

test("app options de la partition", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS });
  await menu(page, "Partition", "Options");
  await page.getByRole("radio", { name: /^Partition/ }).click();
  await page.getByRole("button", { name: "Définir pour la partition" }).first().click();
  await settle(page);
  await expect(page).toHaveScreenshot("app-options-partition.png");
});

test("app options métronome", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS });
  await menu(page, "Partition", "Options");
  await page.getByRole("tab", { name: "Métronome" }).click();
  await settle(page);
  await expect(page).toHaveScreenshot("app-options-metronome.png");
});

// l'application sur un écran étroit : l'éditeur ou la partition, un seul menu ; sur un téléphone,
// l'écoute sur sa propre ligne
for (const [name, size] of [["telephone", PHONE], ["tablette", TABLET]] as const)
  for (const editing of [false, true])
    test(`app ${name} ${editing ? "edition" : "lecture"}`, async ({ page }) => {
      await openApp(page, { source: CLAIR_SECTIONS, editing, size });
      await expect(page).toHaveScreenshot(`app-${name}-${editing ? "edition" : "lecture"}.png`);
    });

test("app telephone menu", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS, editing: false, size: PHONE });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("menuitem", { name: /Partition/ }).click();
  await settle(page);
  await expect(page).toHaveScreenshot("app-telephone-menu.png");
});

// une tablette : un seul bouton « Menu » ; un titre choisi montre ses actions à la place des titres,
// « ‹ Menu » y revient
test("app tablette menu", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS, editing: false, size: TABLET });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("menuitem", { name: /Fichier/ }).click();
  await page.getByRole("menuitem", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("menu")).toHaveAttribute("aria-label", "Menu");
  await page.getByRole("menuitem", { name: /Affichage/ }).click();
  await settle(page);
  await expect(page).toHaveScreenshot("app-tablette-menu.png");
});

// au doigt, deux touchers sur une case ouvrent sa retouche
test.describe("au doigt", () => {
  test.use({ hasTouch: true });
  test("app telephone retouche", async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS, editing: false, size: PHONE });
    const box = (await page.locator(".page text", { hasText: /^5$/ }).first().boundingBox())!;
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    await page.touchscreen.tap(x, y);
    await page.touchscreen.tap(x, y);
    await settle(page);
    await expect(page).toHaveScreenshot("app-telephone-retouche.png");
  });
});

// une case vide : la note choisie, le choix reste ouvert sur elle, avec son doigté, sa trille, sa durée
// un morceau reçu par un lien : son titre, son compositeur, ses notes ; à ouvrir, ou à enregistrer dans la bibliothèque
test("app partition reçue", async ({ page }) => {
  const text = CLAIR_SECTIONS.replace("bpm: 100", "bpm: 100\nnotes: À jouer lentement, la main droite seule d'abord");
  await openApp(page, { source: TECHNIQUES, editing: false });
  // le lien, écrit par l'application elle-même (le serveur de développement sert ses modules)
  await page.evaluate(async (t) => {
    const module = "/src/app/files/share.ts";
    const { encodeShare } = await import(/* @vite-ignore */ module);
    location.hash = `p=${await encodeShare({ name: "Au clair de la lune.prisma", text: t, settings: {} })}`;
  }, text);
  await expect(page.getByRole("dialog")).toContainText("Partition reçue");
  await settle(page);
  await expect(page).toHaveScreenshot("app-partition-recue.png");
  // le morceau en cours, jamais enregistré : on confirme de le remplacer
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Ouvrir", exact: true }).click();
  await settle(page);
  await expect(page.locator(".page").first()).toContainText("Au clair de la lune");
});

// Fichier › Importer un lien : un lien collé qui ne se lit pas le dit ; le bon montre la partition reçue
test("app importer un lien", async ({ page }) => {
  await openApp(page, { source: TECHNIQUES, editing: false });
  const link = await page.evaluate(async (t) => {
    const module = "/src/app/files/share.ts";
    const { encodeShare, shareLink } = await import(/* @vite-ignore */ module);
    return shareLink(await encodeShare({ name: "Au clair de la lune.prisma", text: t, settings: {} }), location.href);
  }, CLAIR_SECTIONS);
  await menu(page, "Fichier", "Importer un lien…");
  // le champ a le focus : on colle aussitôt
  await page.keyboard.type(link.slice(0, link.length - 12));
  await page.getByRole("button", { name: "Importer", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("ne se lit pas");
  await settle(page);
  await expect(page).toHaveScreenshot("app-importer-lien.png");
  await page.getByRole("textbox", { name: "Lien", exact: true }).fill(link);
  await page.getByRole("button", { name: "Importer", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Partition reçue");
  await expect(page.getByRole("dialog")).toContainText("Au clair de la lune");
});

// reçu avec une bibliothèque choisie : il s'y enregistre, puis s'ouvre, ses réglages à côté de lui
test("app partition reçue, avec une bibliothèque", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle("recus", { create: true });
  });
  await openApp(page, { source: "", editing: false });
  await menu(page, "Fichier", "Bibliothèque");
  await page.getByRole("button", { name: "Choisir un dossier" }).click();
  await page.evaluate(async (t) => {
    const module = "/src/app/files/share.ts";
    const { encodeShare } = await import(/* @vite-ignore */ module);
    location.hash = `p=${await encodeShare({ name: "Au clair de la lune.prisma", text: t, settings: { tempo: 72 } })}`;
  }, CLAIR_SECTIONS);
  await expect(page.getByRole("dialog")).toContainText("Dossier « recus »");
  await settle(page);
  await expect(page).toHaveScreenshot("app-partition-recue-bibliotheque.png");
  await page.getByRole("button", { name: "Enregistrer dans la bibliothèque" }).click();
  await settle(page);
  const saved = await page.evaluate(async () => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle("recus");
    const read = async (n: string) => (await (await dir.getFileHandle(n)).getFile()).text();
    return { piece: await read("Au clair de la lune.prisma"), settings: JSON.parse(await read("Au clair de la lune.prisma.json")) };
  });
  expect(saved.piece).toContain("title: Au clair de la lune");
  expect(saved.settings.tempo).toBe(72);
  await expect(page.getByRole("spinbutton", { name: "Tempo de l'écoute" })).toHaveValue("72");
  await expect(page.locator("[data-library]")).toHaveCount(0);
});

// les notes du morceau (notes:), jamais imprimées : sous un bouton, à côté de son nom
test("app notes du morceau", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS.replace("bpm: 100", "bpm: 100\nnotes: À jouer lentement, la main droite seule d'abord"), editing: false });
  await page.getByRole("button", { name: "Notes du morceau" }).click();
  await settle(page);
  await expect(page).toHaveScreenshot("app-notes.png");
});

test("app retouche case vide", async ({ page }) => {
  await openApp(page, { source: SCALE, editing: false });
  // la case au-dessus du 10, sur la ligne +1, est vide
  const box = (await page.locator(".page text", { hasText: /^10$/ }).boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y - box.height / 2);
  await expect(page.getByRole("dialog")).toContainText("La note choisie");
  await page.getByRole("dialog").getByRole("button", { name: /^5 / }).click();
  await settle(page);
  await expect(page.getByRole("dialog")).toContainText("Durée");
  await expect(page).toHaveScreenshot("app-retouche-case-vide.png");
});

test("app retouche d'une note", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS, editing: false });
  // le chiffre ne reçoit pas le clic (la case, dessous, le reçoit) : on double-clique à sa place
  const box = (await page.locator(".page text", { hasText: /^5$/ }).first().boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await settle(page);
  await expect(page).toHaveScreenshot("app-retouche.png");
});

/** Double-clique sur la première case qui porte ce chiffre (le chiffre ne reçoit pas le clic : la case, dessous, le reçoit). */
async function retouchAt(page: Page, digit: RegExp) {
  const box = (await page.locator(".page text", { hasText: digit }).first().boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await settle(page);
}

test("app retouche sur une corde", async ({ page }) => {
  await openApp(page, { source: TECHNIQUES, editing: false });
  await retouchAt(page, /^8$/);
  await expect(page).toHaveScreenshot("app-retouche-corde.png");
});

test("app retouche au clavier", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS, editing: false, options: { noteNames: "keyboard" } });
  await retouchAt(page, /^5$/);
  await expect(page).toHaveScreenshot("app-retouche-clavier.png");
});

test("app retouche sans noms", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS, editing: false, options: { noteNames: "none" } });
  await retouchAt(page, /^5$/);
  await expect(page).toHaveScreenshot("app-retouche-sans-noms.png");
});

test("app statut au clavier", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS, options: { noteNames: "keyboard" } });
  await page.locator(".cm-line").nth(10).click();
  await page.keyboard.press("Home");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await settle(page);
  await expect(page).toHaveScreenshot("app-statut-clavier.png");
});

test("app parties jouées", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS });
  await page.getByRole("button", { name: "Parties et instruments" }).click();
  await settle(page);
  await expect(page).toHaveScreenshot("app-parties.png");
});

test("app métronome", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS });
  await page.getByRole("button", { name: "Battre" }).click();
  await settle(page);
  await expect(page).toHaveScreenshot("app-metronome.png");
});

test("app menu ouvert", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS });
  await page.getByRole("button", { name: "Partition", exact: true }).click();
  await settle(page);
  await expect(page).toHaveScreenshot("app-menu.png");
});

// au clavier : Entrée ouvre le menu, les flèches y passent d'une action à l'autre ; Échap le ferme et
// rend le focus à son bouton
test("app menu au clavier", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS });
  await page.getByRole("button", { name: "Affichage", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await settle(page);
  await expect(page).toHaveScreenshot("app-menu-clavier.png");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Affichage", exact: true })).toBeFocused();
});

// au clavier, Tab passe des menus aux boutons de l'écoute : le bouton qui a le focus a son contour
test("app tab jusqu'à l'écoute", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS });
  await page.getByRole("button", { name: "Fichier", exact: true }).focus();
  for (let i = 0; i < 7; i++) await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Écouter" })).toBeFocused();
  await expect(page.locator("header")).toHaveScreenshot("app-tab-ecoute.png");
});

// la barre des menus : un menu ouvert, le survol d'un autre titre l'ouvre à sa place ; les flèches
// passent au menu voisin ; Tab ferme le menu ; un clic ailleurs aussi
test("app menus au survol", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS });
  const opened = page.getByRole("menu");
  await page.getByRole("button", { name: "Fichier", exact: true }).click();
  await page.getByRole("button", { name: "Affichage", exact: true }).hover();
  await expect(opened).toHaveAttribute("aria-label", "Affichage");
  await settle(page);
  await expect(page).toHaveScreenshot("app-menus-survol.png");
  await page.keyboard.press("ArrowRight");
  await expect(opened).toHaveAttribute("aria-label", "Aide");
  await page.keyboard.press("Tab");
  await expect(opened).toHaveCount(0);
  await page.getByRole("button", { name: "Partition", exact: true }).click();
  await page.mouse.click(900, 600);
  await expect(opened).toHaveCount(0);
});

test("app réglages de la mise en page", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS });
  await page.getByRole("button", { name: "Réglages de la mise en page" }).click();
  await settle(page);
  await expect(page).toHaveScreenshot("app-mise-en-page.png");
});

for (const [item, file] of [["Nouveau…", "nouveau"], ["Exporter en MusicXML…", "export"]] as const)
  test(`app dialogue ${file}`, async ({ page }) => {
    await openApp(page, { source: CLAIR_SECTIONS });
    await menu(page, "Fichier", item);
    await expect(page).toHaveScreenshot(`app-dialogue-${file}.png`);
  });

test("app dialogue conversion", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS });
  await menu(page, "Partition", "Convertir pour la guitare ou la basse…");
  await expect(page).toHaveScreenshot("app-dialogue-conversion.png");
});

test("app complétion", async ({ page }) => {
  await openApp(page, { source: TECHNIQUES });
  await page.locator(".cm-line").nth(8).click();
  await page.keyboard.press("Home");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Control+Space");
  await settle(page);
  await expect(page).toHaveScreenshot("app-completion.png");
});

test("app bibliothèque", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS });
  await menu(page, "Fichier", "Bibliothèque");
  await expect(page).toHaveScreenshot("app-bibliotheque.png");
});

/**
 * Une bibliothèque : le choix du dossier remplacé par un dossier privé du navigateur (OPFS), rempli
 * de quelques morceaux, dont un dans un sous-dossier et un MusicXML. Les dates (celles du jour) sont masquées.
 */
async function openLibrary(page: Page, view: "list" | "thumbs") {
  const files: [string, string][] = [
    ["Au clair de la lune.prisma", CLAIR_SECTIONS],
    ["Techniques.prisma", TECHNIQUES],
    ["Guitare/Greensleeves.prisma", GREENSLEEVES_CHORDS],
    ["Satie/Gymnopedie 1.musicxml", readFileSync(new URL("../fixtures/gymnopedie1.musicxml", import.meta.url), "utf8")],
  ];
  await page.addInitScript(
    ([list]) => {
      (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker = async () => {
        const root = await (await navigator.storage.getDirectory()).getDirectoryHandle("bibliotheque", { create: true });
        for (const [path, text] of list) {
          const parts = path.split("/");
          let dir = root;
          for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true });
          const w = await (await dir.getFileHandle(parts.at(-1)!, { create: true })).createWritable();
          await w.write(text);
          await w.close();
        }
        return root;
      };
    },
    [files] as const,
  );
  await openApp(page, { source: CLAIR_SECTIONS });
  await menu(page, "Fichier", "Bibliothèque");
  await page.getByRole("button", { name: "Choisir un dossier" }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: view === "list" ? "En liste" : /^En vignettes/ }).click();
  await settle(page);
}

for (const view of ["list", "thumbs"] as const)
  test(`app bibliothèque ${view}`, async ({ page }) => {
    await openLibrary(page, view);
    // les dates (celles des fichiers, qui changent) : effacées, sans toucher à la place qu'elles prennent
    await page.getByText(/^\d{2}\/\d{2}\/\d{4}$/).evaluateAll((dates) => dates.forEach((d) => ((d as HTMLElement).style.color = "transparent")));
    await expect(page).toHaveScreenshot(`app-bibliotheque-${view}.png`);
  });

test("app référence", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS });
  await menu(page, "Aide", "Référence");
  await expect(page).toHaveScreenshot("app-reference.png");
});

test("app lecture focalisée", async ({ page }) => {
  await openApp(page, { source: GYMNOPEDIE, editing: false, view: { fit: "focus", zoom: 1 } });
  await expect(page).toHaveScreenshot("app-focalisee.png");
});

// la première page sortie de l'écran, le bouton qui ramène au début : vers la gauche quand les
// pages défilent de côté (ajustées à la hauteur), vers le haut quand elles défilent de haut en bas
// (zoomées, pour que les trois pages de la Gymnopédie dépassent de côté)
for (const [fit, zoom, name] of [["height", 2, "gauche"], ["width", 1, "haut"]] as const)
  test(`app retour au début ${name}`, async ({ page }) => {
    await openApp(page, { source: GYMNOPEDIE, editing: false, view: { fit, zoom } });
    await page.locator("section[data-fit]").evaluate((p) => p.scrollTo({ left: p.scrollWidth, top: p.scrollHeight }));
    await settle(page);
    await expect(page).toHaveScreenshot(`app-retour-${name}.png`);
    await page.getByRole("button", { name: "Retour au début de la partition" }).click();
    await settle(page);
    await expect(page.locator("section[data-fit]")).toHaveJSProperty(fit === "height" ? "scrollLeft" : "scrollTop", 0);
    await expect(page.getByRole("button", { name: "Retour au début de la partition" })).toHaveCount(0);
  });

// où en est la lecture, sous la barre : un clic sur la piste place la lecture sur une mesure (ici la 10e des 16, dans la section B)
test("app piste de lecture", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS, editing: false });
  const track = page.getByRole("slider", { name: "Position dans le morceau" });
  const box = (await track.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height / 2);
  await settle(page);
  await expect(track).toHaveAttribute("aria-valuetext", "mesure 10 sur 16, section B");
  // la bulle, au survol : la mesure où l'on tombera ; puis la piste seule, le pointeur ailleurs
  // (le compteur s'est élargi : la piste a bougé)
  const moved = (await track.boundingBox())!;
  await page.mouse.move(moved.x + moved.width * 0.3, moved.y + moved.height / 2);
  await expect(page.getByText(/^mesure 5/)).toBeVisible();
  await page.mouse.move(0, 400);
  // 16 mesures de 4 temps à 100 : 38 secondes ; la 10e commence à 21
  await expect(page.getByText("0:21 / 0:38")).toBeVisible();
  await expect(page).toHaveScreenshot("app-piste.png", { clip: { x: 0, y: 0, width: 1300, height: 72 } });
});

// Affichage › Piste de lecture la masque, et le choix tient au rechargement
test("app sans piste de lecture", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS, editing: false });
  const track = page.getByRole("slider", { name: "Position dans le morceau" });
  await expect(track).toBeVisible();
  await menu(page, "Affichage", "Piste de lecture");
  await expect(track).toHaveCount(0);
  await page.reload();
  await settle(page);
  await expect(track).toHaveCount(0);
  await expect(page).toHaveScreenshot("app-sans-piste.png");
  await menu(page, "Affichage", "Piste de lecture");
  await expect(track).toBeVisible();
});

test("app erreur", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS.replace("|1  |1  |1  |3  ||", "|1  |1  |13 |3  ||") });
  await expect(page).toHaveScreenshot("app-erreur.png");
});

test("app erreurs", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS.replace("|1  |1  |1  |3  ||", "|1  |1  |13 |3  ||").replace("|3  |3  |3  |3  ||", "|3  |3  |33 |3  ||") });
  // le message d'une erreur, au survol de son soulignement
  await page.locator(".cm-lintRange-error").first().hover();
  await settle(page);
  await expect(page).toHaveScreenshot("app-erreurs.png");
});

test("app erreur corrigée", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS.replace("|1  |1  |1  |3  ||", "|1  |1  |13 |3  ||"), options: { autoEngrave: false } });
  // l'erreur, depuis son message, puis le 3 en trop remplacé par une espace
  await page.getByTitle("aller à l'erreur").click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Delete");
  await page.keyboard.type(" ");
  await settle(page);
  await expect(page).toHaveScreenshot("app-erreur-corrigee.png");
});

test("app dépôt", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS });
  const files = await page.evaluateHandle(() => {
    const d = new DataTransfer();
    d.items.add(new File(["0 |1 ||"], "morceau.prisma"));
    return d;
  });
  await page.dispatchEvent("#root > div", "dragenter", { dataTransfer: files });
  await settle(page);
  await expect(page).toHaveScreenshot("app-depot.png");
});

test("app avis", async ({ page }) => {
  await openApp(page, { source: CLAIR_SECTIONS });
  // un fichier qui ne s'ouvre pas : la barre le dit
  const files = await page.evaluateHandle(() => {
    const d = new DataTransfer();
    d.items.add(new File(["x"], "photo.png"));
    return d;
  });
  await page.dispatchEvent("#root > div", "drop", { dataTransfer: files });
  await settle(page);
  await expect(page.locator("header")).toHaveScreenshot("app-avis.png");
});

// la gravure : un petit corpus, à plusieurs réglages, et à l'impression
const ENGRAVINGS: [string, string, Record<string, unknown>?][] = [
  ["gymnopedie", GYMNOPEDIE],
  ["gymnopedie-compact", GYMNOPEDIE, { density: "compact", octaveColors: "none" }],
  ["clair-une-ligne-par-note", CLAIR_SECTIONS, { notePosition: "pitch", sections: "inline" }],
  ["greensleeves-grilles", GREENSLEEVES_CHORDS, { chords: "grid", chordChart: true }],
  ["techniques", TECHNIQUES],
];
for (const [name, source, options] of ENGRAVINGS)
  test(`gravure ${name}`, async ({ page }) => {
    await openApp(page, { source, editing: false, ...(options ? { options } : {}) });
    await expect(page.locator(".page").first()).toHaveScreenshot(`gravure-${name}.png`);
  });

test("gravure impression", async ({ page }) => {
  await openApp(page, { source: GYMNOPEDIE, editing: false });
  await page.emulateMedia({ media: "print" });
  await settle(page);
  await expect(page).toHaveScreenshot("gravure-impression.png", { fullPage: true });
});
