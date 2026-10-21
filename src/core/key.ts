/**
 * Tonalité du morceau (`key` dans l'en-tête) : facultative et purement informative, elle ne change
 * aucune note. Elle s'écrit comme un nom d'accord Prisma, majeure ou mineure (« 8 » sol majeur,
 * « 5:m » mi mineur), ou par son nom anglais (« G », « Em », « F#m », « Bb »). Le fichier garde
 * l'écriture choisie ; la partition montre la forme Prisma, et le nom de la tonalité à la demande.
 */
import type { Score } from "./model.ts";
import type { NoteNames } from "./inspect.ts";

/** Une tonalité : sa tonique (1 à 12, 1 = do), majeure ou mineure. */
export type Key = {
  tonic: number;
  minor: boolean;
  /** La tonique telle qu'écrite en anglais (« Gb », « F# »), pour la nommer de même ; sinon le nom usuel. */
  spelled?: { letter: string; alter: number };
};

const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LATIN: Record<string, string> = { C: "do", D: "ré", E: "mi", F: "fa", G: "sol", A: "la", B: "si" };
const pc = (s: number) => ((s % 12) + 12) % 12;

/** Le nom usuel de chaque tonique (lettre et altération), en majeur et en mineur : si♭ majeur, do♯ mineur. */
const MAJOR = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

/** Lit une tonalité ; undefined si elle ne s'écrit pas ainsi. */
export function parseKey(text: string): Key | undefined {
  const s = text.trim();
  const prisma = s.match(/^(1[0-2]|[1-9])(:m)?$/);
  if (prisma) return { tonic: Number(prisma[1]), minor: !!prisma[2] };
  const english = s.match(/^([A-G])([#b♯♭]?)(m?)$/);
  if (!english) return undefined;
  const alter = english[2] === "#" || english[2] === "♯" ? 1 : english[2] === "b" || english[2] === "♭" ? -1 : 0;
  return { tonic: pc(STEP[english[1]] + alter) + 1, minor: english[3] === "m", spelled: { letter: english[1], alter } };
}

/** La tonalité en notation Prisma : « 8 », « 5:m ». */
export const prismaKey = (k: Key) => `${k.tonic}${k.minor ? ":m" : ""}`;

/** Le nom de la tonalité : « sol majeur », « mi mineur » ; en notation anglaise, « G », « Em ». */
export function keyName(k: Key, names: NoteNames): string {
  if (names === "none") return "";
  const usual = (k.minor ? MINOR : MAJOR)[k.tonic - 1];
  const letter = k.spelled?.letter ?? usual[0];
  const alter = k.spelled ? k.spelled.alter : usual[1] === "#" ? 1 : usual[1] === "b" ? -1 : 0;
  const sign = alter > 0 ? "♯" : alter < 0 ? "♭" : "";
  if (names === "english") return `${letter}${sign}${k.minor ? "m" : ""}`;
  return `${LATIN[letter]}${sign} ${k.minor ? "mineur" : "majeur"}`;
}

/**
 * Les deux tonalités d'une armure : le nombre de dièses (> 0) ou de bémols (< 0). Une armure ne dit
 * pas le mode : sans altération, c'est do majeur ou la mineur ; avec un dièse, sol majeur ou mi mineur.
 */
export function keysOfSignature(fifths: number): [Key, Key] {
  const major = pc(fifths * 7);
  return [
    { tonic: major + 1, minor: false },
    { tonic: pc(major + 9) + 1, minor: true },
  ];
}

/**
 * Profils de Krumhansl et Kessler : le poids de chaque degré dans une tonalité majeure et mineure,
 * mesuré à l'écoute. La tonalité devinée est celle dont le profil ressemble le plus à la durée
 * jouée de chaque note.
 */
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlation(a: number[], b: number[]): number {
  const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** La tonalité la plus probable d'après les notes du morceau, parmi toutes ou parmi celles données ; undefined sans notes. */
export function guessKey(score: Score, among?: Key[]): Key | undefined {
  const weight = new Array(12).fill(0);
  for (const n of score.notes) weight[pc(n.midi)] += n.end - n.start;
  if (!weight.some((w) => w > 0)) return undefined;
  let best: Key | undefined, bestR = -Infinity;
  for (let t = 0; t < 12; t++) {
    const rotated = weight.map((_, i) => weight[pc(i + t)]);
    for (const minor of [false, true]) {
      if (among && !among.some((k) => k.tonic === t + 1 && k.minor === minor)) continue;
      const r = correlation(rotated, minor ? MINOR_PROFILE : MAJOR_PROFILE);
      if (r > bestR) [best, bestR] = [{ tonic: t + 1, minor }, r];
    }
  }
  return best;
}
