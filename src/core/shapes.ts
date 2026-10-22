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
export const gridStrings = (strings: (Strings | undefined)[]): Strings => strings.find((s) => s && s.open.length === 6) ?? defaultStrings("guitar");

/** Ce que coûte l'écart des doigts, de 0 à 3 cases : quatre cases, c'est l'extension, rarement confortable. */
const SPAN_COST = [0, 0.5, 1.2, 4.5];

/** Une grille : la case de chaque corde, de la plus grave à la plus aiguë ; null : la corde ne se joue pas. */
export type Shape = (number | null)[];

/** Séparateur, sur la ligne `@c`, d'un accord et de sa grille. */
export const SHAPE_SEPARATOR = "=";

/** L'accord et la grille d'un mot de la ligne `@c` (« 10:m=x02210 »). */
export function splitShape(word: string): { chord: string; shape?: string } {
  const i = word.indexOf(SHAPE_SEPARATOR);
  return i < 0 ? { chord: word } : { chord: word.slice(0, i), shape: word.slice(i + 1) };
}

/** Lit une grille écrite (« x02210 », « x-12-14-14-13-x ») ; undefined si l'écriture n'en est pas une. */
export function parseShape(text: string): Shape | undefined {
  const parts = text.includes("-") ? text.split("-") : [...text];
  if (parts.length < 2 || parts.some((p) => !/^(x|\d{1,2})$/i.test(p))) return undefined;
  const shape = parts.map((p) => (/x/i.test(p) ? null : Number(p)));
  return shape.every((f) => f === null || f <= MAX_FRET) ? shape : undefined;
}

/** Écrit une grille : sans séparateur, ou avec des traits si une case a deux chiffres. */
export const shapeText = (shape: Shape) => {
  const parts = shape.map((f) => (f === null ? "x" : String(f)));
  return parts.some((p) => p.length > 1) ? parts.join("-") : parts.join("");
};

/** Les cordes à vide, capo compris, de la plus grave à la plus aiguë. */
const lowToHigh = (s: Strings) => [...s.open].reverse().map((m) => m + s.capo);

/** Les classes de hauteur (0 = do) que fait sonner une grille. */
export function shapePitches(shape: Shape, s: Strings): number[] {
  const open = lowToHigh(s);
  return shape.flatMap((f, k) => (f === null ? [] : [(open[k] + f) % 12]));
}

/** Les notes d'une grille, en numéros Prisma (1 à 12), chacune une fois, de la basse vers l'aigu. */
export function shapeNotes(shape: Shape, s: Strings): number[] {
  const open = lowToHigh(s);
  const midis = shape.flatMap((f, k) => (f === null ? [] : [open[k] + f])).sort((a, b) => a - b);
  return [...new Set(midis.map((m) => (m % 12) + 1))];
}

/** Le barré d'une grille : la case et les cordes (de la plus grave à la plus aiguë) qu'un doigt couche. */
export function barreOf(shape: Shape): { fret: number; from: number; to: number } | undefined {
  const pressed = shape.flatMap((f, k) => (f ? [{ f, k }] : []));
  if (pressed.length < 2) return undefined;
  const fret = Math.min(...pressed.map((p) => p.f));
  const at = pressed.filter((p) => p.f === fret).map((p) => p.k);
  if (at.length < 2) return undefined;
  // le doigt couché va de la première corde à cette case jusqu'à la plus aiguë : rien de plus bas, ni à vide, ni muet, entre les deux
  const from = at[0], to = shape.length - 1;
  for (let k = from; k <= to; k++) if (shape[k] === null || shape[k]! < fret) return undefined;
  return { fret, from, to };
}

/** Les doigts qu'une grille demande : un par case appuyée, un seul pour un barré. */
export function fingersOf(shape: Shape): number {
  const pressed = shape.filter((f): f is number => !!f).length;
  const b = barreOf(shape);
  return b ? pressed - shape.filter((f) => f === b.fret).length + 1 : pressed;
}

/**
 * La grille la plus simple pour un accord (ses notes Prisma, 1 à 12, la basse d'abord) sur des
 * cordes données : la basse sur la corde la plus grave jouée, toutes les notes de l'accord (la
 * quinte peut manquer dans un accord de quatre notes ou plus), des cordes muettes seulement du
 * côté grave, quatre doigts au plus, quatre cases d'écart. Le coût : la hauteur sur le manche,
 * l'écart des doigts (de plus en plus cher), les cordes muettes, un barré ; les cordes à vide aident. Undefined si rien
 * ne la joue.
 */
export function chordShape(notes: number[], s: Strings): Shape | undefined {
  const set = new Set(notes.map((n) => (n - 1) % 12));
  const bass = (notes[0] - 1) % 12;
  // la quinte au-dessus de la fondamentale (la basse, sauf renversement) : facultative dans un accord riche
  const fifth = notes.length >= 4 ? (bass + 7) % 12 : undefined;
  const open = lowToHigh(s);
  const n = open.length;
  let best: { shape: Shape; cost: number } | undefined;
  for (let pos = 1; pos <= 12; pos++) {
    // pour chaque corde : muette, à vide, ou une case de la position (quatre cases) qui joue une note de l'accord
    const choices = open.map((o) => [null, ...[0, pos, pos + 1, pos + 2, pos + 3].filter((f) => f <= MAX_FRET && set.has((o + f) % 12))]);
    const shape: Shape = new Array(n).fill(null);
    const walk = (k: number) => {
      if (k === n) {
        const cost = costOf(shape);
        if (cost !== undefined && (!best || cost < best.cost - 1e-9)) best = { shape: [...shape], cost };
        return;
      }
      for (const f of choices[k]) {
        // une corde muette après une corde jouée : seulement du côté grave
        if (f === null && shape.slice(0, k).some((x) => x !== null)) continue;
        shape[k] = f;
        walk(k + 1);
      }
      shape[k] = null;
    };
    const costOf = (sh: Shape): number | undefined => {
      const played = sh.flatMap((f, k) => (f === null ? [] : [{ f, k }]));
      if (played.length < Math.min(3, n)) return undefined;
      if ((open[played[0].k] + played[0].f) % 12 !== bass) return undefined;
      const heard = new Set(played.map((p) => (open[p.k] + p.f) % 12));
      for (const p of set) if (!heard.has(p) && p !== fifth) return undefined;
      const pressed = played.filter((p) => p.f > 0).map((p) => p.f);
      const lo = pressed.length ? Math.min(...pressed) : 0, hi = pressed.length ? Math.max(...pressed) : 0;
      if (hi - lo > 3 || fingersOf(sh) > 4) return undefined;
      // seule la position la plus basse qui contient ces cases compte : pas de doublon d'une position à l'autre
      if (pressed.length && lo !== pos) return undefined;
      const muted = n - played.length;
      // une corde à vide prise entre deux cases hautes : la main, loin du sillet, l'étouffe
      const caught = played.filter((p) => p.f === 0 && played.some((q) => q.k < p.k && q.f >= 4) && played.some((q) => q.k > p.k && q.f > 0)).length;
      return lo + SPAN_COST[hi - lo] + muted + (barreOf(sh) ? 0.5 : 0) + fingersOf(sh) * 0.2 - (played.length - pressed.length) * 0.3 + caught * 2;
    };
    walk(0);
  }
  // un accord tout à vide (rare : un accordage ouvert) : aucune case appuyée, donc aucune position
  const allOpen = open.map((o) => (set.has(o % 12) ? 0 : null));
  if (!best && allOpen[0] === 0 && (open[0] % 12) === bass) best = { shape: allOpen, cost: 0 };
  return best?.shape;
}
