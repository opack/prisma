/**
 * Grilles d'accords : un accord pris sur le manche, case par case, de la corde la plus grave à
 * la plus aiguë, dans la forme compacte que connaissent tous les guitaristes : `x` pour une corde
 * qu'on ne joue pas, `0` à vide, sinon la case (`x02210`, la mineur) ; un trait entre les cases
 * quand l'une a deux chiffres (`x-12-14-14-13-x`). Les cases se comptent depuis le capo.
 *
 * Sur la ligne `@c`, une grille s'accole au nom de l'accord après un `=` (`10:m=x02210`) ; sans
 * grille écrite, l'application en choisit une : la forme la plus simple qui joue l'accord.
 */
import type { Strings } from "./strings.ts";
import { MAX_FRET, defaultStrings } from "./strings.ts";

/**
 * Les cordes des grilles d'un morceau : celles de sa première guitare (son accordage, son capo),
 * sinon une guitare en accordage standard. La basse n'a pas de grilles : on y joue la basse de
 * l'accord, pas l'accord.
 */
export const gridStrings = (strings: (Strings | undefined)[]): Strings =>
  strings.find((candidate) => candidate && candidate.open.length === 6) ?? defaultStrings("guitar");

/** Ce que coûte l'écart des doigts, de 0 à 3 cases : quatre cases, c'est l'extension, rarement confortable. */
const SPAN_COST = [0, 0.5, 1.2, 4.5];

/** Une grille : la case de chaque corde, de la plus grave à la plus aiguë ; null : la corde ne se joue pas. */
export type Shape = (number | null)[];

/** Séparateur, sur la ligne `@c`, d'un accord et de sa grille. */
export const SHAPE_SEPARATOR = "=";

/** L'accord et la grille d'un mot de la ligne `@c` (« 10:m=x02210 »). */
export function splitShape(word: string): { chord: string; shape?: string } {
  const index = word.indexOf(SHAPE_SEPARATOR);
  return index < 0 ? { chord: word } : { chord: word.slice(0, index), shape: word.slice(index + 1) };
}

/** Lit une grille écrite (« x02210 », « x-12-14-14-13-x ») ; undefined si l'écriture n'en est pas une. */
export function parseShape(text: string): Shape | undefined {
  const parts = text.includes("-") ? text.split("-") : [...text];
  if (parts.length < 2 || parts.some((part) => !/^(x|\d{1,2})$/i.test(part))) return undefined;
  const shape = parts.map((part) => (/x/i.test(part) ? null : Number(part)));
  return shape.every((fret) => fret === null || fret <= MAX_FRET) ? shape : undefined;
}

/** Écrit une grille : sans séparateur, ou avec des traits si une case a deux chiffres. */
export const shapeText = (shape: Shape) => {
  const parts = shape.map((fret) => (fret === null ? "x" : String(fret)));
  return parts.some((part) => part.length > 1) ? parts.join("-") : parts.join("");
};

/** Les cordes à vide, capo compris, de la plus grave à la plus aiguë. */
const lowToHigh = (strings: Strings) => [...strings.open].reverse().map((midi) => midi + strings.capo);

/** Les classes de hauteur (0 = do) que fait sonner une grille. */
export function shapePitches(shape: Shape, strings: Strings): number[] {
  const open = lowToHigh(strings);
  return shape.flatMap((fret, stringIndex) => (fret === null ? [] : [(open[stringIndex] + fret) % 12]));
}

/** Les notes d'une grille, en numéros Prisma (1 à 12), chacune une fois, de la basse vers l'aigu. */
export function shapeNotes(shape: Shape, strings: Strings): number[] {
  const open = lowToHigh(strings);
  const midis = shape
    .flatMap((fret, stringIndex) => (fret === null ? [] : [open[stringIndex] + fret]))
    .sort((first, second) => first - second);
  return [...new Set(midis.map((midi) => (midi % 12) + 1))];
}

/** Le barré d'une grille : la case et les cordes (de la plus grave à la plus aiguë) qu'un doigt couche. */
export function barreOf(shape: Shape): { fret: number; from: number; to: number } | undefined {
  const pressed = shape.flatMap((pressedFret, stringIndex) => (pressedFret ? [{ fret: pressedFret, stringIndex }] : []));
  if (pressed.length < 2) return undefined;
  const fret = Math.min(...pressed.map((press) => press.fret));
  const at = pressed.filter((press) => press.fret === fret).map((press) => press.stringIndex);
  if (at.length < 2) return undefined;
  // le doigt couché va de la première corde à cette case jusqu'à la plus aiguë : rien de plus bas, ni à vide, ni muet, entre les deux
  const from = at[0],
    to = shape.length - 1;
  for (let stringIndex = from; stringIndex <= to; stringIndex++)
    if (shape[stringIndex] === null || shape[stringIndex]! < fret) return undefined;
  return { fret, from, to };
}

