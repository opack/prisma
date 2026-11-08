/**
 * Ce que partagent les scènes du navigateur (tests de comportement et banc de captures) : les
 * morceaux d'exemple, les tailles d'écran, et l'application ouverte dans un état connu.
 */
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { importMusicXml, writePrisma } from "../../src/core/index.ts";

export { CLAIR_SECTIONS, GREENSLEEVES_CHORDS, SCALE, TECHNIQUES } from "../../src/site/examples/pieces.ts";

export const GYMNOPEDIE_XML = readFileSync(new URL("../fixtures/gymnopedie1.musicxml", import.meta.url), "utf8");
export const GYMNOPEDIE = writePrisma(importMusicXml(GYMNOPEDIE_XML));

export const DESKTOP = { width: 1300, height: 850 };
export const PHONE = { width: 390, height: 844 };
export const TABLET = { width: 820, height: 1180 };

export type AppState = {
  source: string;
  editing?: boolean;
  options?: Record<string, unknown>;
  view?: Record<string, unknown>;
  size?: { width: number; height: number };
};

/** L'application, dans un état connu : son texte, l'éditeur ouvert ou non, ses options, sa vue, la taille de l'écran. */
export async function openApp(page: Page, { source, editing = true, options, view, size = DESKTOP }: AppState) {
  await page.setViewportSize(size);
  await page.addInitScript(
    ([text, editingFlag, optionsJson, viewJson]) => {
      // une seule fois : un rechargement garde ce que la scène a changé
      if (sessionStorage.getItem("scene")) return;
      sessionStorage.setItem("scene", "1");
      localStorage.clear();
      localStorage.setItem("prisma:source", text);
      localStorage.setItem("prisma:editing", editingFlag);
      if (optionsJson) localStorage.setItem("prisma:options", optionsJson);
      if (viewJson) localStorage.setItem("prisma:view", viewJson);
    },
    [source, String(editing), options ? JSON.stringify(options) : "", view ? JSON.stringify(view) : ""] as const,
  );
  await page.goto("/app/");
  await settle(page);
}

/** Les polices chargées, la mise en page faite, plus rien ne bouge. */
export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
}

/** Une action d'un menu de la barre, par son titre et son nom. */
export async function chooseMenu(page: Page, title: string, action: string) {
  await page.getByRole("button", { name: title, exact: true }).click();
  // une action qui se coche porte « ✓ » devant son nom quand elle est cochée
  await page
    .getByRole("menu")
    .locator('[role^="menuitem"]', { hasText: new RegExp(`^(✓\\s*)?${escapeRegExp(action)}`) })
    .first()
    .click();
  await settle(page);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Le lien de partage d'un morceau, écrit par l'application elle-même (le serveur de développement sert ses modules). */
export async function shareLinkFor(page: Page, text: string, settings: Record<string, unknown> = {}) {
  return page.evaluate(
    async ([pieceText, pieceSettings]) => {
      const module = "/src/app/files/share.ts";
      const { encodeShare, shareLink } = await import(/* @vite-ignore */ module);
      return shareLink(
        await encodeShare({ name: "Au clair de la lune.prisma", text: pieceText, settings: pieceSettings }),
        location.href,
      ) as string;
    },
    [text, settings] as const,
  );
}

/** Ouvre un lien de partage dans la page, comme un lien reçu. */
export async function receiveShared(page: Page, text: string, settings: Record<string, unknown> = {}) {
  const link = await shareLinkFor(page, text, settings);
  await page.evaluate((hash) => (location.hash = hash), new URL(link).hash);
}

/**
 * Le choix d'un dossier remplacé par un dossier privé du navigateur (OPFS), rempli de ces fichiers
 * (chemin → texte), sous-dossiers compris.
 */
export async function provideFolder(page: Page, folder: string, files: [string, string][] = []) {
  await page.addInitScript(
    ([name, list]) => {
      (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker = async () => {
        const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true });
        for (const [path, text] of list) {
          const parts = path.split("/");
          let directory = root;
          for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part, { create: true });
          const writable = await (await directory.getFileHandle(parts.at(-1)!, { create: true })).createWritable();
          await writable.write(text);
          await writable.close();
        }
        return root;
      };
    },
    [folder, files] as const,
  );
}

