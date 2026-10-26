/**
 * Écrire dans un système sans casser son alignement : ce que la complétion de l'éditeur insère.
 *
 * Toutes les lignes d'un système suivent les colonnes de sa règle de comptage. Écrire dans une
 * case se fait dans ses espaces quand elle a la place ; sinon la case s'élargit sur toutes les
 * lignes du système à la fois (de l'espace sur la règle et les lignes de notes, du trait sur les
 * traits, de l'espace ou un soufflet prolongé sur les lignes @), et les colonnes restent alignées.
 *
 * Tout se calcule sur les lignes du texte (à partir de 0) ; le résultat est la liste des lignes
 * réécrites et la place du curseur après l'écriture.
 */
import { isRuler, markTokens, parseRule } from "../core/prisma-parse.ts";
import { CENTRAL_OCTAVE, midiOf, parseOctaveLabel } from "../core/pitch.ts";

/** Les lignes d'un système : de first à last, dont sa règle de comptage. */
export type System = { first: number; last: number; ruler: number };

/** Une case de la règle : ses colonnes [start, end), et si une barre la termine. */
export type Case = { start: number; end: number; bar: boolean };

/** Une barre de la règle (« | », « || », « :|| »…) : ses colonnes. */
type Sep = { from: number; to: number; text: string };

/** Ce qu'une écriture change : des lignes entières, et la place du curseur. */
export type Rewrite = { lines: Map<number, string>; caret: { line: number; col: number } };

const isRuleLine = (line: string) => {
  try {
    return !!parseRule(line, 0);
  } catch {
    return true;
  }
};

/** Les barres d'une règle de comptage. */
export function separators(ruler: string): Sep[] {
  const seps: Sep[] = [];
  for (let i = ruler.indexOf("|"); i >= 0 && i < ruler.length; ) {
    if (ruler[i] === "|" || (ruler[i] === ":" && ruler[i + 1] === "|")) {
      let j = i;
      while (j < ruler.length && (ruler[j] === "|" || ruler[j] === ":")) j++;
      seps.push({ from: i, to: j, text: ruler.slice(i, j) });
      i = j;
    } else i++;
  }
  return seps;
}

/** Les cases d'une règle : chacune commence à son étiquette (la première, juste après la barre). */
export function cases(ruler: string): Case[] {
  const seps = separators(ruler);
  const out: Case[] = [];
  for (let k = 0; k + 1 < seps.length; k++) {
    const from = seps[k].to, to = seps[k + 1].from;
    const labels = [...ruler.slice(from, to).matchAll(/\S+/g)].map((m) => from + m.index);
    if (!labels.length) continue;
    labels[0] = from;
    labels.forEach((start, i) => out.push({ start, end: i + 1 < labels.length ? labels[i + 1] : to, bar: i + 1 === labels.length }));
  }
  return out;
}

/** La case d'une colonne. */
export const caseAt = (ruler: string, col: number) => cases(ruler).find((c) => col >= c.start && col < c.end);

/**
 * Le système de la ligne L : les lignes non vides autour d'elle, dont une règle de comptage. Une
 * ligne vide qu'on vient d'ouvrir sous une ligne du système en fait partie (sinon elle le coupe).
 */
export function systemOf(lines: string[], L: number, body = 0): System | undefined {
  const blank = (k: number) => !lines[k]?.trim();
  let top = L, bottom = L;
  if (blank(L)) {
    if (L === 0 || blank(L - 1)) return undefined;
    top = L - 1;
  }
  while (top > body && !blank(top - 1)) top--;
  while (bottom + 1 < lines.length && !blank(bottom + 1)) bottom++;
  for (let k = top; k <= bottom; k++) if (isRuler(lines[k])) return { first: top, last: bottom, ruler: k };
  return undefined;
}

/** Une ligne prolongée jusqu'à la colonne col, avec les barres de la règle là où elle en a. */
function padTo(line: string, col: number, ruler: string) {
  let out = line;
  for (let c = line.length; c < col; c++) out += ruler[c] === "|" ? "|" : " ";
  return out;
}

/** Le caractère dont un trait se prolonge : le sien (─, -, ═, =). */
const ruleChar = (line: string) => line.match(/[─━\-=═]/)?.[0] ?? "─";

/**
 * Les indications d'une ligne @ : sur une ligne @, les mots qu'une seule espace sépare forment un
 * seul texte (« Andante très expressif ») ; sur une ligne de paroles ou d'accords, chaque mot est
 * à part.
 */