/** Les doigts qu'une grille demande : un par case appuyée, un seul pour un barré. */
export function fingersOf(shape: Shape): number {
  const pressed = shape.filter((fret): fret is number => !!fret).length;
  const barre = barreOf(shape);
  return barre ? pressed - shape.filter((fret) => fret === barre.fret).length + 1 : pressed;
}

/**
 * La grille la plus simple pour un accord (ses notes Prisma, 1 à 12, la basse d'abord) sur des
 * cordes données : la basse sur la corde la plus grave jouée, toutes les notes de l'accord (la
 * quinte peut manquer dans un accord de quatre notes ou plus), des cordes muettes seulement du
 * côté grave, quatre doigts au plus, quatre cases d'écart. Le coût : la hauteur sur le manche,
 * l'écart des doigts (de plus en plus cher), les cordes muettes, un barré ; les cordes à vide aident. Undefined si rien
 * ne la joue.
 */
export function chordShape(notes: number[], strings: Strings): Shape | undefined {
  const set = new Set(notes.map((note) => (note - 1) % 12));
  const bass = (notes[0] - 1) % 12;
  // la quinte au-dessus de la fondamentale (la basse, sauf renversement) : facultative dans un accord riche
  const fifth = notes.length >= 4 ? (bass + 7) % 12 : undefined;
  const open = lowToHigh(strings);
  const stringCount = open.length;
  let best: { shape: Shape; cost: number } | undefined;
  for (let pos = 1; pos <= 12; pos++) {
    // pour chaque corde : muette, à vide, ou une case de la position (quatre cases) qui joue une note de l'accord
    const choices = open.map((openMidi) => [
      null,
      ...[0, pos, pos + 1, pos + 2, pos + 3].filter((fret) => fret <= MAX_FRET && set.has((openMidi + fret) % 12)),
    ]);
    const shape: Shape = new Array(stringCount).fill(null);
    const walk = (stringIndex: number) => {
      if (stringIndex === stringCount) {
        const cost = costOf(shape);
        if (cost !== undefined && (!best || cost < best.cost - 1e-9)) best = { shape: [...shape], cost };
        return;
      }
      for (const fret of choices[stringIndex]) {
        // une corde muette après une corde jouée : seulement du côté grave
        if (fret === null && shape.slice(0, stringIndex).some((chosen) => chosen !== null)) continue;
        shape[stringIndex] = fret;
        walk(stringIndex + 1);
      }
      shape[stringIndex] = null;
    };
    const costOf = (candidate: Shape): number | undefined => {
      const played = candidate.flatMap((fret, stringIndex) => (fret === null ? [] : [{ fret, stringIndex }]));
      if (played.length < Math.min(3, stringCount)) return undefined;
      if ((open[played[0].stringIndex] + played[0].fret) % 12 !== bass) return undefined;
      const heard = new Set(played.map((press) => (open[press.stringIndex] + press.fret) % 12));
      for (const pitchClass of set) if (!heard.has(pitchClass) && pitchClass !== fifth) return undefined;
      const pressed = played.filter((press) => press.fret > 0).map((press) => press.fret);
      const lowest = pressed.length ? Math.min(...pressed) : 0,
        highest = pressed.length ? Math.max(...pressed) : 0;
      if (highest - lowest > 3 || fingersOf(candidate) > 4) return undefined;
      // seule la position la plus basse qui contient ces cases compte : pas de doublon d'une position à l'autre
      if (pressed.length && lowest !== pos) return undefined;
      const muted = stringCount - played.length;
      // une corde à vide prise entre deux cases hautes : la main, loin du sillet, l'étouffe
      const caught = played.filter(
        (press) =>
          press.fret === 0 &&
          played.some((other) => other.stringIndex < press.stringIndex && other.fret >= 4) &&
          played.some((other) => other.stringIndex > press.stringIndex && other.fret > 0),
      ).length;
      return (
        lowest +
        SPAN_COST[highest - lowest] +
        muted +
        (barreOf(candidate) ? 0.5 : 0) +
        fingersOf(candidate) * 0.2 -
        (played.length - pressed.length) * 0.3 +
        caught * 2
      );
    };
    walk(0);
  }
  // un accord tout à vide (rare : un accordage ouvert) : aucune case appuyée, donc aucune position
  const allOpen = open.map((openMidi) => (set.has(openMidi % 12) ? 0 : null));
  if (!best && allOpen[0] === 0 && open[0] % 12 === bass) best = { shape: allOpen, cost: 0 };
  return best?.shape;
}