/** Le choix d'un fichier à enregistrer remplacé par ce dossier privé du navigateur : le fichier y prend le nom proposé. */
export async function provideSaveTarget(page: Page, folder: string) {
  await page.addInitScript((name) => {
    (
      window as unknown as { showSaveFilePicker: (options: { suggestedName: string }) => Promise<FileSystemFileHandle> }
    ).showSaveFilePicker = async ({ suggestedName }) =>
      (await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })).getFileHandle(suggestedName, {
        create: true,
      });
  }, folder);
}

/** Les noms des fichiers de ce dossier privé du navigateur. */
export async function listProvided(page: Page, folder: string) {
  return page.evaluate(async (folderName) => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle(folderName);
    const names: string[] = [];
    for await (const name of (directory as unknown as { keys: () => AsyncIterable<string> }).keys()) names.push(name);
    return names.sort();
  }, folder);
}

/** Lit un fichier de ce dossier privé du navigateur. */
export async function readProvided(page: Page, folder: string, name: string) {
  return page.evaluate(
    async ([folderName, fileName]) => {
      const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle(folderName);
      return (await (await directory.getFileHandle(fileName)).getFile()).text();
    },
    [folder, name] as const,
  );
}

/**
 * pCloud simulé (page.route) : l'API sert ces fichiers du dossier de l'app, comme la vraie (une
 * liste, des liens de téléchargement), ou refuse la connexion.
 */
export async function fakePcloud(page: Page, files: Record<string, string>, { refused = false } = {}) {
  const entries = Object.entries(files);
  await page.route("https://eapi.pcloud.com/**", async (route) => {
    const url = new URL(route.request().url());
    const method = url.pathname.slice(1);
    const json = (body: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    if (refused) return json({ result: 2094, error: "Invalid 'access_token' provided." });
    if (method === "listfolder")
      return json({
        result: 0,
        metadata: {
          name: "Prisma",
          isfolder: true,
          contents: entries.map(([name], index) => ({
            name,
            isfolder: false,
            fileid: index + 1,
            modified: "Wed, 28 Oct 2026 10:00:00 +0000",
          })),
        },
      });
    if (method === "getfilelink")
      return json({ result: 0, hosts: ["eapi.pcloud.com"], path: `/fichier/${url.searchParams.get("fileid")}` });
    if (method.startsWith("fichier/")) return route.fulfill({ body: entries[Number(method.split("/")[1]) - 1][1] });
    return json({ result: 2009, error: "File not found." });
  });
  // le relais du site, qui lit un fichier pour la page
  await page.route("**/api/pcloud-file**", (route) =>
    route.fulfill({
      contentType: "text/plain; charset=utf-8",
      body: entries[Number(new URL(route.request().url()).searchParams.get("fileid")) - 1][1],
    }),
  );
}

/** Connecté à pCloud, qui est la bibliothèque choisie (après l'ouverture de l'application : elle vide le stockage). */
export async function connectPcloud(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem("prisma:pcloud", JSON.stringify({ token: "banc", host: "eapi.pcloud.com" }));
    localStorage.setItem("prisma:library-source", "pcloud");
  });
}

/** Dépose ces fichiers sur la fenêtre, comme depuis le bureau. */
export async function dropFiles(page: Page, files: [string, string][], event: "dragenter" | "drop" = "drop") {
  const transfer = await page.evaluateHandle((list) => {
    const data = new DataTransfer();
    for (const [name, text] of list) data.items.add(new File([text], name));
    return data;
  }, files);
  await page.dispatchEvent("#app > div", event, { dataTransfer: transfer });
}

/** Double-clique sur la première case de la partition qui porte ce chiffre (le chiffre ne reçoit pas le clic : la case, dessous, le reçoit). */
export async function retouchAt(page: Page, digit: RegExp) {
  const box = (await page.locator(".page text", { hasText: digit }).first().boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await settle(page);
}
