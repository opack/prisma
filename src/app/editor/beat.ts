/**
 * Couper ou refermer un temps dans le texte : ce que proposent le double-clic sur la règle de la
 * partition et la complétion de l'éditeur sur une case de la règle.
 *
 * Toutes les cases d'un temps ont la même durée : on ne coupe pas une case seule, c'est le temps
 * entier qui passe à un découpage plus fin (« 1 * » devient « 1 . * . ») ou plus large.
 *
 * Couper : chaque case reçoit ses nouvelles cases juste après elle, sur toutes les lignes du
 * système. Sur la règle, leurs étiquettes ; sur une ligne de notes, « - » quand la case sonne (une
 * note, une tenue, une trille), pour que la note dure autant qu'avant, sinon du vide ; sur un trait,
 * du trait ; sur une ligne @, de l'espace, ou un soufflet prolongé. Les étiquettes déjà écrites
 * gardent leur sens : la case k devient la case k × facteur, de même nom.
 *
 * Refermer : les cases en trop disparaissent. Seulement si rien ne se perd : sur chaque ligne de
 * notes, une case en trop prolonge exactement ce qui sonne avant elle (« - » après une note ou une
 * tenue, du vide après du vide), et aucune indication, aucun accord, aucune syllabe ne commence
 * sur elle. Ses colonnes s'effacent quand elles ne portent que ses signes ; sinon (un texte qui
 * déborde, le nom d'une partie sur un trait) elles restent, vidées, et la case d'avant s'élargit.
 */
import { anchorLabel } from "../../core/layout.ts";
import { rulerCase } from "../../core/locate.ts";
import { TICKS_PER_BEAT } from "../../core/model.ts";
import type { Division } from "../../core/model.ts";
import { isRuler } from "../../core/prisma-parse.ts";
import { cases, isRuleLine, marksOf, systemOf, widen } from "./complete.ts";
import type { Case, Rewrite, System } from "./complete.ts";

/** Le temps d'une case de la règle : ses cases, son nombre et son découpage. */
export type Beat = { cases: Case[]; count: number; base: Division };

/** Ce qu'on peut faire d'un temps : le couper en 2 ou en 3, le recouper, le refermer (ou pourquoi pas). */
export type BeatAction =
  { kind: "split"; factor: 2 | 3; label: string } | { kind: "merge"; factor: 2 | 3; label: string; blocked?: string };

/** Au plus fin : 16 cases dans un temps binaire, 24 dans un temps ternaire (le niveau « , »). */
const FINEST = 8;

/** Le temps de la colonne col de la règle, ou rien hors d'un temps. */
export function beatAt(ruler: string, col: number): Beat | undefined {
  const all = cases(ruler);
  const index = all.findIndex((candidate) => col >= candidate.start && col < candidate.end);
  if (index < 0) return undefined;
  let first = index;
  while (first > 0 && !all[first - 1].bar) first--;
  let last = index;
  while (!all[last].bar) last++;
  const beatCases = all.slice(first, last + 1);
  const stars = beatCases.filter((beatCase) => ruler.slice(beatCase.start, beatCase.end).trim() === "*").length;
  return { cases: beatCases, count: beatCases.length, base: stars === 2 ? 3 : 2 };
}

/** Le facteur qui referme un temps d'un niveau : en 1 depuis son premier découpage, sinon de moitié. */
function mergeFactor(beat: Beat): 2 | 3 | undefined {
  if (beat.count === 1) return undefined;
  if (beat.count === beat.base) return beat.base;
  const half = beat.count / 2;
  return Number.isInteger(half) && half % beat.base === 0 ? 2 : undefined;
}

/** Les actions possibles sur le temps de la colonne col de la règle du système. */
export function beatActions(lines: string[], sys: System, col: number): BeatAction[] {
  const beat = beatAt(lines[sys.ruler], col);
  if (!beat) return [];
  const actions: BeatAction[] = [];
  if (beat.count === 1)
    actions.push({ kind: "split", factor: 2, label: "Couper en 2" }, { kind: "split", factor: 3, label: "Couper en 3" });
  else if (beat.count * 2 <= beat.base * FINEST) actions.push({ kind: "split", factor: 2, label: "Recouper" });
  const factor = mergeFactor(beat);
  if (factor) {
    const blocked = mergeBlocked(lines, sys, beat, factor);
    actions.push({ kind: "merge", factor, label: "Refermer", ...(blocked ? { blocked } : {}) });
  }
  return actions;
}