function marksOf(line: string) {
  if (/^@[lc](\s|$)/.test(line)) return [...line.matchAll(/\S+/g)].filter((m) => m.index > 0).map((m) => ({ col: m.index, text: m[0] }));
  return markTokens(line);
}

/**
 * Élargit une ligne de n colonnes à la colonne x, selon sa sorte. Sur une ligne @, une
 * indication à cheval sur x n'est jamais coupée : un soufflet, une liaison ou un trait de
 * prolongation s'allonge ; un texte garde son début et l'espace va après lui.
 */
function widen(line: string, x: number, n: number): string {
  if (line.length <= x) return line;
  if (isRuleLine(line)) {
    // au milieu du nom d'une partie, écrit sur le trait : le trait s'allonge après le nom
    const h = ruleChar(line);
    let at = x;
    if (/[^─━=═\-┼╪+|]/.test(line[x - 1] ?? "") && /[^─━=═\-┼╪+|]/.test(line[x])) while (at < line.length && /[^─━=═\-┼╪+|]/.test(line[at])) at++;
    return line.slice(0, at) + h.repeat(n) + line.slice(at);
  }
  if (line.startsWith("@")) {
    const t = marksOf(line).find((m) => m.col < x && x < m.col + m.text.length);
    if (t) {
      if (line[x - 1] === "-" || line[x] === "-") return line.slice(0, x) + "-".repeat(n) + line.slice(x);
      const end = t.col + t.text.length;
      return (line.slice(0, end) + " ".repeat(n) + line.slice(end)).trimEnd();
    }
  }
  return line.slice(0, x) + " ".repeat(n) + line.slice(x);
}

/**
 * Écrit content dans la case c de la ligne L : il remplace ce que la case contenait, une espace au
 * moins le sépare de la case suivante ; la case s'élargit sur tout le système s'il le faut.
 */
export function writeCase(lines: string[], sys: System, L: number, c: Case, content: string): Rewrite {
  const ruler = lines[sys.ruler];
  const span = c.end - c.start;
  const extra = Math.max(0, content.length + 1 - span);
  const out = new Map<number, string>();
  for (let k = sys.first; k <= sys.last; k++) {
    if (k === L || !extra) continue;
    const w = widen(lines[k], c.end, extra);
    if (w !== lines[k]) out.set(k, w);
  }
  const line = padTo(lines[L], c.start, ruler);
  const rest = line.slice(c.end);
  const cell = rest ? content.padEnd(span + extra) : content;
  out.set(L, (line.slice(0, c.start) + cell + rest).trimEnd());
  return { lines: out, caret: { line: L, col: c.start + content.length } };
}

/**
 * Écrit un accord sur la ligne @c L, dans la case qui commence à la colonne start, à la place du
 * mot de old caractères qui s'y trouvait. Comme une note, l'accord tient dans sa case : trop long,
 * la case s'élargit sur tout le système, et les accords suivants restent sur la leur.
 */
export function writeChord(lines: string[], sys: System, L: number, start: number, old: number, chord: string): Rewrite {
  const c = caseAt(lines[sys.ruler], start)!;
  // le mot d'avant s'efface (même s'il débordait de sa case), puis l'accord s'écrit
  const blank = lines[L].padEnd(Math.max(c.end, start + old));
  const line = blank.slice(0, start) + " ".repeat(old) + blank.slice(start + old);
  const span = c.end - c.start;
  const extra = Math.max(0, chord.length + 1 - span);
  const out = new Map<number, string>();
  for (let i = sys.first; i <= sys.last && extra; i++) {
    if (i === L) continue;
    const w = widen(lines[i], c.end, extra);
    if (w !== lines[i]) out.set(i, w);
  }
  out.set(L, (line.slice(0, start) + chord.padEnd(span + extra) + line.slice(c.end)).trimEnd());
  return { lines: out, caret: { line: L, col: start + chord.length } };
}

/**
 * Prolonge la règle de comptage de text (ajouté après sa dernière barre, ou à la place d'une
 * barre simple finale changée en double). Les traits et les lignes de notes qui vont jusqu'au bout
 * de la règle la suivent : du trait (et un croisement sous chaque barre), de l'espace et des barres.
 */
