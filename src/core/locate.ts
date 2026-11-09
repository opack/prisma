/**
 * De la partition au texte : la place, dans le texte .prisma, d'un signe de la partition gravée.
 *
 * La gravure refait ses propres systèmes : un signe s'y désigne par son instant, sa portée, son
 * octave et ce qui y est écrit (« 5 », « - »). Le texte se relit ici avec indulgence, comme pour la
 * barre de statut : ses systèmes et leurs règles donnent l'instant de chaque case, ses traits la
 * portée de chaque ligne, ses numéros d'octave l'octave.
 */
import { TICKS_PER_BEAT } from "./model.ts";
import { parseOctaveLabel } from "./pitch.ts";
import { isRuler, parseRule } from "./prisma-parse.ts";

/**
 * Un signe de la partition : son instant, sa portée, son couloir et le contenu de sa case. Le
 * couloir est une octave, ou pour un instrument à cordes une corde : STRING_LANE plus son numéro.
 */
export type ScorePlace = { t: number; staff: number; octave?: number; content?: string };

/** Le couloir d'une corde, dans ScorePlace.octave : au-delà de toute octave. */
export const STRING_LANE = 100;
/** Le couloir que nomme le début d'une ligne : une octave (« 0 », « +1 »), ou une corde (« 1 » à « 6 »). */
export const laneOf = (label: string) => parseOctaveLabel(label) ?? (/^[1-9]$/.test(label) ? STRING_LANE + Number(label) : undefined);
/** Le couloir d'une ligne gravée. */
export const rowLane = (row: { octave: number; string?: number }) => (row.string !== undefined ? STRING_LANE + row.string : row.octave);

const isRule = (line: string) => {
  try {
    return !!parseRule(line, 0);
  } catch {
    return true;
  }
};

/** Les temps d'une règle : pour chacun, ses cases (colonne de début, de fin). */
function beatsOf(ruler: string) {
  const seps: { from: number; to: number }[] = [];
  for (let index = ruler.indexOf("|"); index >= 0 && index < ruler.length;) {
    if (ruler[index] === "|" || (ruler[index] === ":" && ruler[index + 1] === "|")) {
      let innerIndex = index;
      while (innerIndex < ruler.length && (ruler[innerIndex] === "|" || ruler[innerIndex] === ":")) innerIndex++;
      seps.push({ from: index, to: innerIndex });
      index = innerIndex;
    } else index++;
  }
  const beats: { start: number; end: number }[][] = [];
  for (let separator = 0; separator + 1 < seps.length; separator++) {
    const from = seps[separator].to,
      to = seps[separator + 1].from;
    const labels = [...ruler.slice(from, to).matchAll(/\S+/g)].map((match) => from + match.index);
    if (!labels.length) continue;
    labels[0] = from;
    beats.push(labels.map((start, index) => ({ start, end: index + 1 < labels.length ? labels[index + 1] : to })));
  }
  return beats;
}

