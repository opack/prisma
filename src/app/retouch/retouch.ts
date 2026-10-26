/**
 * Retouche sur place : changer, depuis la partition, la note d'une case. Le signe cliqué se
 * retrouve dans le texte (voir locate), sa case y est réécrite sans casser l'alignement (voir
 * complete.ts). Un clic dans un couloir que ce système du texte n'a pas encore y ouvre sa ligne, à
 * sa place dans la portée (les octaves de l'aigu au grave, les cordes de la 1 à la plus grave).
 * Une corde n'a qu'une ligne par système : une note n'y prend pas une case déjà prise.
 */
import { CENTRAL_OCTAVE } from "../../core/pitch.ts";
import { MAX_FRET } from "../../core/index.ts";
import { STRING_LANE, findRow, laneOf as laneOfLabel, textPlace } from "../../core/locate.ts";
import { TICKS_PER_BEAT } from "../../core/model.ts";
import type { ScorePlace } from "../../core/locate.ts";
import { isRuler, parseRule } from "../../core/prisma-parse.ts";
import { cases, noteLine, systemOf, writeCase } from "../editor/complete.ts";
import type { Case, System } from "../editor/complete.ts";

/** Une case de corde sans son glissé d'entrée (« //7 » : 7), pour en lire la case. */
const unslid = (cell: string) => cell.replace(/^(?:\/\/|\\\\)/, "");