export function extendRuler(lines: string[], sys: System, text: string): Rewrite {
  const ruler = lines[sys.ruler].trimEnd();
  const out = new Map<number, string>();
  for (let k = sys.ruler + 1; k <= sys.last; k++) {
    const l = lines[k].trimEnd();
    if (l.length < ruler.length || l.trimStart().startsWith("@")) continue;
    let add = "";
    if (isRuleLine(l)) {
      const h = ruleChar(l);
      // le croisement sous une barre : celui que le trait emploie déjà
      const cross = l.match(/[┼╪+|]/)?.[0] ?? (/[═=]/.test(l) ? "╪" : "┼");
      for (const ch of text) add += ch === "|" || ch === ":" ? cross : h;
    } else for (const ch of text) add += ch === "|" ? "|" : " ";
    out.set(k, l + add);
  }
  out.set(sys.ruler, ruler + text);
  return { lines: out, caret: { line: sys.ruler, col: ruler.length + text.length } };
}

/** Ce qui peut prolonger une règle : le temps suivant, coupé ou non, et la fin de mesure. */
export function rulerSuffixes(ruler: string, cell: number) {
  const seps = separators(ruler.trimEnd());
  const last = seps[seps.length - 1];
  if (!last || last.to !== ruler.trimEnd().length) return [];
  // le temps suivant : après une fin de mesure, le premier
  let beat = 1;
  if (last.text === "|" && seps.length > 1) {
    const prev = seps[seps.length - 2];
    const n = Number(ruler.slice(prev.to, last.from).trim().split(/\s+/)[0]);
    if (Number.isInteger(n)) beat = n + 1;
  }
  const pad = (s: string) => s.padEnd(cell);
  const one = String(beat);
  const out = [
    { text: pad(one) + "|", label: one, detail: "temps suivant" },
    { text: pad(one) + pad("*") + "|", label: `${one}  *`, detail: "temps suivant, en deux cases" },
    { text: pad(one) + pad("*") + pad("*") + "|", label: `${one}  *  *`, detail: "temps suivant, en trois cases" },
  ];
  if (last.text === "|" && seps.length > 1) out.push({ text: "|", label: "||", detail: "fin de la mesure" });
  return out;
}

/**
 * Les octaves possibles pour une nouvelle ligne de notes à la ligne L : dans une portée, les
 * octaves vont de l'aigu au grave, chacune numérotée une fois. same : la ligne peut prolonger
 * l'octave de la ligne du dessus (sans numéro) ; octaves : les écarts au do central possibles avec
 * un numéro. Sous une ligne @, aucune ligne de notes ne s'écrit ; au-dessus d'une ligne sans
 * numéro, seule l'octave du dessus convient (un numéro lui volerait cette ligne).
 */
export function octaveRoom(lines: string[], sys: System, L: number): { same: boolean; octaves: number[] } {
  const none = { same: false, octaves: [] };
  const isNote = (l: string) => !!l && !l.startsWith("@") && !l.startsWith("#") && l.includes("|") && !isRuleLine(l) && !isRuler(l);
  const label = (l: string) => parseOctaveLabel(l.slice(0, l.indexOf("|")).trim());
  const up = lines[L - 1] ?? "";
  if (up.startsWith("@")) return none;
  let above: number | undefined;
  const same = isNote(up);
  for (let k = L - 1; k > sys.ruler && isNote(lines[k]); k--) {
    above = label(lines[k]);
    if (above !== undefined) break;
  }
  const down = L + 1 <= sys.last ? lines[L + 1] : "";
  if (isNote(down) && label(down) === undefined) return { same, octaves: [] };
  const below = isNote(down) ? label(down) : undefined;
  const octaves: number[] = [];
  for (let o = 4; o >= -4; o--) {
    const abs = o + CENTRAL_OCTAVE;
    if ((above === undefined || abs < above) && (below === undefined || abs > below)) octaves.push(o);
  }
  return { same, octaves };
}

/** Une nouvelle ligne de notes : son numéro d'octave, puis les barres de la règle. */
export function noteLine(ruler: string, label: string) {
  const pipe = ruler.indexOf("|");
  let out = label.padEnd(pipe);
  for (let c = pipe; c < ruler.trimEnd().length; c++) out += ruler[c] === "|" ? "|" : " ";
  return out;
}

/**
 * Les notes qui sonnent dans une colonne d'un système : sur chaque ligne de notes, celle de la case
 * (ou celle qu'une tenue prolonge), à sa hauteur ; de la plus grave à la plus aiguë.
 */