const isComment = (line: string) => line.startsWith("#");
const isNoteLine = (line: string) => line.includes("|") && !line.startsWith("@") && !isComment(line) && !isRuleLine(line) && !isRuler(line);
/** Une case sonne quand elle porte une note, une tenue ou une trille ; des petites notes seules ne sonnent pas après elles. */
const sounds = (content: string) => content.replace(/\d+'/g, "").trim() !== "";

/** Une ligne prolongée par des espaces (et les barres de la règle) jusqu'à la colonne col. */
function padTo(line: string, col: number, ruler: string) {
  let out = line;
  for (let column = line.length; column < col; column++) out += ruler[column] === "|" ? "|" : " ";
  return out;
}

/** Coupe le temps de la colonne col : chaque case en factor cases, de cell colonnes pour les nouvelles. */
export function splitBeat(lines: string[], sys: System, col: number, factor: 2 | 3, cell: number): Rewrite | undefined {
  const ruler = lines[sys.ruler];
  const beat = beatAt(ruler, col);
  if (!beat) return undefined;
  const count = beat.count * factor;
  const base: Division = beat.count === 1 ? factor : beat.base;
  const width = (factor - 1) * cell;
  const out = new Map<number, string>();
  for (let index = sys.first; index <= sys.last; index++) {
    const original = lines[index];
    if (isComment(original)) continue;
    let line = original;
    // de la dernière case à la première : les colonnes des cases d'avant ne bougent pas
    for (let caseIndex = beat.cases.length - 1; caseIndex >= 0; caseIndex--) {
      const { start, end } = beat.cases[caseIndex];
      if (index === sys.ruler) {
        let added = "";
        for (let step = 1; step < factor; step++) added += anchorLabel(caseIndex * factor + step, count, base, 1).padEnd(cell);
        line = line.slice(0, end) + added + line.slice(end);
      } else if (isNoteLine(line)) {
        const content = line.slice(start, end).trim();
        if (!sounds(content)) {
          line = line.length > end ? line.slice(0, end) + " ".repeat(width) + line.slice(end) : line;
          continue;
        }
        const padded = padTo(line, end, ruler);
        line = padded.slice(0, end) + "-".padEnd(cell).repeat(factor - 1) + padded.slice(end);
      } else line = widen(line, end, width);
    }
    line = line.trimEnd();
    if (line !== original) out.set(index, line);
  }
  const first = beat.cases[0];
  return { lines: out, caret: { line: sys.ruler, col: first.end } };
}

/** Pourquoi le temps ne se referme pas d'un facteur sans rien perdre, ou rien s'il le peut. */
function mergeBlocked(lines: string[], sys: System, beat: Beat, factor: number): string | undefined {
  const removed = beat.cases.filter((_, caseIndex) => caseIndex % factor !== 0);
  for (let index = sys.first; index <= sys.last; index++) {
    const line = lines[index];
    if (index === sys.ruler || isComment(line) || isRuleLine(line)) continue;
    if (isNoteLine(line)) {
      let sounding = false;
      for (const [caseIndex, beatCase] of beat.cases.entries()) {
        const content = line.slice(beatCase.start, beatCase.end).trim();
        if (caseIndex % factor === 0) {
          sounding = sounds(content);
          continue;
        }
        if (sounding ? content !== "-" : content !== "") return "une note commence ou s'arrête sur une case à refermer";
      }
      continue;
    }
    if (!line.startsWith("@")) continue;
    const words = /^@l(\s|$)/.test(line);
    const starts = marksOf(line).filter((mark) => !(words && /^-[-|]*$/.test(mark.text)));
    if (starts.some((mark) => removed.some((beatCase) => mark.col >= beatCase.start && mark.col < beatCase.end)))
      return "une indication commence sur une case à refermer";
  }
  return undefined;
}

/** Ce qui peut disparaître d'une ligne avec une case refermée : ses signes à elle, rien d'autre. */
function erasable(segment: string, line: string, ruler: boolean) {
  if (ruler || isNoteLine(line)) return true;
  if (isRuleLine(line)) return /^[─━=═-]*$/.test(segment);
  return /^[\s-]*$/.test(segment);
}

/** Referme le temps de la colonne col d'un niveau, ou rien s'il ne le peut sans perte. */
export function mergeBeat(lines: string[], sys: System, col: number): Rewrite | undefined {
  const ruler = lines[sys.ruler];
  const beat = beatAt(ruler, col);
  const factor = beat && mergeFactor(beat);
  if (!beat || !factor || mergeBlocked(lines, sys, beat, factor)) return undefined;
  const removed = beat.cases.filter((_, caseIndex) => caseIndex % factor !== 0);
  const kept = sys.first;
  const rows = Array.from({ length: sys.last - kept + 1 }, (_, offset) => lines[kept + offset]);
  // de la dernière case à la première : les colonnes des cases d'avant ne bougent pas
  for (const { start, end } of [...removed].reverse()) {
    const segments = rows.map((line) => line.padEnd(end).slice(start, end));
    const deletable = rows.every((line, offset) => isComment(line) || erasable(segments[offset], line, kept + offset === sys.ruler));
    rows.forEach((line, offset) => {
      if (isComment(line) || line.length <= start) return;
      const index = kept + offset;
      // effacée si toutes les lignes le permettent ; sinon vidée de ses signes (étiquette, tenue), sa largeur gardée
      if (deletable) rows[offset] = line.slice(0, start) + line.slice(end);
      else if (index === sys.ruler || isNoteLine(line)) rows[offset] = line.slice(0, start) + " ".repeat(end - start) + line.slice(end);
    });
  }
  const out = new Map<number, string>();
  rows.forEach((line, offset) => {
    const trimmed = line.trimEnd();
    if (trimmed !== lines[kept + offset]) out.set(kept + offset, trimmed);
  });
  return { lines: out, caret: { line: sys.ruler, col: beat.cases[0].start } };
}

/** La largeur d'une nouvelle case : la clé cell de l'en-tête, 3 par défaut. */
export function cellWidth(text: string) {
  const header = text.match(/^\s*---\n([\s\S]*?)\n---/);
  const cell = Number(header?.[1].match(/^cell:\s*(\d+)\s*$/m)?.[1]);
  return Number.isInteger(cell) && cell > 0 ? cell : 3;
}

/** Le texte après une écriture, et la place du curseur (ligne et colonne, à partir de 1). */
export function applyRewrite(text: string, rewrite: Rewrite | undefined): { text: string; line: number; column: number } | undefined {
  if (!rewrite) return undefined;
  const lines = text.split("\n");
  return {
    text: lines.map((line, index) => rewrite.lines.get(index) ?? line).join("\n"),
    line: rewrite.caret.line + 1,
    column: rewrite.caret.col + 1,
  };
}

const gcd = (first: number, second: number): number => (second ? gcd(second, first % second) : first);

/**
 * Le texte où une case commence à l'instant tick : son temps coupé autant qu'il faut (en 3 puis en
 * 2 depuis une case seule, sinon en 2), comme le montre la règle détaillée. Rien si une case y
 * commence déjà, ou si le découpage demandé mêlerait demis et tiers.
 */
export function splitAt(text: string, tick: number): string | undefined {
  const found = rulerCase(text, tick);
  if (!found) return undefined;
  const offset = tick - found.beatStart;
  const needed = TICKS_PER_BEAT / gcd(offset, TICKS_PER_BEAT);
  let factor = (found.count * needed) / gcd(found.count, needed) / found.count;
  if (factor === 1) return undefined;
  let current = text;
  const cell = cellWidth(text);
  if (found.count === 1 && factor % 3 === 0) {
    current = splitOnce(current, found.line, found.column, 3, cell);
    factor /= 3;
  }
  // au-delà, chaque découpage coupe en 2
  if (factor & (factor - 1)) return undefined;
  for (; factor > 1; factor /= 2) current = splitOnce(current, found.line, found.column, 2, cell);
  return current;
}

/** Coupe une fois le temps de la colonne col de la règle de la ligne line. */
function splitOnce(text: string, line: number, col: number, factor: 2 | 3, cell: number) {
  const lines = text.split("\n");
  const sys = systemOf(lines, line)!;
  return applyRewrite(text, splitBeat(lines, sys, col, factor, cell))!.text;
}
