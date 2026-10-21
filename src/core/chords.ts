/**
 * Accords d'accompagnement (ligne `@c`). Un accord s'écrit de trois façons :
 *
 * - par son nom Prisma, l'écriture privilégiée : la fondamentale en nombre, puis, après un « : »,
 *   la sorte d'accord, et après un « / » la basse si elle diffère (« 8 » sol majeur, « 10:m »,
 *   « 8:7 », « 7:m7b5 », « 1/8 » do sur sol) ; l'accord majeur n'a pas de « : » ;
 * - par son nom anglais (« Am », « G7 », « F#m7b5 », « G/B ») ;
 * - par ses notes Prisma séparées par des virgules, de la basse vers l'aigu (« 10,1,5 »).
 *
 * Les notes n'ont pas d'octave : un accord dit quelles notes jouer, pas où. Ce sont des numéros
 * Prisma de 1 (do) à 12 (si).
 */

/** Séparateur des notes d'un accord écrit en notes Prisma. */
export const CHORD_NOTE_SEPARATOR = ",";
/** Séparateur, dans un nom Prisma, de la fondamentale et de la sorte d'accord. */
export const CHORD_QUALITY_SEPARATOR = ":";

const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** Nom d'une fondamentale : dièses pour do♯ et fa♯, bémols pour mi♭, la♭, si♭ (l'usage). */
const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

/**
 * Qualités reconnues, par leur suffixe, avec leurs intervalles (en demi-tons depuis la
 * fondamentale). Le premier suffixe de chaque ligne est celui qu'on écrit en reconnaissant
 * un accord à partir de ses notes ; les autres sont des variantes acceptées à la lecture.
 */
const QUALITIES: [string[], number[]][] = [
  [["", "maj", "M"], [0, 4, 7]],
  [["m", "min", "-"], [0, 3, 7]],
  [["dim", "°"], [0, 3, 6]],
  [["aug", "+"], [0, 4, 8]],
  [["sus4", "sus"], [0, 5, 7]],
  [["sus2"], [0, 2, 7]],
  [["5"], [0, 7]],
  [["6"], [0, 4, 7, 9]],
  [["m6"], [0, 3, 7, 9]],
  [["7"], [0, 4, 7, 10]],
  [["maj7", "M7", "Δ", "Δ7"], [0, 4, 7, 11]],
  [["m7", "min7", "-7"], [0, 3, 7, 10]],
  [["mMaj7", "mmaj7", "m(maj7)", "mM7"], [0, 3, 7, 11]],
  [["dim7", "°7"], [0, 3, 6, 9]],
  [["m7b5", "ø", "ø7"], [0, 3, 6, 10]],
  [["aug7", "7#5", "+7"], [0, 4, 8, 10]],
  [["7sus4", "7sus"], [0, 5, 7, 10]],
  [["7b5"], [0, 4, 6, 10]],
  [["add9"], [0, 4, 7, 14]],
  [["madd9"], [0, 3, 7, 14]],
  [["6/9", "69"], [0, 4, 7, 9, 14]],
  [["9"], [0, 4, 7, 10, 14]],
  [["maj9", "M9"], [0, 4, 7, 11, 14]],
  [["m9"], [0, 3, 7, 10, 14]],
  [["7b9"], [0, 4, 7, 10, 13]],
  [["7#9"], [0, 4, 7, 10, 15]],
  [["11"], [0, 4, 7, 10, 14, 17]],
  [["m11"], [0, 3, 7, 10, 14, 17]],
  [["13"], [0, 4, 7, 10, 14, 21]],
  [["maj13"], [0, 4, 7, 11, 14, 21]],
  [["m13"], [0, 3, 7, 10, 14, 21]],
];

/** Suffixes, du plus long au plus court, pour lire « m7b5 » avant « m7 » et « m ». */
const SUFFIXES = QUALITIES.flatMap(([names, iv]) => names.map((n) => ({ n, iv }))).sort((a, b) => b.n.length - a.n.length);

const pc = (s: number) => ((s % 12) + 12) % 12;
/** Numéro Prisma (1 à 12) d'une classe de hauteur (0 = do). */
const numero = (p: number) => pc(p) + 1;