/** Un couloir de corde (et non d'octave). */
const isString = (lane?: number) => lane !== undefined && lane >= STRING_LANE;
/** Le numéro qui ouvre la ligne d'un couloir : « +1 », « -2 » pour une octave, « 3 » pour une corde. */
const laneLabel = (lane: number) => {
  if (isString(lane)) return String(lane - STRING_LANE);
  const o = lane - CENTRAL_OCTAVE;
  return o > 0 ? `+${o}` : String(o);
};
/** L'ordre des couloirs dans une portée, de haut en bas : l'octave la plus aiguë, la corde 1 d'abord. */
const rankOf = (lane: number) => (isString(lane) ? lane : -lane);

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
    lines = [...lines.slice(0, L), noteLine(lines[sys.ruler], laneLabel(at.octave)), ...lines.slice(L)];
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
  if (ends) lines = clearHolds(lines, L, k + 1, old.startsWith("-") ? held : unslid(old).match(/^(\d+')*(\d+)/)?.[2]);
  return { text: lines.join("\n"), line: w.caret.line + 1, column: all[k].start + 1 };
}

/** La note que prolonge la case k d'une ligne : la dernière attaque avant elle (« -7 » la nomme). */
function heldBefore(line: string, all: Case[], k: number) {
  for (let i = k; i >= 0; i--) {
    const cell = unslid(line.slice(all[i].start, all[i].end).trim().replace(/\d+'/g, ""));
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
 * Où ouvrir la ligne d'un couloir dans une portée : après les lignes des couloirs d'au-dessus (et
 * leurs lignes sans numéro), avant celles d'en dessous et les lignes @.
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
    const label = laneOfLabel(l.slice(0, l.indexOf("|")).trim());
    if (label !== undefined) current = label;
    // une ligne d'un couloir d'au-dessus : la nouvelle ligne vient après elle
    if (current !== undefined && rankOf(current) < rankOf(octave)) at = k + 1;
    else return at;
  }
  return at >= 0 ? at : last + 1;
}

// la durée d'une note, depuis la note elle-même : ses tenues, ligne du texte par ligne du texte

/** Une case d'une ligne du texte : la ligne (à partir de 0) et le rang de la case dans son système. */
type Pos = { L: number; k: number };

/** La note qu'attaque une case (« 5 », « 3'5_2 »), sans ses ajouts. */
const attackOf = (cell: string) => (cell.startsWith("-") ? undefined : unslid(cell).match(/^(\d+')*(\d+)/)?.[2]);

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
  // elle peut toujours s'allonger, sauf au bout du morceau (une case prise la fait changer de
  // ligne) ; sur une corde, seulement si la case d'après est libre
  const here = casesAt(lines, end.L)!;
  const longer = isString(at.octave) ? !!resize(text, attack, 1) : end.k + 1 < here.all.length || !!nextSystem(lines, here.sys, 1);
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
    if (!free) return undefined;
    lines = free.lines;
    const from = end.L;
    for (const k of ks) {
      const content = cellAt(lines, { L: from, k });
      lines = write(lines, { L: from, k }, "");
      lines = write(lines, { L: free.L, k }, content);
    }
    lines = write(lines, { L: free.L, k: next.k }, "-");
    const dropped = dropIfEmpty(lines, from);
    const to = { L: dropped !== lines && from < free.L ? free.L - 1 : free.L, k: next.k };
    return done(dropped, to);
  }
  // au bout du système : la note continue dans le suivant, sur une ligne de son octave libre au début
  const ns = nextSystem(lines, here.sys, 1);
  if (!ns) return undefined;
  const free = freeLine(lines, ns, lane.staff, lane.octave, [0]);
  if (!free) return undefined;
  const to = { L: free.L, k: 0 };
  return done(write(free.lines, to, "-" + n.note), to);
}

/**
 * Une ligne d'un couloir d'un système dont les cases ks sont libres (autre que la ligne except) ;
 * sans elle, une ligne de plus, ouverte sous les lignes du couloir (ou à sa place dans la portée
 * quand le système n'a pas encore ce couloir). Rien pour une corde dont la ligne a ces cases prises.
 */
function freeLine(lines: string[], sys: System, staff: number, octave: number | undefined, ks: number[], except?: number) {
  const rows = laneLines(lines, sys, staff, octave);
  const L = rows.find((L) => L !== except && ks.every((k) => !cellAt(lines, { L, k })));
  if (L !== undefined) return { lines, L };
  if (rows.length && isString(octave)) return undefined;
  const ruler = lines[sys.ruler];
  let at: number;
  let label = "";
  if (rows.length) at = rows[rows.length - 1] + 1;
  else {
    if (octave === undefined) return { lines, L: sys.ruler + 1 };
    at = insertionLine(lines, sys.ruler, sys.last, staff, octave);
    label = laneLabel(octave);
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

/**
 * Une ligne de notes restée vide après qu'une note l'a quittée disparaît : son numéro d'octave passe
 * à la ligne suivante de l'octave, s'il y en a une. La seule ligne de notes d'une portée reste.
 */
function dropIfEmpty(lines: string[], L: number): string[] {
  const here = casesAt(lines, L);
  if (!here || here.all.some((_, k) => cellAt(lines, { L, k }))) return lines;
  const lane = laneOf(lines, L);
  if (!lane) return lines;
  const isNote = (l?: string) => !!l && !l.startsWith("@") && !l.startsWith("#") && l.includes("|") && !isRule(l) && !isRuler(l);
  // la seule ligne de notes de sa portée : elle reste
  let count = 0;
  for (let k = here.sys.ruler + 1; k <= here.sys.last; k++) if (isNote(lines[k]) && laneOf(lines, k)?.staff === lane.staff) count++;
  if (count <= 1) return lines;
  const out = [...lines];
  const label = out[L].slice(0, out[L].indexOf("|"));
  const next = out[L + 1];
  if (label.trim() && isNote(next) && !next.slice(0, next.indexOf("|")).trim()) out[L + 1] = label + next.slice(next.indexOf("|"));
  out.splice(L, 1);
  return out;
}

/** Les octaves possibles : de -4 à +4 autour de celle du do central. */
const LOWEST = CENTRAL_OCTAVE - 4, HIGHEST = CENTRAL_OCTAVE + 4;

/**
 * Change l'octave d'une note (dir : 1 au-dessus, -1 au-dessous) : son attaque et ses tenues passent,
 * système par système, sur une ligne de l'octave voisine où elles ont la place, ou sur une ligne de
 * plus ouverte à sa place dans la portée. Rien au-delà des octaves du clavier.
 */
export function moveOctave(text: string, at: ScorePlace, dir: 1 | -1): (Done & { octave: number }) | undefined {
  if (at.octave === undefined || isString(at.octave)) return undefined;
  const target = at.octave + dir;
  if (target < LOWEST || target > HIGHEST) return undefined;
  return moveLane(text, at, target, (c) => c);
}

/**
 * Place la note d'une case sur une corde, à la case fret (une autre note, ou la même au même son) :
 * son attaque et ses tenues y passent ; ses petites notes et sa trille gardent leur écart, celles
 * qui sortent du manche disparaissent ; le doigté reste. Comme sur l'instrument, la note coupe
 * celle qui sonnait encore sur cette corde, et s'arrête où la corde attaque une autre note. Une
 * case vide écrit simplement la case sur cette corde. Rien si la corde attaque déjà une note au
 * même instant.
 */
export function placeOnString(text: string, at: ScorePlace, string: number, fret: number): (Done & { octave: number }) | undefined {
  if (!isString(at.octave)) return undefined;
  const target = STRING_LANE + string;
  const cell = cellOf(text, at);
  const duration = cell?.content ? durationOf(text, at) : undefined;
  const start = duration?.attack ?? at;
  const there = { t: start.t, staff: at.staff, octave: target };
  if (target !== at.octave && attacks(text, there)) return undefined;
  if (!duration) {
    const r = retouch(text, { ...there, content: cellOf(text, there)?.exact ? cellOf(text, there)!.content : "" }, String(fret));
    return r && { ...r, octave: target };
  }
  const shift = fret - Number(duration.note);
  const recount = (c: string) => {
    const [head, finger] = c.split("_");
    const parts = splitCell(head);
    const fits = (x: string) => Number(x) + shift >= 0 && Number(x) + shift <= MAX_FRET;
    const out = parts
      ? joinCell({ graces: parts.graces.filter(fits).map((g) => String(Number(g) + shift)), note: String(fret), ...(parts.trill && fits(parts.trill) ? { trill: String(Number(parts.trill) + shift) } : {}) })
      : head.replace(/\d+/, String(fret)); // une tenue nommée (« -5 ») nomme sa nouvelle case
    return finger === undefined ? out : out + "_" + finger;
  };
  let lines = text.split("\n");
  const chain = noteAt(lines, posOf(text, start)!)!.chain;
  // la même corde : la note change de case sur place, avec ses tenues
  if (target === at.octave) {
    for (const c of chain) lines = write(lines, c, recount(cellAt(lines, c)));
    return { ...done(lines, chain[0]), octave: target };
  }
  // les cases de la note, par instant : vidées sur sa corde, puis écrites sur l'autre
  const cells = chain.map((c) => {
    const k = casesAt(lines, c.L)!.all[c.k];
    return { t: textPlace(text, c.L + 1, k.start + 1)!.t, content: recount(cellAt(lines, c)) };
  });
  for (const c of chain) lines = write(lines, c, "");
  let out = lines.join("\n");
  let first: Done | undefined;
  for (const [i, c] of cells.entries()) {
    const here = { t: c.t, staff: at.staff, octave: target };
    // une autre note attaquée sur cette corde : la note s'arrête là
    if (i > 0 && attacks(out, here)) break;
    const now = cellOf(out, here);
    const r = retouch(out, { ...here, content: now?.exact ? now.content : "" }, c.content);
    if (!r) return undefined;
    out = r.text;
    first ??= r;
  }
  // la ligne que la note a laissée vide disparaît, système par système (du dernier au premier)
  lines = out.split("\n");
  for (const c of [...cells].reverse()) {
    const r = findRow(lines.join("\n"), { t: c.t, staff: at.staff, octave: at.octave });
    if (r && r.octave === at.octave) lines = dropIfEmpty(lines, r.line - 1);
  }
  const back = findRow(lines.join("\n"), { ...there, content: cells[0].content });
  return { text: lines.join("\n"), line: back?.line ?? first!.line, column: back?.column ?? first!.column, octave: target };
}

/** Si une corde (un couloir) attaque une note à un instant : sa case y porte une note, et non une tenue. */
function attacks(text: string, at: ScorePlace) {
  const c = cellOf(text, at);
  return !!c?.exact && !!c.content && !c.content.startsWith("-");
}

/** Si la note (ou la case vide) d'une case peut passer sur chaque corde : une par corde, de la 1 à la plus grave. */
export function freeStrings(text: string, at: ScorePlace, count: number): boolean[] {
  const start = (cellOf(text, at)?.content && durationOf(text, at)?.attack) || at;
  return Array.from({ length: count }, (_, k) => STRING_LANE + k + 1 === at.octave || !attacks(text, { t: start.t, staff: at.staff, octave: STRING_LANE + k + 1 }));
}

/** Fait passer une note (son attaque et ses tenues) dans le couloir target, chaque case réécrite par change. */
function moveLane(text: string, at: ScorePlace, target: number, change: (cell: string) => string): (Done & { octave: number }) | undefined {
  let lines = text.split("\n");
  const p = posOf(text, at);
  const n = p && noteAt(lines, p);
  if (!n) return undefined;
  const lane = laneOf(lines, n.chain[0].L);
  if (!lane) return undefined;
  // les cases de la note, système par système (une ligne par système), du dernier au premier :
  // une ligne ouverte plus bas ne déplace pas celles d'au-dessus
  const groups: Pos[][] = [];
  for (const c of n.chain) {
    const g = groups[groups.length - 1];
    if (g && g[0].L === c.L) g.push(c);
    else groups.push([c]);
  }
  let first: Pos | undefined;
  for (let gi = groups.length - 1; gi >= 0; gi--) {
    const g = groups[gi];
    let from = g[0].L;
    const sys = casesAt(lines, from)!.sys;
    const ks = g.map((c) => c.k);
    const count = lines.length;
    const free = freeLine(lines, sys, lane.staff, target, ks);
    if (!free) return undefined;
    lines = free.lines;
    // une ligne ouverte au-dessus de la note la décale d'une ligne
    if (lines.length > count && free.L <= from) from++;
    for (const k of ks) {
      const content = cellAt(lines, { L: from, k });
      lines = write(lines, { L: from, k }, "");
      lines = write(lines, { L: free.L, k }, change(content));
    }
    let to = free.L;
    const dropped = dropIfEmpty(lines, from);
    if (dropped !== lines && from < to) to--;
    lines = dropped;
    first = { L: to, k: ks[0] };
  }
  return { ...done(lines, first!), octave: target };
}

/** Si la note d'une case peut monter ou descendre d'une octave. */
export function octaveRoomOf(at: ScorePlace) {
  return { up: at.octave !== undefined && at.octave < HIGHEST, down: at.octave !== undefined && at.octave > LOWEST };
}