export function soundingAt(lines: string[], sys: { ruler: number; last: number }, C: number): number[] {
  const ruler = lines[sys.ruler];
  const first = ruler.indexOf("|");
  const midis: number[] = [];
  let octave: number | undefined;
  for (let k = sys.ruler + 1; k <= sys.last; k++) {
    const line = lines[k];
    const bar = line.indexOf("|");
    if (line.startsWith("@") || bar < 0 || /^[─━\-=═+┼╪|\s]+$/.test(line.trim())) {
      if (/^[─━\-=═+┼╪|\s]+$/.test(line.trim())) octave = undefined; // un trait : une autre portée
      continue;
    }
    const label = line.slice(0, bar).trim();
    if (label) octave = parseOctaveLabel(label);
    if (octave === undefined) continue;
    // la case de la colonne, ou, pour une tenue, la case de la note qu'elle prolonge
    for (let col = C; col > first; ) {
      const c = caseAt(ruler, col);
      if (!c) break;
      const content = line.slice(c.start, c.end).trim().replace(/^(\d+')+/, "");
      const n = content.match(/^-?(\d+)/);
      if (n) {
        const v = Number(n[1]);
        if (v >= 1 && v <= 12) midis.push(midiOf(octave, v));
        break;
      }
      if (!content.startsWith("-")) break;
      // la case d'avant, de l'autre côté de sa barre (simple ou double)
      col = c.start - 1;
      while (col > first && !caseAt(ruler, col)) col--;
    }
  }
  return midis.sort((a, b) => a - b);
}

/**
 * Écrit une indication sur la ligne @ L, à la colonne start (le début de sa case, ou après une
 * indication venue de la case d'avant), à la place du mot de old caractères qui s'y trouvait.
 * Une indication se place par sa première lettre : un mot (une nuance, « a tempo ») déborde sur les
 * cases suivantes de sa ligne si elles sont libres ; sinon les cases s'élargissent sur tout le
 * système, juste avant l'indication qui suit. Un signe qui dure (un soufflet, une liaison,
 * l'étouffé de la paume, le vibrato) s'écrit jusqu'à la case suivante, sans rien recouvrir : on
 * l'allonge ensuite. Sa fin, si elle est donnée (« ) »), se place au début de cette case.
 */
export function writeMark(lines: string[], sys: System, L: number, start: number, old: number, mark: { head: string; fill?: string; tail?: string }): Rewrite {
  const all = cases(lines[sys.ruler]);
  const k = all.findIndex((x) => start >= x.start && start < x.end);
  const next = all[k + 1];
  const line = lines[L].padEnd(start + old);
  const erased = line.slice(0, start) + " ".repeat(old) + line.slice(start + old);
  if (mark.fill === undefined) {
    const word = mark.head;
    const busy = erased.slice(start).search(/\S/);
    const out = new Map<number, string>();
    let target = erased;
    if (busy >= 0 && word.length + 1 > busy) {
      // l'indication suivante est trop près : les cases s'élargissent juste avant elle, sur tout le système
      const at = start + busy;
      // à la barre qui ferme la case d'avant (comme pour une note), pour que les temps restent alignés
      const j = all.findIndex((x) => at >= x.start && at < x.end);
      const b = j > k ? all[j - 1].end : all[k].end;
      const extra = word.length + 1 - (at - start);
      for (let i = sys.first; i <= sys.last; i++) {
        if (i === L) continue;
        const w = widen(lines[i], b, extra);
        if (w !== lines[i]) out.set(i, w);
      }
      target = erased.slice(0, b) + " ".repeat(extra) + erased.slice(b);
    }
    out.set(L, (target.padEnd(start).slice(0, start) + word + target.slice(start + word.length)).trimEnd());
    return { lines: out, caret: { line: L, col: start + word.length } };
  }
  // jusqu'à la case suivante (sa première colonne pour une fin, sa dernière sinon), sans toucher au mot suivant
  let end = next ? (mark.tail ? next.start + 1 : next.end - 1) : all[k].end - 1;
  const busy = erased.slice(start).search(/\S/);
  if (busy >= 0) end = Math.min(end, start + busy - 1);
  const room = Math.max(end - start, mark.head.length + (mark.tail?.length ?? 0) + 1);
  const body = mark.head + mark.fill.repeat(Math.max(1, room - mark.head.length - (mark.tail?.length ?? 0))) + (mark.tail ?? "");
  const out = new Map<number, string>([[L, (erased.padEnd(start).slice(0, start) + body + erased.slice(start + body.length)).trimEnd()]]);
  return { lines: out, caret: { line: L, col: start + body.length } };
}
