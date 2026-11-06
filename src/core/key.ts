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
const toPitchClass = (semitones: number) => ((semitones % 12) + 12) % 12;

/** Le nom usuel de chaque tonique (lettre et altération), en majeur et en mineur : si♭ majeur, do♯ mineur. */
const MAJOR = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

/** Lit une tonalité ; undefined si elle ne s'écrit pas ainsi. */
export function parseKey(text: string): Key | undefined {
  const trimmed = text.trim();
  const prisma = trimmed.match(/^(1[0-2]|[1-9])(:m)?$/);
  if (prisma) return { tonic: Number(prisma[1]), minor: !!prisma[2] };
  const english = trimmed.match(/^([A-G])([#b♯♭]?)(m?)$/);
  if (!english) return undefined;
  const alter = english[2] === "#" || english[2] === "♯" ? 1 : english[2] === "b" || english[2] === "♭" ? -1 : 0;
  return { tonic: toPitchClass(STEP[english[1]] + alter) + 1, minor: english[3] === "m", spelled: { letter: english[1], alter } };
}

/** La tonalité en notation Prisma : « 8 », « 5:m ». */
export const prismaKey = (key: Key) => `${key.tonic}${key.minor ? ":m" : ""}`;

/** Le nom de la tonalité : « sol majeur », « mi mineur » ; en notation anglaise, « G », « Em ». */
export function keyName(key: Key, names: NoteNames): string {
  if (names === "none") return "";
  const usual = (key.minor ? MINOR : MAJOR)[key.tonic - 1];
  const letter = key.spelled?.letter ?? usual[0];
  const alter = key.spelled ? key.spelled.alter : usual[1] === "#" ? 1 : usual[1] === "b" ? -1 : 0;
  const sign = alter > 0 ? "♯" : alter < 0 ? "♭" : "";
  if (names === "english") return `${letter}${sign}${key.minor ? "m" : ""}`;
  return `${LATIN[letter]}${sign} ${key.minor ? "mineur" : "majeur"}`;
}

/**
 * Les deux tonalités d'une armure : le nombre de dièses (> 0) ou de bémols (< 0). Une armure ne dit
 * pas le mode : sans altération, c'est do majeur ou la mineur ; avec un dièse, sol majeur ou mi mineur.
 */
export function keysOfSignature(fifths: number): [Key, Key] {
  const major = toPitchClass(fifths * 7);
  return [
    { tonic: major + 1, minor: false },
    { tonic: toPitchClass(major + 9) + 1, minor: true },
  ];
}

/**
 * Profils de Krumhansl et Kessler : le poids de chaque degré dans une tonalité majeure et mineure,
 * mesuré à l'écoute. La tonalité devinée est celle dont le profil ressemble le plus à la durée
 * jouée de chaque note.
 */
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlation(values: number[], profile: number[]): number {
  const mean = (list: number[]) => list.reduce((sum, value) => sum + value, 0) / list.length;
  const valuesMean = mean(values),
    profileMean = mean(profile);
  let covariance = 0,
    valuesSpread = 0,
    profileSpread = 0;
  for (let index = 0; index < values.length; index++) {
    covariance += (values[index] - valuesMean) * (profile[index] - profileMean);
    valuesSpread += (values[index] - valuesMean) ** 2;
    profileSpread += (profile[index] - profileMean) ** 2;
  }
  return valuesSpread && profileSpread ? covariance / Math.sqrt(valuesSpread * profileSpread) : 0;
}

/** La tonalité la plus probable d'après les notes du morceau, parmi toutes ou parmi celles données ; undefined sans notes. */
export function guessKey(score: Score, among?: Key[]): Key | undefined {
  const weight = new Array(12).fill(0);
  for (const note of score.notes) weight[toPitchClass(note.midi)] += note.end - note.start;
  if (!weight.some((duration) => duration > 0)) return undefined;
  let best: Key | undefined,
    bestFit = -Infinity;
  for (let shift = 0; shift < 12; shift++) {
    const rotated = weight.map((_, index) => weight[toPitchClass(index + shift)]);
    for (const minor of [false, true]) {
      if (among && !among.some((key) => key.tonic === shift + 1 && key.minor === minor)) continue;
      const fit = correlation(rotated, minor ? MINOR_PROFILE : MAJOR_PROFILE);
      if (fit > bestFit) [best, bestFit] = [{ tonic: shift + 1, minor }, fit];
    }
  }
  return best;
}