/** Le contenu principal d'une case : le numéro de sa note (sans petites notes ni ajouts), « - » pour une tenue. */
export const mainOf = (cell: string) => {
  const cleaned = cell.trim().replace(/\d+'/g, "");
  return cleaned.startsWith("-") ? "-" : (cleaned.match(/^\d+/)?.[0] ?? "");
};
/** Le même, et pour une tenue nommée (« -7 »), la note qu'elle prolonge. */
const signOf = (cell: string) => {
  const trimmed = cell.trim();
  return /^-\d+/.test(trimmed) ? trimmed.match(/^-\d+/)![0] : mainOf(trimmed);
};

/** Les systèmes du texte : leurs lignes (de first à last), leur règle, ses temps, et le rang de leur premier temps. */
function systems(lines: string[]) {
  // l'en-tête
  let index = 0;
  while (index < lines.length && !lines[index].trim()) index++;
  if (lines[index]?.trim() === "---") {
    const close = lines.findIndex((line, lineIndex) => lineIndex > index && line.trim() === "---");
    index = close < 0 ? lines.length : close + 1;
  } else index = 0;
  const out: { first: number; last: number; ruler: number; beats: { start: number; end: number }[][]; beat0: number }[] = [];
  let beat = 0;
  while (index < lines.length) {
    if (!lines[index].trim()) {
      index++;
      continue;
    }
    let end = index;
    while (end + 1 < lines.length && lines[end + 1].trim()) end++;
    const rulerOffset = lines.slice(index, end + 1).findIndex(isRuler);
    if (rulerOffset >= 0) {
      const beats = beatsOf(lines[index + rulerOffset]);
      out.push({ first: index, last: end, ruler: index + rulerOffset, beats, beat0: beat });
      beat += beats.length;
    }
    index = end + 1;
  }
  return out;
}

const split = (text: string) => text.replace(/\t/g, "    ").split(/\r?\n/);

/** La ligne et la colonne (à partir de 1) d'un signe de la partition, ou rien s'il n'est pas trouvé. */
export function locate(text: string, at: ScorePlace): { line: number; column: number } | undefined {
  const found = findRow(text, at);
  return found && { line: found.line, column: found.column };
}

/**
 * Le même, avec l'octave de la ligne trouvée : celle du signe, ou la plus proche quand ce système
 * du texte n'a pas (encore) de ligne dans son octave.
 */
export function findRow(text: string, at: ScorePlace): { line: number; column: number; octave?: number } | undefined {
  const lines = split(text);
  for (const system of systems(lines)) {
    const first = system.beat0 * TICKS_PER_BEAT;
    if (at.t < first || at.t >= (system.beat0 + system.beats.length) * TICKS_PER_BEAT) continue;
    const beat = system.beats[Math.floor(at.t / TICKS_PER_BEAT) - system.beat0];
    const cellIndex = Math.min(beat.length - 1, Math.floor(((at.t % TICKS_PER_BEAT) * beat.length) / TICKS_PER_BEAT));
    return place(lines, system.ruler, system.last, beat[cellIndex], system.beats.flat(), at);
  }
  return undefined;
}

/**
 * La case de la règle du texte où tombe l'instant tick : la ligne de la règle et la colonne de la
 * case (à partir de 0), le nombre de cases de son temps, et l'instant où ce temps commence.
 */
export function rulerCase(text: string, tick: number): { line: number; column: number; count: number; beatStart: number } | undefined {
  const system = systems(split(text)).find(
    (candidate) => tick >= candidate.beat0 * TICKS_PER_BEAT && tick < (candidate.beat0 + candidate.beats.length) * TICKS_PER_BEAT,
  );
  if (!system) return undefined;
  const beatIndex = Math.floor(tick / TICKS_PER_BEAT);
  const beat = system.beats[beatIndex - system.beat0];
  const cellIndex = Math.min(beat.length - 1, Math.floor(((tick % TICKS_PER_BEAT) * beat.length) / TICKS_PER_BEAT));
  return { line: system.ruler, column: beat[cellIndex].start, count: beat.length, beatStart: beatIndex * TICKS_PER_BEAT };
}

/**
 * Vrai si une case du texte commence à l'instant t. Faux pour une case que la règle détaillée
 * ajoute à la gravure : le texte ne l'a pas, rien ne peut s'y écrire.
 */
export function isWrittenCase(text: string, tick: number): boolean {
  const system = systems(split(text)).find(
    (candidate) => tick >= candidate.beat0 * TICKS_PER_BEAT && tick < (candidate.beat0 + candidate.beats.length) * TICKS_PER_BEAT,
  );
  if (!system) return false;
  const cellCount = system.beats[Math.floor(tick / TICKS_PER_BEAT) - system.beat0].length;
  return ((tick % TICKS_PER_BEAT) * cellCount) % TICKS_PER_BEAT === 0;
}

/**
 * Le chemin inverse : ce que désigne, sur la partition, la ligne et la colonne (à partir de 1)
 * du texte. Sur une ligne de notes : l'instant de sa case, sa portée, son octave, son contenu ; sur
 * une ligne @ ou un trait d'une portée : l'instant et la portée ; sur la règle ou au-dessus d'elle :
 * l'instant seul (toute la hauteur du système). Rien hors d'un système.
 */
export function textPlace(text: string, lineNumber: number, columnNumber: number): ScorePlace | undefined {
  const lines = split(text);
  const lineIndex = lineNumber - 1,
    columnIndex = columnNumber - 1;
  const system = systems(lines).find((candidate) => lineIndex >= candidate.first && lineIndex <= candidate.last);
  if (!system) return undefined;
  const cases = system.beats.flatMap((beat, beatIndex) =>
    beat.map((cell, cellIndex) => ({
      ...cell,
      t: (system.beat0 + beatIndex) * TICKS_PER_BEAT + (cellIndex * TICKS_PER_BEAT) / beat.length,
    })),
  );
  if (!cases.length) return undefined;
  const at =
    cases.find((cell) => columnIndex >= cell.start && columnIndex < cell.end) ??
    (columnIndex < cases[0].start ? cases[0] : cases[cases.length - 1]);
  if (lineIndex <= system.ruler) return { t: at.t, staff: -1 };
  let staff = -1;
  let octave: number | undefined;
  for (let index = system.ruler + 1; index <= lineIndex; index++) {
    const lineText = lines[index];
    if (lineText.startsWith("#")) continue;
    if (isRule(lineText)) {
      staff = index === system.ruler + 1 ? 0 : staff + 1;
      octave = undefined;
      continue;
    }
    if (staff < 0) staff = 0;
    if (lineText.startsWith("@") || !lineText.includes("|")) continue;
    const label = lineText.slice(0, lineText.indexOf("|")).trim();
    if (label) octave = laneOf(label);
  }
  const line = lines[lineIndex];
  if (isRule(line)) return { t: at.t, staff: Math.max(0, staff) };
  if (line.startsWith("@") || !line.includes("|")) return { t: at.t, staff: Math.max(0, staff) };
  return { t: at.t, staff: Math.max(0, staff), octave, content: line.slice(at.start, at.end) };
}

/** Dans le système de règle `ruler`, la ligne du signe, et la colonne de son contenu dans la case `target`. */
function place(
  lines: string[],
  ruler: number,
  end: number,
  target: { start: number; end: number },
  all: { start: number; end: number }[],
  at: ScorePlace,
) {
  const rows: { line: number; content: string; sign: string; octave?: number }[] = [];
  // la note qu'une tenue prolonge sur sa ligne : la dernière attaque avant elle (« -7 » la nomme)
  const held = (line: string) => {
    for (let index = all.findIndex((cell) => cell.start === target.start); index >= 0; index--) {
      const cell = line.slice(all[index].start, all[index].end).trim().replace(/\d+'/g, "");
      const name = cell.match(/^-?(\d+)/)?.[1];
      if (name) return name;
      if (!cell.startsWith("-")) return undefined;
    }
    return undefined;
  };
  let staff = -1;
  let octave: number | undefined;
  for (let lineIndex = ruler + 1; lineIndex <= end; lineIndex++) {
    const line = lines[lineIndex];
    if (line.startsWith("#")) continue;
    if (isRule(line)) {
      staff = lineIndex === ruler + 1 ? 0 : staff + 1;
      octave = undefined;
      continue;
    }
    if (staff < 0) staff = 0;
    if (line.startsWith("@") || !line.includes("|")) continue;
    const label = line.slice(0, line.indexOf("|")).trim();
    if (label) octave = laneOf(label);
    if (staff === at.staff) {
      const content = line.slice(target.start, target.end);
      // une tenue se reconnaît à la note qu'elle prolonge
      const hold = mainOf(content) === "-" ? held(line) : undefined;
      rows.push({ line: lineIndex, content, sign: hold ? "-" + hold : signOf(content), octave });
    }
  }
  // les lignes de l'octave cliquée ; sans elles (la gravure montre un couloir que ce système du
  // texte n'a pas encore), celles de l'octave la plus proche dans la portée
  const gap = (lane?: number) => (at.octave === undefined || lane === undefined ? 0 : Math.abs(lane - at.octave));
  const best = Math.min(...rows.map((candidate) => gap(candidate.octave)));
  const near = rows.filter((candidate) => gap(candidate.octave) === best);
  if (!near.length) return undefined;
  if (best > 0) return { ...column(near[0], target), octave: near[0].octave };
  rows.splice(0, rows.length, ...near);
  const want = at.content === undefined ? undefined : signOf(at.content);
  // la ligne qui porte ce contenu ; à défaut, une case vide, puis la première ligne de l'octave
  const row =
    (want ? rows.find((candidate) => candidate.sign === want) : undefined) ??
    (want?.startsWith("-") ? rows.find((candidate) => mainOf(candidate.content) === "-") : undefined) ??
    rows.find((candidate) => !candidate.content.trim()) ??
    rows[0];
  return { ...column(row, target), octave: row.octave };
}

/** La place du contenu d'une case sur sa ligne (son début, ou celui de la case vide). */
function column(row: { line: number; content: string }, target: { start: number }) {
  const lead = row.content.length - row.content.trimStart().length;
  return { line: row.line + 1, column: target.start + (row.content.trim() ? lead : 0) + 1 };
}