/** Fondamentale ou basse : une lettre, éventuellement suivie de « # » ou « b ». */
function readNote(s: string): { pitch: number; rest: string } | undefined {
  const m = s.match(/^([A-G])([#b♯♭]?)/);
  if (!m) return undefined;
  const alter = m[2] === "#" || m[2] === "♯" ? 1 : m[2] === "b" || m[2] === "♭" ? -1 : 0;
  return { pitch: pc(STEP[m[1]] + alter), rest: s.slice(m[0].length) };
}

/** Notes (numéros Prisma) d'un accord écrit par son nom anglais, de la basse vers l'aigu ; undefined s'il est inconnu. */
export function chordNameNotes(name: string): number[] | undefined {
  const root = readNote(name);
  if (!root) return undefined;
  let rest = root.rest;
  let bass: number | undefined;
  // basse : « /B » à la fin (sauf « 6/9 », qui est une qualité)
  const slash = rest.match(/^(.*)\/([A-G][#b♯♭]?)$/);
  if (slash && slash[1] !== "6") {
    bass = readNote(slash[2])!.pitch;
    rest = slash[1];
  }
  return notesOf(root.pitch, rest, bass);
}

/** Le nom Prisma d'un accord écrit par son nom anglais, sa sorte d'accord telle qu'écrite : « Am7/G » → « 10:m7/8 » ; undefined s'il est inconnu. */
export function prismaNameOf(english: string): string | undefined {
  if (!chordNameNotes(english)) return undefined;
  const root = readNote(english)!;
  let rest = root.rest;
  let bass = "";
  const slash = rest.match(/^(.*)\/([A-G][#b♯♭]?)$/);
  if (slash && slash[1] !== "6") {
    bass = "/" + numero(readNote(slash[2])!.pitch);
    rest = slash[1];
  }
  return `${numero(root.pitch)}${rest ? CHORD_QUALITY_SEPARATOR + rest : ""}${bass}`;
}

/** Notes d'un accord écrit par son nom Prisma (« 10:m », « 8:7 », « 1/8 ») ; undefined s'il n'en est pas un. */
export function chordPrismaNameNotes(name: string): number[] | undefined {
  const m = name.match(/^(1[0-2]|[1-9])(.*)$/);
  if (!m) return undefined;
  let rest = m[2];
  let bass: number | undefined;
  // basse : « /8 » à la fin (sauf dans « :6/9 », qui est une sorte d'accord)
  const slash = rest.match(/^(.*)\/(1[0-2]|[1-9])$/);
  if (slash && slash[1] !== ":6") {
    bass = Number(slash[2]) - 1;
    rest = slash[1];
  }
  // la sorte d'accord, toujours après un « : » ; l'accord majeur n'en a pas
  if (rest && !rest.startsWith(CHORD_QUALITY_SEPARATOR)) return undefined;
  const quality = rest.slice(1);
  if (rest && !quality) return undefined;
  return notesOf(Number(m[1]) - 1, quality, bass);
}

/** Les notes d'une fondamentale (0 = do), d'une sorte d'accord et d'une basse éventuelle, de la basse vers l'aigu. */
function notesOf(root: number, suffix: string, bass: number | undefined): number[] | undefined {
  const quality = SUFFIXES.find((q) => q.n === suffix);
  if (!quality) return undefined;
  const notes = [...new Set(quality.iv.map((i) => pc(root + i)))];
  // de la basse vers l'aigu : la basse (la fondamentale sans « / »), puis les autres notes
  // dans l'ordre où elles montent au-dessus d'elle, au plus serré
  const low = bass ?? root;
  const above = notes.filter((n) => n !== low).sort((a, b) => pc(a - low) - pc(b - low));
  return [low, ...above].map(numero);
}

/** Notes d'un accord écrit en notes Prisma (« 10,1,5 ») ; undefined si l'écriture n'en est pas une. */
export function chordPrismaNotes(text: string): number[] | undefined {
  if (!/^\d{1,2}(,\d{1,2})+$/.test(text)) return undefined;
  const notes = text.split(CHORD_NOTE_SEPARATOR).map(Number);
  if (notes.some((n) => n < 1 || n > 12) || new Set(notes).size !== notes.length) return undefined;
  return notes;
}

/** Notes d'un accord, quelle que soit son écriture ; undefined s'il n'est pas reconnu. */
export const chordNotes = (text: string) => chordPrismaNotes(text) ?? chordPrismaNameNotes(text) ?? chordNameNotes(text);

/** L'écriture d'un accord : son nom Prisma, son nom anglais, ou ses notes. */
export const chordWriting = (text: string): "prisma" | "english" | "notes" =>
  /^[A-G]/.test(text) ? "english" : text.includes(CHORD_NOTE_SEPARATOR) ? "notes" : "prisma";

/**
 * Un accord donné par ses notes (de la basse vers l'aigu), reconnu : sa fondamentale (0 = do), sa
 * sorte d'accord (le suffixe usuel) et sa basse. La basse est d'abord essayée comme fondamentale ;
 * sinon l'accord est un renversement. Undefined si les notes ne forment aucun accord connu.
 */
function recognize(notes: number[]): { root: number; quality: string; bass: number } | undefined {
  const set = new Set(notes.map((n) => n - 1));
  const bass = notes[0] - 1;
  const same = (iv: number[], root: number) => iv.length === set.size && iv.every((i) => set.has(pc(root + i)));
  const roots = [bass, ...[...set].filter((p) => p !== bass)];
  for (const root of roots) {
    const q = QUALITIES.find(([, iv]) => same(iv, root));
    if (q) return { root, quality: q[0][0], bass };
  }
  return undefined;
}

/** Nom anglais d'un accord donné par ses notes : « Am », « G/B ». */
export function chordName(notes: number[]): string | undefined {
  const r = recognize(notes);
  return r && NAMES[r.root] + r.quality + (r.root === r.bass ? "" : "/" + NAMES[r.bass]);
}

/** Nom Prisma d'un accord donné par ses notes : « 10:m », « 8/12 ». */
export function chordPrismaName(notes: number[]): string | undefined {
  const r = recognize(notes);
  return r && `${r.root + 1}${r.quality ? CHORD_QUALITY_SEPARATOR + r.quality : ""}${r.root === r.bass ? "" : "/" + (r.bass + 1)}`;
}

/** Écriture d'un accord en notes Prisma : ses notes séparées par des virgules. */
export const chordPrismaText = (notes: number[]) => notes.join(CHORD_NOTE_SEPARATOR);
