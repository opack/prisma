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
export const rowLane = (r: { octave: number; string?: number }) => (r.string !== undefined ? STRING_LANE + r.string : r.octave);

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
  for (let i = ruler.indexOf("|"); i >= 0 && i < ruler.length; ) {
    if (ruler[i] === "|" || (ruler[i] === ":" && ruler[i + 1] === "|")) {
      let j = i;
      while (j < ruler.length && (ruler[j] === "|" || ruler[j] === ":")) j++;
      seps.push({ from: i, to: j });
      i = j;
    } else i++;
  }
  const beats: { start: number; end: number }[][] = [];
  for (let k = 0; k + 1 < seps.length; k++) {
    const from = seps[k].to, to = seps[k + 1].from;
    const labels = [...ruler.slice(from, to).matchAll(/\S+/g)].map((m) => from + m.index);
    if (!labels.length) continue;
    labels[0] = from;
    beats.push(labels.map((start, i) => ({ start, end: i + 1 < labels.length ? labels[i + 1] : to })));
  }
  return beats;
}

/** Le contenu principal d'une case : le numéro de sa note (sans petites notes ni ajouts), « - » pour une tenue. */
export const mainOf = (cell: string) => {
  const c = cell.trim().replace(/\d+'/g, "");
  return c.startsWith("-") ? "-" : (c.match(/^\d+/)?.[0] ?? "");
};
/** Le même, et pour une tenue nommée (« -7 »), la note qu'elle prolonge. */
const signOf = (cell: string) => {
  const c = cell.trim();
  return /^-\d+/.test(c) ? c.match(/^-\d+/)![0] : mainOf(c);
};

/** Les systèmes du texte : leurs lignes (de first à last), leur règle, ses temps, et le rang de leur premier temps. */
function systems(lines: string[]) {
  // l'en-tête
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (lines[i]?.trim() === "---") {
    const close = lines.findIndex((l, k) => k > i && l.trim() === "---");
    i = close < 0 ? lines.length : close + 1;
  } else i = 0;
  const out: { first: number; last: number; R: number; beats: { start: number; end: number }[][]; beat0: number }[] = [];
  let beat = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < lines.length && lines[end + 1].trim()) end++;
    const r = lines.slice(i, end + 1).findIndex(isRuler);
    if (r >= 0) {
      const beats = beatsOf(lines[i + r]);
      out.push({ first: i, last: end, R: i + r, beats, beat0: beat });
      beat += beats.length;
    }
    i = end + 1;
  }
  return out;
}

const split = (text: string) => text.replace(/\t/g, "    ").split(/\r?\n/);

/** La ligne et la colonne (à partir de 1) d'un signe de la partition, ou rien s'il n'est pas trouvé. */
export function locate(text: string, at: ScorePlace): { line: number; column: number } | undefined {
  const r = findRow(text, at);
  return r && { line: r.line, column: r.column };
}

/**
 * Le même, avec l'octave de la ligne trouvée : celle du signe, ou la plus proche quand ce système
 * du texte n'a pas (encore) de ligne dans son octave.
 */
export function findRow(text: string, at: ScorePlace): { line: number; column: number; octave?: number } | undefined {
  const lines = split(text);
  for (const s of systems(lines)) {
    const first = s.beat0 * TICKS_PER_BEAT;
    if (at.t < first || at.t >= (s.beat0 + s.beats.length) * TICKS_PER_BEAT) continue;
    const b = s.beats[Math.floor(at.t / TICKS_PER_BEAT) - s.beat0];
    const k = Math.min(b.length - 1, Math.floor(((at.t % TICKS_PER_BEAT) * b.length) / TICKS_PER_BEAT));
    return place(lines, s.R, s.last, b[k], s.beats.flat(), at);
  }
  return undefined;
}

/**
 * Le chemin inverse : ce que désigne, sur la partition, la ligne L et la colonne C (à partir de 1)
 * du texte. Sur une ligne de notes : l'instant de sa case, sa portée, son octave, son contenu ; sur
 * une ligne @ ou un trait d'une portée : l'instant et la portée ; sur la règle ou au-dessus d'elle :
 * l'instant seul (toute la hauteur du système). Rien hors d'un système.
 */
