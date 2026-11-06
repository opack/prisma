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
  const offset = lane - CENTRAL_OCTAVE;
  return offset > 0 ? `+${offset}` : String(offset);
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
  const row = findRow(text, at);
  if (!row) return undefined;
  const exact = row.octave === at.octave;
  const lineIndex = row.line - 1;
  const sys = systemOf(lines, lineIndex);
  if (!sys) return undefined;
  const ruler = lines[sys.ruler];
  const all = cases(ruler);
  const cellIndex = all.findIndex((candidate) => row.column - 1 >= candidate.start && row.column - 1 < candidate.end);
  if (cellIndex < 0) return undefined;
  const content = exact ? lines[lineIndex].slice(all[cellIndex].start, all[cellIndex].end).trim() : "";
  // une tenue prolonge la note de la case d'avant, sur la même ligne
  const before = exact && cellIndex > 0 ? lines[lineIndex].slice(all[cellIndex - 1].start, all[cellIndex - 1].end).trim() : "";
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
  const row = findRow(text, at);
  if (!row) return undefined;
  let lineIndex = row.line - 1;
  if (row.octave !== at.octave) {
    if (!content || at.octave === undefined) return undefined;
    // la ligne de l'octave manque : elle s'ouvre à sa place dans la portée
    const sys = systemOf(lines, lineIndex);
    if (!sys) return undefined;
    lineIndex = insertionLine(lines, sys.ruler, sys.last, at.staff, at.octave);
    lines = [...lines.slice(0, lineIndex), noteLine(lines[sys.ruler], laneLabel(at.octave)), ...lines.slice(lineIndex)];
  }
  const sys = systemOf(lines, lineIndex);
  if (!sys) return undefined;
  const all = cases(lines[sys.ruler]);
  const cellIndex = all.findIndex((candidate) => row.column - 1 >= candidate.start && row.column - 1 < candidate.end);
  if (cellIndex < 0) return undefined;
  const old = lines[lineIndex].slice(all[cellIndex].start, all[cellIndex].end).trim();
  const held = heldBefore(lines[lineIndex], all, cellIndex);
  const rewrite = writeCase(lines, sys, lineIndex, all[cellIndex], content);
  lines = lines.map((line, index) => rewrite.lines.get(index) ?? line);
  // la note d'avant s'arrête ici : ses tenues suivantes s'effacent
  const ends = content === "" ? !!old : old.startsWith("-") && content !== "-";
  if (ends) lines = clearHolds(lines, lineIndex, cellIndex + 1, old.startsWith("-") ? held : unslid(old).match(/^(\d+')*(\d+)/)?.[2]);
  return { text: lines.join("\n"), line: rewrite.caret.line + 1, column: all[cellIndex].start + 1 };
}

/** La note que prolonge la case k d'une ligne : la dernière attaque avant elle (« -7 » la nomme). */
function heldBefore(line: string, all: Case[], cellIndex: number) {
  for (let index = cellIndex; index >= 0; index--) {
    const cell = unslid(line.slice(all[index].start, all[index].end).trim().replace(/\d+'/g, ""));
    const name = cell.match(/^-?(\d+)/)?.[1];
    if (name && (index < cellIndex || cell.startsWith("-"))) return name;
    if (index < cellIndex && !cell.startsWith("-")) return undefined;
  }
  return undefined;
}

/**
 * Efface les tenues de la ligne L à partir de la case k ; si elles vont jusqu'au bout du système,
 * la tenue « -N » qui ouvre la même ligne d'octave du système suivant, et les siennes.
 */
function clearHolds(lines: string[], lineIndex: number, cellIndex: number, note: string | undefined): string[] {
  for (let guard = 0; guard < 64; guard++) {
    const sys = systemOf(lines, lineIndex);
    if (!sys) return lines;
    const all = cases(lines[sys.ruler]);
    let index = cellIndex;
    for (; index < all.length; index++) {
      const cell = lines[lineIndex].slice(all[index].start, all[index].end).trim();
      if (!cell.startsWith("-")) return lines;
      const rewrite = writeCase(lines, sys, lineIndex, all[index], "");
      lines = lines.map((line, innerIndex) => rewrite.lines.get(innerIndex) ?? line);
    }
    // jusqu'au bout du système : la note continuait peut-être dans le suivant
    if (!note) return lines;
    const place = textPlace(lines.join("\n"), lineIndex + 1, all[all.length - 1].start + 1);
    if (!place) return lines;
    const next = (Math.floor(place.t / TICKS_PER_BEAT) + 1) * TICKS_PER_BEAT;
    const row = findRow(lines.join("\n"), { t: next, staff: place.staff, octave: place.octave, content: "-" + note });
    if (!row || row.octave !== place.octave || row.line - 1 <= lineIndex) return lines;
    const nextLine = lines[row.line - 1];
    const following = systemOf(lines, row.line - 1);
    const first = following && cases(lines[following.ruler])[0];
    if (!first || row.column - 1 !== first.start || nextLine.slice(first.start, first.end).trim() !== "-" + note) return lines;
    lineIndex = row.line - 1;
    cellIndex = 0;
  }
  return lines;
}

/**
 * Où ouvrir la ligne d'un couloir dans une portée : après les lignes des couloirs d'au-dessus (et
 * leurs lignes sans numéro), avant celles d'en dessous et les lignes @.
 */
function insertionLine(lines: string[], ruler: number, last: number, staff: number, octave: number) {
  let currentStaff = -1;
  let current: number | undefined;
  let at = -1;
  for (let lineIndex = ruler + 1; lineIndex <= last; lineIndex++) {
    const line = lines[lineIndex];
    if (isRule(line)) {
      if (currentStaff === staff) return at >= 0 ? at : lineIndex;
      currentStaff = lineIndex === ruler + 1 ? 0 : currentStaff + 1;
      current = undefined;
      if (currentStaff === staff) at = lineIndex + 1;
      continue;
    }
    if (currentStaff < 0) {
      currentStaff = 0;
      if (currentStaff === staff) at = lineIndex;
    }
    if (currentStaff !== staff) continue;
    if (line.startsWith("@")) return at;
    if (isRuler(line) || line.startsWith("#") || !line.includes("|")) continue;
    const label = laneOfLabel(line.slice(0, line.indexOf("|")).trim());
    if (label !== undefined) current = label;
    // une ligne d'un couloir d'au-dessus : la nouvelle ligne vient après elle
    if (current !== undefined && rankOf(current) < rankOf(octave)) at = lineIndex + 1;
    else return at;
  }
  return at >= 0 ? at : last + 1;
}

// la durée d'une note, depuis la note elle-même : ses tenues, ligne du texte par ligne du texte

/** Une case d'une ligne du texte : la ligne (à partir de 0) et le rang de la case dans son système. */
type Pos = { line: number; index: number };

/** La note qu'attaque une case (« 5 », « 3'5_2 »), sans ses ajouts. */
const attackOf = (cell: string) => (cell.startsWith("-") ? undefined : unslid(cell).match(/^(\d+')*(\d+)/)?.[2]);

function casesAt(lines: string[], lineIndex: number) {
  const sys = systemOf(lines, lineIndex);
  return sys ? { sys, all: cases(lines[sys.ruler]) } : undefined;
}
const cellAt = (lines: string[], pos: Pos) => {
  const here = casesAt(lines, pos.line);
  return here && here.all[pos.index] ? lines[pos.line].slice(here.all[pos.index].start, here.all[pos.index].end).trim() : "";
};

/** La portée et l'octave d'une ligne de notes. */
function laneOf(lines: string[], lineIndex: number) {
  const pipe = lines[lineIndex].indexOf("|");
  const scorePlace = textPlace(lines.join("\n"), lineIndex + 1, pipe + 2);
  return scorePlace && { staff: scorePlace.staff, octave: scorePlace.octave };
}

/** Les lignes de notes d'un système dans une portée et une octave. */
function laneLines(lines: string[], sys: System, staff: number, octave?: number) {
  const out: number[] = [];
  for (let lineIndex = sys.ruler + 1; lineIndex <= sys.last; lineIndex++) {
    const line = lines[lineIndex];
    if (line.startsWith("@") || line.startsWith("#") || !line.includes("|") || isRule(line)) continue;
    const lane = laneOf(lines, lineIndex);
    if (lane && lane.staff === staff && lane.octave === octave) out.push(lineIndex);
  }
  return out;
}

/** Le système d'avant (dir -1) ou d'après (dir 1). */
function nextSystem(lines: string[], sys: System, direction: 1 | -1) {
  let index = direction > 0 ? sys.last + 1 : sys.first - 1;
  while (index >= 0 && index < lines.length && !lines[index].trim()) index += direction;
  return index >= 0 && index < lines.length ? systemOf(lines, index) : undefined;
}

/** La place, dans le texte, du signe at de la partition (la ligne de son octave seulement). */
function posOf(text: string, at: ScorePlace): Pos | undefined {
  const row = findRow(text, at);
  if (!row || row.octave !== at.octave) return undefined;
  const lines = text.split("\n");
  const here = casesAt(lines, row.line - 1);
  const cellIndex = here?.all.findIndex((candidate) => row.column - 1 >= candidate.start && row.column - 1 < candidate.end) ?? -1;
  return cellIndex < 0 ? undefined : { line: row.line - 1, index: cellIndex };
}

/** La case d'avant sur la même ligne d'octave, jusque dans le système d'avant pour la première. */
function before(lines: string[], pos: Pos, note: string): Pos | undefined {
  if (pos.index > 0) return { line: pos.line, index: pos.index - 1 };
  const here = casesAt(lines, pos.line),
    lane = laneOf(lines, pos.line);
  const prev = here && lane && nextSystem(lines, here.sys, -1);
  if (!prev || !lane) return undefined;
  const last = cases(lines[prev.ruler]).length - 1;
  for (const lineIndex of laneLines(lines, prev, lane.staff, lane.octave)) {
    const cell = cellAt(lines, { line: lineIndex, index: last });
    if (attackOf(cell) === note || (cell.startsWith("-") && heldBefore(lines[lineIndex], cases(lines[prev.ruler]), last) === note)) return { line: lineIndex, index: last };
  }
  return undefined;
}

/** La case d'après sur la même ligne d'octave ; au bout du système, celle qui ouvre la suivante (« -N » ou vide). */
function after(lines: string[], pos: Pos, note: string): Pos | undefined {
  const here = casesAt(lines, pos.line);
  if (!here) return undefined;
  if (pos.index + 1 < here.all.length) return { line: pos.line, index: pos.index + 1 };
  const lane = laneOf(lines, pos.line);
  const next = lane && nextSystem(lines, here.sys, 1);
  if (!next || !lane) return undefined;
  const rows = laneLines(lines, next, lane.staff, lane.octave);
  const lineIndex = rows.find((row) => cellAt(lines, { line: row, index: 0 }) === "-" + note) ?? rows.find((row) => !cellAt(lines, { line: row, index: 0 }));
  return lineIndex === undefined ? undefined : { line: lineIndex, index: 0 };
}

/** La note d'une case (son attaque ou une de ses tenues) : son numéro, et ses cases, de l'attaque à la dernière tenue. */
function noteAt(lines: string[], pos: Pos) {
  let current = pos;
  let note = attackOf(cellAt(lines, current));
  // en arrière jusqu'à l'attaque
  for (let guard = 0; !note && guard < 512; guard++) {
    const cell = cellAt(lines, current);
    if (!cell.startsWith("-")) return undefined;
    const named = cell.match(/^-(\d+)/)?.[1];
    const all = casesAt(lines, current.line)?.all;
    const held = named ?? (all ? heldBefore(lines[current.line], all, current.index) : undefined);
    const prev = held ? before(lines, current, held) : undefined;
    if (!prev) {
      // la note commence avant le texte lu : on part de sa première tenue connue
      if (!held) return undefined;
      note = held;
      break;
    }
    current = prev;
    note = attackOf(cellAt(lines, current));
  }
  if (!note) return undefined;
  const chain: Pos[] = [current];
  for (let guard = 0; guard < 512; guard++) {
    const next = after(lines, chain[chain.length - 1], note);
    if (!next) break;
    const cell = cellAt(lines, next);
    if (cell !== "-" && cell !== "-" + note) break;
    chain.push(next);
  }
  return { note, chain };
}

/** Écrit content dans la case p. */
function write(lines: string[], pos: Pos, content: string) {
  const here = casesAt(lines, pos.line)!;
  const rewrite = writeCase(lines, here.sys, pos.line, here.all[pos.index], content);
  return lines.map((line, index) => rewrite.lines.get(index) ?? line);
}

/** Ce qui sort d'une retouche : le texte, et où mettre le curseur (à partir de 1). */
type Done = { text: string; line: number; column: number };
const done = (lines: string[], pos: Pos): Done => {
  const here = casesAt(lines, pos.line)!;
  return { text: lines.join("\n"), line: pos.line + 1, column: here.all[pos.index].start + 1 };
};

/**
 * La durée de la note d'une case de la partition (son attaque ou une de ses tenues) : son nombre
 * de cases, et si elle peut s'allonger (la case d'après est libre sur sa ligne) ou se raccourcir.
 */
export function durationOf(text: string, at: ScorePlace) {
  const lines = text.split("\n");
  const pos = posOf(text, at);
  const found = pos && noteAt(lines, pos);
  if (!found) return undefined;
  const end = found.chain[found.chain.length - 1];
  // la note désignée par son attaque : elle le reste quand ses tenues changent
  const start = found.chain[0];
  const startCases = casesAt(lines, start.line)!;
  const place = textPlace(text, start.line + 1, startCases.all[start.index].start + 1);
  const attack: ScorePlace = {
    t: place?.t ?? at.t,
    staff: at.staff,
    octave: at.octave,
    content: cellAt(lines, start).startsWith("-") ? cellAt(lines, start) : found.note,
  };
  // elle peut toujours s'allonger, sauf au bout du morceau (une case prise la fait changer de
  // ligne) ; sur une corde, seulement si la case d'après est libre
  const here = casesAt(lines, end.line)!;
  const longer = isString(at.octave) ? !!resize(text, attack, 1) : end.index + 1 < here.all.length || !!nextSystem(lines, here.sys, 1);
  return { note: found.note, count: found.chain.length, longer, shorter: found.chain.length > 1, attack };
}

/** Allonge (by 1) ou raccourcit (by -1) d'une case la note d'une case de la partition. */
export function resize(text: string, at: ScorePlace, by: 1 | -1): Done | undefined {
  let lines = text.split("\n");
  const origin = posOf(text, at);
  const found = origin && noteAt(lines, origin);
  if (!found) return undefined;
  const end = found.chain[found.chain.length - 1];
  if (by < 0) return found.chain.length > 1 ? done(write(lines, end, ""), found.chain[found.chain.length - 2]) : undefined;
  const here = casesAt(lines, end.line)!;
  const lane = laneOf(lines, end.line);
  if (!lane) return undefined;
  if (end.index + 1 < here.all.length) {
    const next = { line: end.line, index: end.index + 1 };
    if (!cellAt(lines, next)) return done(write(lines, next, "-"), next);
    // la case d'après est prise sur cette ligne : la note passe sur une ligne de son octave où
    // elle a la place (ou sur une ligne de plus), avec ses cases de ce système, puis s'allonge
    const cellIndexes = found.chain.filter((pos) => pos.line === end.line).map((pos) => pos.index);
    const free = freeLine(lines, here.sys, lane.staff, lane.octave, [...cellIndexes, next.index], end.line);
    if (!free) return undefined;
    lines = free.lines;
    const from = end.line;
    for (const cellIndex of cellIndexes) {
      const content = cellAt(lines, { line: from, index: cellIndex });
      lines = write(lines, { line: from, index: cellIndex }, "");
      lines = write(lines, { line: free.line, index: cellIndex }, content);
    }
    lines = write(lines, { line: free.line, index: next.index }, "-");
    const dropped = dropIfEmpty(lines, from);
    const to = { line: dropped !== lines && from < free.line ? free.line - 1 : free.line, index: next.index };
    return done(dropped, to);
  }
  // au bout du système : la note continue dans le suivant, sur une ligne de son octave libre au début
  const following = nextSystem(lines, here.sys, 1);
  if (!following) return undefined;
  const free = freeLine(lines, following, lane.staff, lane.octave, [0]);
  if (!free) return undefined;
  const to = { line: free.line, index: 0 };
  return done(write(free.lines, to, "-" + found.note), to);
}

/**
 * Une ligne d'un couloir d'un système dont les cases ks sont libres (autre que la ligne except) ;
 * sans elle, une ligne de plus, ouverte sous les lignes du couloir (ou à sa place dans la portée
 * quand le système n'a pas encore ce couloir). Rien pour une corde dont la ligne a ces cases prises.
 */
function freeLine(lines: string[], sys: System, staff: number, octave: number | undefined, cellIndexes: number[], except?: number) {
  const rows = laneLines(lines, sys, staff, octave);
  const lineIndex = rows.find((row) => row !== except && cellIndexes.every((cellIndex) => !cellAt(lines, { line: row, index: cellIndex })));
  if (lineIndex !== undefined) return { lines, line: lineIndex };
  if (rows.length && isString(octave)) return undefined;
  const ruler = lines[sys.ruler];
  let at: number;
  let label = "";
  if (rows.length) at = rows[rows.length - 1] + 1;
  else {
    if (octave === undefined) return { lines, line: sys.ruler + 1 };
    at = insertionLine(lines, sys.ruler, sys.last, staff, octave);
    label = laneLabel(octave);
  }
  return { lines: [...lines.slice(0, at), noteLine(ruler, label), ...lines.slice(at)], line: at };
}

/**
 * Les notes qu'une case vide peut tenir : celles de son couloir qui se sont arrêtées avant elle,
 * chacune sur sa ligne du texte, sans autre note entre elles et la case (la plus proche d'abord).
 */
export function holdChoices(text: string, at: ScorePlace): string[] {
  const lines = text.split("\n");
  const pos = posOf(text, at);
  if (!pos) return [];
  const here = casesAt(lines, pos.line),
    lane = laneOf(lines, pos.line);
  if (!here || !lane) return [];
  const found: { note: string; from: number }[] = [];
  for (const lineIndex of laneLines(lines, here.sys, lane.staff, lane.octave)) {
    const stopped = lastNote(lines, { line: lineIndex, index: pos.index });
    if (stopped && !found.some((entry) => entry.note === stopped.note)) found.push(stopped);
  }
  return found.sort((first, second) => second.from - first.from).map((entry) => entry.note);
}

/**
 * La dernière note avant la case vide p sur sa ligne, s'il n'y a que des cases vides entre elles :
 * son numéro, et la première case vide après elle (d'où la tenir). En remontant jusqu'au début du
 * système, une note de ce couloir qui sonnait au bout du système d'avant.
 */
function lastNote(lines: string[], pos: Pos): { note: string; from: number } | undefined {
  if (cellAt(lines, pos)) return undefined;
  const all = casesAt(lines, pos.line)!.all;
  for (let cellIndex = pos.index - 1; cellIndex >= 0; cellIndex--) {
    const cell = cellAt(lines, { line: pos.line, index: cellIndex });
    if (!cell) continue;
    const note = attackOf(cell) ?? (cell.startsWith("-") ? heldBefore(lines[pos.line], all, cellIndex) : undefined);
    return note ? { note, from: cellIndex + 1 } : undefined;
  }
  // la ligne est vide jusqu'au début du système : la note qui sonnait au bout du système d'avant
  const here = casesAt(lines, pos.line),
    lane = laneOf(lines, pos.line);
  const prev = here && lane && nextSystem(lines, here.sys, -1);
  if (!prev || !lane) return undefined;
  const previousCells = cases(lines[prev.ruler]),
    last = previousCells.length - 1;
  for (const lineIndex of laneLines(lines, prev, lane.staff, lane.octave)) {
    const cell = cellAt(lines, { line: lineIndex, index: last });
    const held = attackOf(cell) ?? (cell.startsWith("-") ? heldBefore(lines[lineIndex], previousCells, last) : undefined);
    // une note qui ne continue pas déjà ailleurs dans ce système
    if (held && !laneLines(lines, here.sys, lane.staff, lane.octave).some((other) => cellAt(lines, { line: other, index: 0 }) === "-" + held))
      return { note: held, from: 0 };
  }
  return undefined;
}

/** Tient la note note jusqu'à la case vide at : des tenues sur sa ligne, de son arrêt à cette case. */
export function holdIn(text: string, at: ScorePlace, note: string): Done | undefined {
  let lines = text.split("\n");
  const pos = posOf(text, at);
  if (!pos) return undefined;
  const here = casesAt(lines, pos.line),
    lane = laneOf(lines, pos.line);
  if (!here || !lane) return undefined;
  for (const lineIndex of laneLines(lines, here.sys, lane.staff, lane.octave)) {
    const stopped = lastNote(lines, { line: lineIndex, index: pos.index });
    if (stopped?.note !== note) continue;
    // dans le système suivant, la première tenue nomme sa note
    for (let cellIndex = stopped.from; cellIndex <= pos.index; cellIndex++) lines = write(lines, { line: lineIndex, index: cellIndex }, cellIndex === 0 ? "-" + note : "-");
    return done(lines, { line: lineIndex, index: pos.index });
  }
  return undefined;
}

// les ajouts à une note : petites notes devant, trille, doigté

/** Une case qui attaque une note, en morceaux : ses petites notes, sa note, sa trille, son doigt. */
export type CellParts = { graces: string[]; note: string; trill?: string; finger?: string };

/** Les morceaux d'une case qui attaque une note (« 3'5~7_2 »), ou rien pour une tenue ou une case vide. */
export function splitCell(cell: string): CellParts | undefined {
  const match = cell.trim().match(/^((?:\d+')*)(\d+)(?:~(\d+))?(?:_(\d))?$/);
  if (!match) return undefined;
  return { graces: match[1] ? match[1].split("'").filter(Boolean) : [], note: match[2], trill: match[3], finger: match[4] };
}

/** La case réécrite d'après ses morceaux. */
export const joinCell = (cellParts: CellParts) =>
  cellParts.graces.map((grace) => grace + "'").join("") + cellParts.note + (cellParts.trill ? "~" + cellParts.trill : "") + (cellParts.finger ? "_" + cellParts.finger : "");

/**
 * Une ligne de notes restée vide après qu'une note l'a quittée disparaît : son numéro d'octave passe
 * à la ligne suivante de l'octave, s'il y en a une. La seule ligne de notes d'une portée reste.
 */
function dropIfEmpty(lines: string[], lineIndex: number): string[] {
  const here = casesAt(lines, lineIndex);
  if (!here || here.all.some((_, cellIndex) => cellAt(lines, { line: lineIndex, index: cellIndex }))) return lines;
  const lane = laneOf(lines, lineIndex);
  if (!lane) return lines;
  const isNote = (line?: string) => !!line && !line.startsWith("@") && !line.startsWith("#") && line.includes("|") && !isRule(line) && !isRuler(line);
  // la seule ligne de notes de sa portée : elle reste
  let count = 0;
  for (let index = here.sys.ruler + 1; index <= here.sys.last; index++) if (isNote(lines[index]) && laneOf(lines, index)?.staff === lane.staff) count++;
  if (count <= 1) return lines;
  const out = [...lines];
  const label = out[lineIndex].slice(0, out[lineIndex].indexOf("|"));
  const next = out[lineIndex + 1];
  if (label.trim() && isNote(next) && !next.slice(0, next.indexOf("|")).trim()) out[lineIndex + 1] = label + next.slice(next.indexOf("|"));
  out.splice(lineIndex, 1);
  return out;
}

/** Les octaves possibles : de -4 à +4 autour de celle du do central. */
const LOWEST = CENTRAL_OCTAVE - 4,
  HIGHEST = CENTRAL_OCTAVE + 4;

/**
 * Change l'octave d'une note (dir : 1 au-dessus, -1 au-dessous) : son attaque et ses tenues passent,
 * système par système, sur une ligne de l'octave voisine où elles ont la place, ou sur une ligne de
 * plus ouverte à sa place dans la portée. Rien au-delà des octaves du clavier.
 */
export function moveOctave(text: string, at: ScorePlace, dir: 1 | -1): (Done & { octave: number }) | undefined {
  if (at.octave === undefined || isString(at.octave)) return undefined;
  const target = at.octave + dir;
  if (target < LOWEST || target > HIGHEST) return undefined;
  return moveLane(text, at, target, (cell) => cell);
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
    const result = retouch(text, { ...there, content: cellOf(text, there)?.exact ? cellOf(text, there)!.content : "" }, String(fret));
    return result && { ...result, octave: target };
  }
  const shift = fret - Number(duration.note);
  const recount = (content: string) => {
    const [head, finger] = content.split("_");
    const parts = splitCell(head);
    const fits = (value: string) => Number(value) + shift >= 0 && Number(value) + shift <= MAX_FRET;
    const out = parts
      ? joinCell({
          graces: parts.graces.filter(fits).map((grace) => String(Number(grace) + shift)),
          note: String(fret),
          ...(parts.trill && fits(parts.trill) ? { trill: String(Number(parts.trill) + shift) } : {}),
        })
      : head.replace(/\d+/, String(fret)); // une tenue nommée (« -5 ») nomme sa nouvelle case
    return finger === undefined ? out : out + "_" + finger;
  };
  let lines = text.split("\n");
  const chain = noteAt(lines, posOf(text, start)!)!.chain;
  // la même corde : la note change de case sur place, avec ses tenues
  if (target === at.octave) {
    for (const pos of chain) lines = write(lines, pos, recount(cellAt(lines, pos)));
    return { ...done(lines, chain[0]), octave: target };
  }
  // les cases de la note, par instant : vidées sur sa corde, puis écrites sur l'autre
  const cells = chain.map((pos) => {
    const located = casesAt(lines, pos.line)!.all[pos.index];
    return { t: textPlace(text, pos.line + 1, located.start + 1)!.t, content: recount(cellAt(lines, pos)) };
  });
  for (const pos of chain) lines = write(lines, pos, "");
  let out = lines.join("\n");
  let first: Done | undefined;
  for (const [index, entry] of cells.entries()) {
    const here = { t: entry.t, staff: at.staff, octave: target };
    // une autre note attaquée sur cette corde : la note s'arrête là
    if (index > 0 && attacks(out, here)) break;
    const now = cellOf(out, here);
    const result = retouch(out, { ...here, content: now?.exact ? now.content : "" }, entry.content);
    if (!result) return undefined;
    out = result.text;
    first ??= result;
  }
  // la ligne que la note a laissée vide disparaît, système par système (du dernier au premier)
  lines = out.split("\n");
  for (const entry of [...cells].reverse()) {
    const row = findRow(lines.join("\n"), { t: entry.t, staff: at.staff, octave: at.octave });
    if (row && row.octave === at.octave) lines = dropIfEmpty(lines, row.line - 1);
  }
  const back = findRow(lines.join("\n"), { ...there, content: cells[0].content });
  return { text: lines.join("\n"), line: back?.line ?? first!.line, column: back?.column ?? first!.column, octave: target };
}

/** Si une corde (un couloir) attaque une note à un instant : sa case y porte une note, et non une tenue. */
function attacks(text: string, at: ScorePlace) {
  const cell = cellOf(text, at);
  return !!cell?.exact && !!cell.content && !cell.content.startsWith("-");
}

/** Si la note (ou la case vide) d'une case peut passer sur chaque corde : une par corde, de la 1 à la plus grave. */
export function freeStrings(text: string, at: ScorePlace, count: number): boolean[] {
  const start = (cellOf(text, at)?.content && durationOf(text, at)?.attack) || at;
  return Array.from(
    { length: count },
    (_, index) => STRING_LANE + index + 1 === at.octave || !attacks(text, { t: start.t, staff: at.staff, octave: STRING_LANE + index + 1 }),
  );
}

/** Fait passer une note (son attaque et ses tenues) dans le couloir target, chaque case réécrite par change. */
function moveLane(text: string, at: ScorePlace, target: number, change: (cell: string) => string): (Done & { octave: number }) | undefined {
  let lines = text.split("\n");
  const origin = posOf(text, at);
  const found = origin && noteAt(lines, origin);
  if (!found) return undefined;
  const lane = laneOf(lines, found.chain[0].line);
  if (!lane) return undefined;
  // les cases de la note, système par système (une ligne par système), du dernier au premier :
  // une ligne ouverte plus bas ne déplace pas celles d'au-dessus
  const groups: Pos[][] = [];
  for (const position of found.chain) {
    const pos = groups[groups.length - 1];
    if (pos && pos[0].line === position.line) pos.push(position);
    else groups.push([position]);
  }
  let first: Pos | undefined;
  for (let groupIndex = groups.length - 1; groupIndex >= 0; groupIndex--) {
    const group = groups[groupIndex];
    let from = group[0].line;
    const sys = casesAt(lines, from)!.sys;
    const cellIndexes = group.map((pos) => pos.index);
    const count = lines.length;
    const free = freeLine(lines, sys, lane.staff, target, cellIndexes);
    if (!free) return undefined;
    lines = free.lines;
    // une ligne ouverte au-dessus de la note la décale d'une ligne
    if (lines.length > count && free.line <= from) from++;
    for (const cellIndex of cellIndexes) {
      const content = cellAt(lines, { line: from, index: cellIndex });
      lines = write(lines, { line: from, index: cellIndex }, "");
      lines = write(lines, { line: free.line, index: cellIndex }, change(content));
    }
    let to = free.line;
    const dropped = dropIfEmpty(lines, from);
    if (dropped !== lines && from < to) to--;
    lines = dropped;
    first = { line: to, index: cellIndexes[0] };
  }
  return { ...done(lines, first!), octave: target };
}

/** Si la note d'une case peut monter ou descendre d'une octave. */
export function octaveRoomOf(at: ScorePlace) {
  return { up: at.octave !== undefined && at.octave < HIGHEST, down: at.octave !== undefined && at.octave > LOWEST };
}
