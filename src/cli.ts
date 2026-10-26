#!/usr/bin/env node
/**
 * Outil en ligne de commande Prisma.
 *
 *   npm run prisma -- import morceau.musicxml [-o morceau.prisma] [--largeur 96]
 *       Convertit un MusicXML en .prisma.
 *   npm run prisma -- format morceau.prisma [-o sortie.prisma] [--largeur 96]
 *       Relit un .prisma et le remet en page à la largeur demandée (en caractères).
 *   npm run prisma -- export morceau.prisma [-o morceau.musicxml] [--reprises]
 *       Écrit un .prisma en MusicXML, pour MuseScore ou un autre logiciel de partition. L'ordre de
 *       jeu s'y déroule, ses sections à la suite ; avec --reprises, il s'écrit quand c'est possible
 *       en reprises et en cases, comme une partition classique (--sans-lettres : sans la lettre
 *       de chaque section).
 *   npm run prisma -- check morceau.prisma
 *       Vérifie un .prisma et signale la première erreur avec sa ligne et sa colonne.
 *
 * Sans -o, le résultat s'affiche dans le terminal. Sous Windows, préfère -o :
 * la redirection « > » de PowerShell n'écrit pas toujours en UTF-8.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { exportMusicXml, importMusicXml, parsePrisma, writePrisma, DEFAULT_WIDTH } from "./core/index.ts";

const [cmd, file, ...rest] = process.argv.slice(2);
const opt = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const usage = () => {
  console.error("Usage : prisma import|format|export|check <fichier> [-o sortie] [--largeur N] [--reprises [--sans-lettres]]");
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
  if (cmd === "import") emit(writePrisma(importMusicXml(src, basename(file)), { width }));
  else if (cmd === "format") emit(writePrisma(parsePrisma(src), { width }));
  else if (cmd === "export") emit(exportMusicXml(parsePrisma(src), { repeats: rest.includes("--reprises") ? "traditional" : "sections", letters: !rest.includes("--sans-lettres") }));
  else if (cmd === "check") {
    const s = parsePrisma(src);
    const bars = new Set(s.beats.map((b) => b.barIndex)).size;
    console.log(`OK : ${bars} mesure${bars > 1 ? "s" : ""}, ${s.notes.length} note${s.notes.length > 1 ? "s" : ""}.`);
  } else usage();
} catch (e) {
  console.error((e as Error).message);
  process.exit(2);
}