export function textPlace(text: string, L: number, C: number): ScorePlace | undefined {
  const lines = split(text);
  const k = L - 1, c = C - 1;
  const s = systems(lines).find((x) => k >= x.first && k <= x.last);
  if (!s) return undefined;
  const cases = s.beats.flatMap((b, bi) => b.map((x, ci) => ({ ...x, t: (s.beat0 + bi) * TICKS_PER_BEAT + (ci * TICKS_PER_BEAT) / b.length })));
  if (!cases.length) return undefined;
  const at = cases.find((x) => c >= x.start && c < x.end) ?? (c < cases[0].start ? cases[0] : cases[cases.length - 1]);
  if (k <= s.R) return { t: at.t, staff: -1 };
  let staff = -1;
  let octave: number | undefined;
  for (let i = s.R + 1; i <= k; i++) {
    const l = lines[i];
    if (l.startsWith("#")) continue;
    if (isRule(l)) {
      staff = i === s.R + 1 ? 0 : staff + 1;
      octave = undefined;
      continue;
    }
    if (staff < 0) staff = 0;
    if (l.startsWith("@") || !l.includes("|")) continue;
    const label = l.slice(0, l.indexOf("|")).trim();
    if (label) octave = laneOf(label);
  }
  const line = lines[k];
  if (isRule(line)) return { t: at.t, staff: Math.max(0, staff) };
  if (line.startsWith("@") || !line.includes("|")) return { t: at.t, staff: Math.max(0, staff) };
  return { t: at.t, staff: Math.max(0, staff), octave, content: line.slice(at.start, at.end) };
}

/** Dans le système de règle R, la ligne du signe, et la colonne de son contenu dans la case c. */
function place(lines: string[], R: number, end: number, c: { start: number; end: number }, all: { start: number; end: number }[], at: ScorePlace) {
  const rows: { line: number; content: string; sign: string; octave?: number }[] = [];
  // la note qu'une tenue prolonge sur sa ligne : la dernière attaque avant elle (« -7 » la nomme)
  const held = (line: string) => {
    for (let k = all.findIndex((x) => x.start === c.start); k >= 0; k--) {
      const cell = line.slice(all[k].start, all[k].end).trim().replace(/\d+'/g, "");
      const n = cell.match(/^-?(\d+)/)?.[1];
      if (n) return n;
      if (!cell.startsWith("-")) return undefined;
    }
    return undefined;
  };
  let staff = -1;
  let octave: number | undefined;
  for (let k = R + 1; k <= end; k++) {
    const l = lines[k];
    if (l.startsWith("#")) continue;
    if (isRule(l)) {
      staff = k === R + 1 ? 0 : staff + 1;
      octave = undefined;
      continue;
    }
    if (staff < 0) staff = 0;
    if (l.startsWith("@") || !l.includes("|")) continue;
    const label = l.slice(0, l.indexOf("|")).trim();
    if (label) octave = laneOf(label);
    if (staff === at.staff) {
      const content = l.slice(c.start, c.end);
      // une tenue se reconnaît à la note qu'elle prolonge
      const hold = mainOf(content) === "-" ? held(l) : undefined;
      rows.push({ line: k, content, sign: hold ? "-" + hold : signOf(content), octave });
    }
  }
  // les lignes de l'octave cliquée ; sans elles (la gravure montre un couloir que ce système du
  // texte n'a pas encore), celles de l'octave la plus proche dans la portée
  const gap = (o?: number) => (at.octave === undefined || o === undefined ? 0 : Math.abs(o - at.octave));
  const best = Math.min(...rows.map((x) => gap(x.octave)));
  const near = rows.filter((x) => gap(x.octave) === best);
  if (!near.length) return undefined;
  if (best > 0) return { ...column(near[0], c), octave: near[0].octave };
  rows.splice(0, rows.length, ...near);
  const want = at.content === undefined ? undefined : signOf(at.content);
  // la ligne qui porte ce contenu ; à défaut, une case vide, puis la première ligne de l'octave
  const row =
    (want ? rows.find((x) => x.sign === want) : undefined) ??
    (want?.startsWith("-") ? rows.find((x) => mainOf(x.content) === "-") : undefined) ??
    rows.find((x) => !x.content.trim()) ??
    rows[0];
  return { ...column(row, c), octave: row.octave };
}

/** La place du contenu d'une case sur sa ligne (son début, ou celui de la case vide). */
function column(row: { line: number; content: string }, c: { start: number }) {
  const lead = row.content.length - row.content.trimStart().length;
  return { line: row.line + 1, column: c.start + (row.content.trim() ? lead : 0) + 1 };
}
