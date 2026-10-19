/**
 * Retouche sur place : changer, depuis la partition, la note d'une case. Le signe cliqué se
 * retrouve dans le texte (voir locate), sa case y est réécrite sans casser l'alignement (voir
 * complete.ts). Un clic dans un couloir d'octave que ce système du texte n'a pas encore y ouvre la
 * ligne de cette octave, à sa place dans la portée (de l'aigu au grave).
 */
import { CENTRAL_OCTAVE, parseOctaveLabel } from "../core/pitch.ts";
import { findRow, textPlace } from "../core/locate.ts";
import { TICKS_PER_BEAT } from "../core/model.ts";
import type { ScorePlace } from "../core/locate.ts";
import { isRuler, parseRule } from "../core/prisma-parse.ts";
import { cases, noteLine, systemOf, writeCase } from "./complete.ts";
import type { Case, System } from "./complete.ts";

const isRule = (line: string) => {
  try {
    return !!parseRule(line, 0);
  } catch {
    return true;
  }
};

/** La case cliquée, dans le texte : ce qu'elle contient, et si une tenue peut s'y écrire. */
export function cellOf(text: string, at: ScorePlace) {
  const lines = text.split("\n");
  const r = findRow(text, at);
  if (!r) return undefined;
  const exact = r.octave === at.octave;
  const L = r.line - 1;
  const sys = systemOf(lines, L);
  if (!sys) return undefined;
  const ruler = lines[sys.ruler];
  const all = cases(ruler);
  const k = all.findIndex((c) => r.column - 1 >= c.start && r.column - 1 < c.end);
  if (k < 0) return undefined;
  const content = exact ? lines[L].slice(all[k].start, all[k].end).trim() : "";
  // une tenue prolonge la note de la case d'avant, sur la même ligne
  const before = exact && k > 0 ? lines[L].slice(all[k - 1].start, all[k - 1].end).trim() : "";
  return { content, canHold: !!before, exact };
}

/**
 * Le texte après la retouche : content écrit dans la case du signe at (« 5 », « - », ou rien pour
 * vider la case), et la place du curseur ensuite (ligne et colonne, à partir de 1).
 *
 * Une note écrite à la place d'une tenue y joue une note nouvelle : la note d'avant s'arrête là, et
 * ses tenues suivantes disparaissent (jusque dans le système suivant, où elle continuait par « -7 »).
 * De même pour une case vidée. Une note écrite à la place d'une autre garde ses tenues : on change
 * sa hauteur, pas sa durée.
 */
