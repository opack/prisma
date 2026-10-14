/**
 * Accords d'accompagnement (ligne `@c`) : un accord s'écrit soit par son nom anglais
 * (« Am », « G7 », « F#m7b5 », « G/B »), soit par ses notes ymn séparées par « ; », du grave
 * à l'aigu à partir de la basse (« 10;1;5 »). Les notes n'ont pas d'octave : un accord dit
 * quelles notes jouer, pas où.
 *
 * Les notes sont des numéros ymn de 1 (do) à 12 (si).
 */

/** Séparateur des notes d'un accord écrit en ymn. */
export const CHORD_NOTE_SEPARATOR = ";";

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
/** Numéro ymn (1 à 12) d'une classe de hauteur (0 = do). */
const ymn = (p: number) => pc(p) + 1;

/** Fondamentale ou basse : une lettre, éventuellement suivie de « # » ou « b ». */
function readNote(s: string): { pitch: number; rest: string } | undefined {
  const m = s.match(/^([A-G])([#b♯♭]?)/);
  if (!m) return undefined;
  const alter = m[2] === "#" || m[2] === "♯" ? 1 : m[2] === "b" || m[2] === "♭" ? -1 : 0;
  return { pitch: pc(STEP[m[1]] + alter), rest: s.slice(m[0].length) };
}

/** Notes (numéros ymn) d'un accord écrit par son nom, de la basse vers l'aigu ; undefined s'il est inconnu. */
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
  const quality = SUFFIXES.find((q) => q.n === rest);
  if (!quality) return undefined;
  const notes = [...new Set(quality.iv.map((i) => pc(root.pitch + i)))];
  // de la basse vers l'aigu : la basse (la fondamentale sans « / »), puis les autres notes
  // dans l'ordre où elles montent au-dessus d'elle, au plus serré
  const low = bass ?? root.pitch;
  const above = notes.filter((n) => n !== low).sort((a, b) => pc(a - low) - pc(b - low));
  return [low, ...above].map(ymn);
}

/** Notes d'un accord écrit en ymn (« 10;1;5 ») ; undefined si l'écriture n'en est pas une. */
export function chordYmnNotes(text: string): number[] | undefined {
  if (!/^\d{1,2}(;\d{1,2})+$/.test(text)) return undefined;
  const notes = text.split(CHORD_NOTE_SEPARATOR).map(Number);
  if (notes.some((n) => n < 1 || n > 12) || new Set(notes).size !== notes.length) return undefined;
  return notes;
}

/** Notes d'un accord, quelle que soit son écriture ; undefined s'il n'est pas reconnu. */
export const chordNotes = (text: string) => chordYmnNotes(text) ?? chordNameNotes(text);

/**
 * Nom anglais d'un accord donné par ses notes (de la basse vers l'aigu). La basse est d'abord
 * essayée comme fondamentale ; sinon l'accord est un renversement noté « /basse ». Undefined
 * si les notes ne forment aucun accord connu.
 */
export function chordName(notes: number[]): string | undefined {
  const set = new Set(notes.map((n) => n - 1));
  const bass = notes[0] - 1;
  const same = (iv: number[], root: number) => iv.length === set.size && iv.every((i) => set.has(pc(root + i)));
  const roots = [bass, ...[...set].filter((p) => p !== bass)];
  for (const root of roots) {
    const q = QUALITIES.find(([, iv]) => same(iv, root));
    if (q) return NAMES[root] + q[0][0] + (root === bass ? "" : "/" + NAMES[bass]);
  }
  return undefined;
}

/** Écriture ymn d'un accord : ses notes séparées par « ; ». */
export const chordYmnText = (notes: number[]) => notes.join(CHORD_NOTE_SEPARATOR);
