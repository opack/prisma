#!/usr/bin/env node
/**
 * Outil en ligne de commande ymn.
 *
 *   npm run ymn -- import morceau.musicxml [-o morceau.ymn] [--largeur 96]
 *       Convertit un MusicXML en .ymn.
 *   npm run ymn -- format morceau.ymn [-o sortie.ymn] [--largeur 96]
 *       Relit un .ymn et le remet en page à la largeur demandée (en caractères).
 *   npm run ymn -- check morceau.ymn
 *       Vérifie un .ymn et signale la première erreur avec sa ligne et sa colonne.
 *
 * Sans -o, le résultat s'affiche dans le terminal. Sous Windows, préfère -o :
 * la redirection « > » de PowerShell n'écrit pas toujours en UTF-8.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { importMusicXml, parseYmn, writeYmn, DEFAULT_WIDTH } from "./core/index.ts";

const [cmd, file, ...rest] = process.argv.slice(2);
const opt = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const usage = () => {
  console.error("Usage : ymn import|format|check <fichier> [-o sortie.ymn] [--largeur N]");
  process.exit(1);
};
if (!cmd || !file) usage();

const width = Number(opt("--largeur") ?? DEFAULT_WIDTH);
if (!Number.isInteger(width) || width < 20) {
  console.error("--largeur doit être un nombre entier de caractères (20 au minimum).");
  process.exit(1);
}
const out = opt("-o");
const emit = (s: string) => (out ? writeFileSync(out, s, "utf8") : process.stdout.write(s));

try {
  const src = readFileSync(file, "utf8");
  if (cmd === "import") emit(writeYmn(importMusicXml(src, basename(file)), { width }));
  else if (cmd === "format") emit(writeYmn(parseYmn(src), { width }));
  else if (cmd === "check") {
    const s = parseYmn(src);
    const bars = new Set(s.beats.map((b) => b.barIndex)).size;
    console.log(`OK : ${bars} mesures, ${s.notes.length} notes.`);
  } else usage();
} catch (e) {
  console.error((e as Error).message);
  process.exit(2);
}