export function retouch(text: string, at: ScorePlace, content: string): { text: string; line: number; column: number } | undefined {
  let lines = text.split("\n");
  const r = findRow(text, at);
  if (!r) return undefined;
  let L = r.line - 1;
  if (r.octave !== at.octave) {
    if (!content || at.octave === undefined) return undefined;
    // la ligne de l'octave manque : elle s'ouvre à sa place dans la portée
    const sys = systemOf(lines, L);
    if (!sys) return undefined;
    L = insertionLine(lines, sys.ruler, sys.last, at.staff, at.octave);
    const o = at.octave - CENTRAL_OCTAVE;
    lines = [...lines.slice(0, L), noteLine(lines[sys.ruler], o > 0 ? `+${o}` : String(o)), ...lines.slice(L)];
  }
  const sys = systemOf(lines, L);
  if (!sys) return undefined;
  const all = cases(lines[sys.ruler]);
  const k = all.findIndex((x) => r.column - 1 >= x.start && r.column - 1 < x.end);
  if (k < 0) return undefined;
  const old = lines[L].slice(all[k].start, all[k].end).trim();
  const held = heldBefore(lines[L], all, k);
  const w = writeCase(lines, sys, L, all[k], content);
  lines = lines.map((l, i) => w.lines.get(i) ?? l);
  // la note d'avant s'arrête ici : ses tenues suivantes s'effacent
  const ends = content === "" ? !!old : old.startsWith("-") && content !== "-";
  if (ends) lines = clearHolds(lines, L, k + 1, old.startsWith("-") ? held : old.match(/^(\d+')*(\d+)/)?.[2]);
  return { text: lines.join("\n"), line: w.caret.line + 1, column: all[k].start + 1 };
}

/** La note que prolonge la case k d'une ligne : la dernière attaque avant elle (« -7 » la nomme). */
function heldBefore(line: string, all: Case[], k: number) {
  for (let i = k; i >= 0; i--) {
    const cell = line.slice(all[i].start, all[i].end).trim().replace(/\d+'/g, "");
    const n = cell.match(/^-?(\d+)/)?.[1];
    if (n && (i < k || cell.startsWith("-"))) return n;
    if (i < k && !cell.startsWith("-")) return undefined;
  }
  return undefined;
}

/**
 * Efface les tenues de la ligne L à partir de la case k ; si elles vont jusqu'au bout du système,
 * la tenue « -N » qui ouvre la même ligne d'octave du système suivant, et les siennes.
 */
function clearHolds(lines: string[], L: number, k: number, note: string | undefined): string[] {
  for (let guard = 0; guard < 64; guard++) {
    const sys = systemOf(lines, L);
    if (!sys) return lines;
    const all = cases(lines[sys.ruler]);
    let i = k;
    for (; i < all.length; i++) {
      const cell = lines[L].slice(all[i].start, all[i].end).trim();
      if (!cell.startsWith("-")) return lines;
      const w = writeCase(lines, sys, L, all[i], "");
      lines = lines.map((l, j) => w.lines.get(j) ?? l);
    }
    // jusqu'au bout du système : la note continuait peut-être dans le suivant
    if (!note) return lines;
    const place = textPlace(lines.join("\n"), L + 1, all[all.length - 1].start + 1);
    if (!place) return lines;
    const next = (Math.floor(place.t / TICKS_PER_BEAT) + 1) * TICKS_PER_BEAT;
    const r = findRow(lines.join("\n"), { t: next, staff: place.staff, octave: place.octave, content: "-" + note });
    if (!r || r.octave !== place.octave || r.line - 1 <= L) return lines;
    const nl = lines[r.line - 1];
    const ns = systemOf(lines, r.line - 1);
    const first = ns && cases(lines[ns.ruler])[0];
    if (!first || r.column - 1 !== first.start || nl.slice(first.start, first.end).trim() !== "-" + note) return lines;
    L = r.line - 1;
    k = 0;
  }
  return lines;
}

/**
 * Où ouvrir la ligne d'une octave dans une portée : après les lignes des octaves plus aiguës (et
 * leurs lignes sans numéro), avant celles des plus graves et les lignes @.
 */
function insertionLine(lines: string[], R: number, last: number, staff: number, octave: number) {
  let s = -1;
  let current: number | undefined;
  let at = -1;
  for (let k = R + 1; k <= last; k++) {
    const l = lines[k];
    if (isRule(l)) {
      if (s === staff) return at >= 0 ? at : k;
      s = k === R + 1 ? 0 : s + 1;
      current = undefined;
      if (s === staff) at = k + 1;
      continue;
    }
    if (s < 0) {
      s = 0;
      if (s === staff) at = k;
    }
    if (s !== staff) continue;
    if (l.startsWith("@")) return at;
    if (isRuler(l) || l.startsWith("#") || !l.includes("|")) continue;
    const label = parseOctaveLabel(l.slice(0, l.indexOf("|")).trim());
    if (label !== undefined) current = label;
    // une ligne d'une octave plus aiguë : la nouvelle ligne vient après elle
    if (current !== undefined && current > octave) at = k + 1;
    else return at;
  }
  return at >= 0 ? at : last + 1;
}

// la durée d'une note, depuis la note elle-même : ses tenues, ligne du texte par ligne du texte

/** Une case d'une ligne du texte : la ligne (à partir de 0) et le rang de la case dans son système. */
type Pos = { L: number; k: number };

/** La note qu'attaque une case (« 5 », « 3'5_2 »), sans ses ajouts. */
const attackOf = (cell: string) => (cell.startsWith("-") ? undefined : cell.match(/^(\d+')*(\d+)/)?.[2]);

function casesAt(lines: string[], L: number) {
  const sys = systemOf(lines, L);
  return sys ? { sys, all: cases(lines[sys.ruler]) } : undefined;
}
const cellAt = (lines: string[], p: Pos) => {
  const c = casesAt(lines, p.L);
  return c && c.all[p.k] ? lines[p.L].slice(c.all[p.k].start, c.all[p.k].end).trim() : "";
};

/** La portée et l'octave d'une ligne de notes. */
function laneOf(lines: string[], L: number) {
  const pipe = lines[L].indexOf("|");
  const p = textPlace(lines.join("\n"), L + 1, pipe + 2);
  return p && { staff: p.staff, octave: p.octave };
}

/** Les lignes de notes d'un système dans une portée et une octave. */
function laneLines(lines: string[], sys: System, staff: number, octave?: number) {
  const out: number[] = [];
  for (let k = sys.ruler + 1; k <= sys.last; k++) {
    const l = lines[k];
    if (l.startsWith("@") || l.startsWith("#") || !l.includes("|") || isRule(l)) continue;
    const lane = laneOf(lines, k);
    if (lane && lane.staff === staff && lane.octave === octave) out.push(k);
  }
  return out;
}

/** Le système d'avant (dir -1) ou d'après (dir 1). */
function nextSystem(lines: string[], sys: System, dir: 1 | -1) {
  let i = dir > 0 ? sys.last + 1 : sys.first - 1;
  while (i >= 0 && i < lines.length && !lines[i].trim()) i += dir;
  return i >= 0 && i < lines.length ? systemOf(lines, i) : undefined;
}

/** La place, dans le texte, du signe at de la partition (la ligne de son octave seulement). */
function posOf(text: string, at: ScorePlace): Pos | undefined {
  const r = findRow(text, at);
  if (!r || r.octave !== at.octave) return undefined;
  const lines = text.split("\n");
  const c = casesAt(lines, r.line - 1);
  const k = c?.all.findIndex((x) => r.column - 1 >= x.start && r.column - 1 < x.end) ?? -1;
  return k < 0 ? undefined : { L: r.line - 1, k };
}

/** La case d'avant sur la même ligne d'octave, jusque dans le système d'avant pour la première. */
function before(lines: string[], p: Pos, note: string): Pos | undefined {
  if (p.k > 0) return { L: p.L, k: p.k - 1 };
  const here = casesAt(lines, p.L), lane = laneOf(lines, p.L);
  const prev = here && lane && nextSystem(lines, here.sys, -1);
  if (!prev || !lane) return undefined;
  const last = cases(lines[prev.ruler]).length - 1;
  for (const L of laneLines(lines, prev, lane.staff, lane.octave)) {
    const c = cellAt(lines, { L, k: last });
    if (attackOf(c) === note || (c.startsWith("-") && heldBefore(lines[L], cases(lines[prev.ruler]), last) === note)) return { L, k: last };
  }
  return undefined;
}

/** La case d'après sur la même ligne d'octave ; au bout du système, celle qui ouvre la suivante (« -N » ou vide). */
function after(lines: string[], p: Pos, note: string): Pos | undefined {
  const here = casesAt(lines, p.L);
  if (!here) return undefined;
  if (p.k + 1 < here.all.length) return { L: p.L, k: p.k + 1 };
  const lane = laneOf(lines, p.L);
  const next = lane && nextSystem(lines, here.sys, 1);
  if (!next || !lane) return undefined;
  const rows = laneLines(lines, next, lane.staff, lane.octave);
  const L = rows.find((L) => cellAt(lines, { L, k: 0 }) === "-" + note) ?? rows.find((L) => !cellAt(lines, { L, k: 0 }));
  return L === undefined ? undefined : { L, k: 0 };
}

/** La note d'une case (son attaque ou une de ses tenues) : son numéro, et ses cases, de l'attaque à la dernière tenue. */
function noteAt(lines: string[], p: Pos) {
  let cur = p;
  let note = attackOf(cellAt(lines, cur));
  // en arrière jusqu'à l'attaque
  for (let guard = 0; !note && guard < 512; guard++) {
    const c = cellAt(lines, cur);
    if (!c.startsWith("-")) return undefined;
    const named = c.match(/^-(\d+)/)?.[1];
    const k0 = casesAt(lines, cur.L)?.all;
    const n = named ?? (k0 ? heldBefore(lines[cur.L], k0, cur.k) : undefined);
    const prev = n ? before(lines, cur, n) : undefined;
    if (!prev) {
      // la note commence avant le texte lu : on part de sa première tenue connue
      if (!n) return undefined;
      note = n;
      break;
    }
    cur = prev;
    note = attackOf(cellAt(lines, cur));
  }
  if (!note) return undefined;
  const chain: Pos[] = [cur];
  for (let guard = 0; guard < 512; guard++) {
    const next = after(lines, chain[chain.length - 1], note);
    if (!next) break;
    const c = cellAt(lines, next);
    if (c !== "-" && c !== "-" + note) break;
    chain.push(next);
  }
  return { note, chain };
}

/** Écrit content dans la case p. */
function write(lines: string[], p: Pos, content: string) {
  const c = casesAt(lines, p.L)!;
  const w = writeCase(lines, c.sys, p.L, c.all[p.k], content);
  return lines.map((l, i) => w.lines.get(i) ?? l);
}

/** Ce qui sort d'une retouche : le texte, et où mettre le curseur (à partir de 1). */
type Done = { text: string; line: number; column: number };
const done = (lines: string[], p: Pos): Done => {
  const c = casesAt(lines, p.L)!;
  return { text: lines.join("\n"), line: p.L + 1, column: c.all[p.k].start + 1 };
};

/**
 * La durée de la note d'une case de la partition (son attaque ou une de ses tenues) : son nombre
 * de cases, et si elle peut s'allonger (la case d'après est libre sur sa ligne) ou se raccourcir.
 */
export function durationOf(text: string, at: ScorePlace) {
  const lines = text.split("\n");
  const p = posOf(text, at);
  const n = p && noteAt(lines, p);
  if (!n) return undefined;
  const end = n.chain[n.chain.length - 1];
  // la note désignée par son attaque : elle le reste quand ses tenues changent
  const start = n.chain[0];
  const c = casesAt(lines, start.L)!;
  const place = textPlace(text, start.L + 1, c.all[start.k].start + 1);
  const attack: ScorePlace = { t: place?.t ?? at.t, staff: at.staff, octave: at.octave, content: cellAt(lines, start).startsWith("-") ? cellAt(lines, start) : n.note };
  // elle peut toujours s'allonger, sauf au bout du morceau (une case prise la fait changer de ligne)
  const here = casesAt(lines, end.L)!;
  const longer = end.k + 1 < here.all.length || !!nextSystem(lines, here.sys, 1);
  return { note: n.note, count: n.chain.length, longer, shorter: n.chain.length > 1, attack };
}

/** Allonge (by 1) ou raccourcit (by -1) d'une case la note d'une case de la partition. */
export function resize(text: string, at: ScorePlace, by: 1 | -1): Done | undefined {
  let lines = text.split("\n");
  const p = posOf(text, at);
  const n = p && noteAt(lines, p);
  if (!n) return undefined;
  const end = n.chain[n.chain.length - 1];
  if (by < 0) return n.chain.length > 1 ? done(write(lines, end, ""), n.chain[n.chain.length - 2]) : undefined;
  const here = casesAt(lines, end.L)!;
  const lane = laneOf(lines, end.L);
  if (!lane) return undefined;
  if (end.k + 1 < here.all.length) {
    const next = { L: end.L, k: end.k + 1 };
    if (!cellAt(lines, next)) return done(write(lines, next, "-"), next);
    // la case d'après est prise sur cette ligne : la note passe sur une ligne de son octave où
    // elle a la place (ou sur une ligne de plus), avec ses cases de ce système, puis s'allonge
    const ks = n.chain.filter((c) => c.L === end.L).map((c) => c.k);
    const free = freeLine(lines, here.sys, lane.staff, lane.octave, [...ks, next.k], end.L);
    lines = free.lines;
    const from = end.L;
    for (const k of ks) {
      const content = cellAt(lines, { L: from, k });
      lines = write(lines, { L: from, k }, "");
      lines = write(lines, { L: free.L, k }, content);
    }
    const to = { L: free.L, k: next.k };
    return done(write(lines, to, "-"), to);
  }
  // au bout du système : la note continue dans le suivant, sur une ligne de son octave libre au début
  const ns = nextSystem(lines, here.sys, 1);
  if (!ns) return undefined;
  const free = freeLine(lines, ns, lane.staff, lane.octave, [0]);
  const to = { L: free.L, k: 0 };
  return done(write(free.lines, to, "-" + n.note), to);
}

/**
 * Une ligne d'une octave d'un système dont les cases ks sont libres (autre que la ligne except) ;
 * sans elle, une ligne de plus, ouverte sous les lignes de l'octave (ou à sa place dans la portée
 * quand le système n'a pas encore cette octave).
 */
function freeLine(lines: string[], sys: System, staff: number, octave: number | undefined, ks: number[], except?: number) {
  const rows = laneLines(lines, sys, staff, octave);
  const L = rows.find((L) => L !== except && ks.every((k) => !cellAt(lines, { L, k })));
  if (L !== undefined) return { lines, L };
  const ruler = lines[sys.ruler];
  let at: number;
  let label = "";
  if (rows.length) at = rows[rows.length - 1] + 1;
  else {
    if (octave === undefined) return { lines, L: sys.ruler + 1 };
    at = insertionLine(lines, sys.ruler, sys.last, staff, octave);
    const o = octave - CENTRAL_OCTAVE;
    label = o > 0 ? `+${o}` : String(o);
  }
  return { lines: [...lines.slice(0, at), noteLine(ruler, label), ...lines.slice(at)], L: at };
}

/**
 * Les notes qu'une case vide peut tenir : celles de son couloir qui se sont arrêtées avant elle,
 * chacune sur sa ligne du texte, sans autre note entre elles et la case (la plus proche d'abord).
 */
export function holdChoices(text: string, at: ScorePlace): string[] {
  const lines = text.split("\n");
  const p = posOf(text, at);
  if (!p) return [];
  const here = casesAt(lines, p.L), lane = laneOf(lines, p.L);
  if (!here || !lane) return [];
  const found: { note: string; from: number }[] = [];
  for (const L of laneLines(lines, here.sys, lane.staff, lane.octave)) {
    const n = lastNote(lines, { L, k: p.k });
    if (n && !found.some((f) => f.note === n.note)) found.push(n);
  }
  return found.sort((a, b) => b.from - a.from).map((f) => f.note);
}

/**
 * La dernière note avant la case vide p sur sa ligne, s'il n'y a que des cases vides entre elles :
 * son numéro, et la première case vide après elle (d'où la tenir). En remontant jusqu'au début du
 * système, une note de ce couloir qui sonnait au bout du système d'avant.
 */
function lastNote(lines: string[], p: Pos): { note: string; from: number } | undefined {
  if (cellAt(lines, p)) return undefined;
  const all = casesAt(lines, p.L)!.all;
  for (let k = p.k - 1; k >= 0; k--) {
    const c = cellAt(lines, { L: p.L, k });
    if (!c) continue;
    const note = attackOf(c) ?? (c.startsWith("-") ? heldBefore(lines[p.L], all, k) : undefined);
    return note ? { note, from: k + 1 } : undefined;
  }
  // la ligne est vide jusqu'au début du système : la note qui sonnait au bout du système d'avant
  const here = casesAt(lines, p.L), lane = laneOf(lines, p.L);
  const prev = here && lane && nextSystem(lines, here.sys, -1);
  if (!prev || !lane) return undefined;
  const pa = cases(lines[prev.ruler]), last = pa.length - 1;
  for (const L of laneLines(lines, prev, lane.staff, lane.octave)) {
    const c = cellAt(lines, { L, k: last });
    const n = attackOf(c) ?? (c.startsWith("-") ? heldBefore(lines[L], pa, last) : undefined);
    // une note qui ne continue pas déjà ailleurs dans ce système
    if (n && !laneLines(lines, here.sys, lane.staff, lane.octave).some((M) => cellAt(lines, { L: M, k: 0 }) === "-" + n)) return { note: n, from: 0 };
  }
  return undefined;
}

/** Tient la note note jusqu'à la case vide at : des tenues sur sa ligne, de son arrêt à cette case. */
export function holdIn(text: string, at: ScorePlace, note: string): Done | undefined {
  let lines = text.split("\n");
  const p = posOf(text, at);
  if (!p) return undefined;
  const here = casesAt(lines, p.L), lane = laneOf(lines, p.L);
  if (!here || !lane) return undefined;
  for (const L of laneLines(lines, here.sys, lane.staff, lane.octave)) {
    const n = lastNote(lines, { L, k: p.k });
    if (n?.note !== note) continue;
    // dans le système suivant, la première tenue nomme sa note
    for (let k = n.from; k <= p.k; k++) lines = write(lines, { L, k }, k === 0 ? "-" + note : "-");
    return done(lines, { L, k: p.k });
  }
  return undefined;
}

// les ajouts à une note : petites notes devant, trille, doigté

/** Une case qui attaque une note, en morceaux : ses petites notes, sa note, sa trille, son doigt. */
export type CellParts = { graces: string[]; note: string; trill?: string; finger?: string };

/** Les morceaux d'une case qui attaque une note (« 3'5~7_2 »), ou rien pour une tenue ou une case vide. */
export function splitCell(cell: string): CellParts | undefined {
  const m = cell.trim().match(/^((?:\d+')*)(\d+)(?:~(\d+))?(?:_(\d))?$/);
  if (!m) return undefined;
  return { graces: m[1] ? m[1].split("'").filter(Boolean) : [], note: m[2], trill: m[3], finger: m[4] };
}

/** La case réécrite d'après ses morceaux. */
export const joinCell = (p: CellParts) => p.graces.map((g) => g + "'").join("") + p.note + (p.trill ? "~" + p.trill : "") + (p.finger ? "_" + p.finger : "");
