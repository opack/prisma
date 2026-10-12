/**
 * Lecture du format texte .ymn vers le modèle.
 *
 * Les sauts de ligne sont libres : le temps absolu est reconstitué à partir des règles
 * de comptage. Voir FORMAT.md pour la grammaire complète.
 */
import { YmnError, parseFrontmatter } from "./frontmatter.ts";
import { TICKS_PER_BEAT, sortNotes } from "./model.ts";
import type { Beat, Division, Hand, Note, Score } from "./model.ts";
import { midiOf } from "./pitch.ts";
import { DEFAULT_CELL } from "./ymn-write.ts";

type Segment = { from: number; to: number; barEnd: boolean };

const isSeparator = (line: string) => {
  const t = line.trim();
  return t.length >= 3 && /^[─━\-=+┼|]+$/.test(t) && /[─━\-=]/.test(t);
};
const isRuler = (line: string) => /^m[^|\s]*\s*\|/.test(line);

/** Positions des temps d'une règle de comptage. */
function segments(ruler: string, lineNo: number, pipe: number): Segment[] {
  const pipes: number[] = [];
  for (let i = pipe; i < ruler.length; i++) if (ruler[i] === "|") pipes.push(i);
  const trailing = ruler.slice(pipes[pipes.length - 1] + 1);
  if (trailing.trim()) throw new YmnError("la règle de comptage doit se terminer par « | » ou « || »", lineNo, pipes[pipes.length - 1] + 2);
  const segs: Segment[] = [];
  for (let j = 0; j + 1 < pipes.length; j++) {
    const from = pipes[j] + 1, to = pipes[j + 1];
    if (from === to) {
      if (!segs.length) throw new YmnError("« || » en tête de règle", lineNo, from);
      segs[segs.length - 1].barEnd = true;
    } else {
      segs.push({ from, to, barEnd: false });
    }
  }
  if (!segs.length) throw new YmnError("règle de comptage sans aucun temps", lineNo);
  return segs;
}

const nextBar = (bar: string) => (/^\d+$/.test(bar) ? String(Number(bar) + 1) : bar + "'");

export function parseYmn(text: string): Score {
  const lines = text.replace(/\t/g, "    ").split(/\r?\n/);
  const { meta, bodyStartLine } = parseFrontmatter(lines);
  const cw = Number(meta.case ?? DEFAULT_CELL);
  const defaultDivision = (Number(meta.division ?? 2) === 3 ? 3 : 2) as Division;

  // découpage en blocs : une règle de comptage et les lignes qui la suivent
  type Block = { ruler: number; lines: number[] };
  const blocks: Block[] = [];
  for (let i = bodyStartLine; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim() || l.trimStart().startsWith("#")) {
      if (!l.trim() && blocks.length) blocks[blocks.length - 1].lines.push(-1); // fin de bloc
      continue;
    }
    if (isRuler(l)) {
      blocks.push({ ruler: i, lines: [] });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (!last) throw new YmnError("une règle de comptage (« m1 |1 … ») doit précéder les lignes de notes", i + 1);
    if (last.lines.includes(-1)) throw new YmnError("ligne de notes séparée de sa règle de comptage par une ligne vide", i + 1);
    last.lines.push(i);
  }
  if (!blocks.length) throw new YmnError("aucune règle de comptage trouvée", bodyStartLine + 1);

  const beats: Beat[] = [];
  const notes: Note[] = [];
  let barIndex = -1;
  let lastBar = "0";
  let lastBarClosed = true;
  let pending: Note[] = []; // notes encore tenues à la fin du bloc précédent

  for (const block of blocks) {
    const rulerLine = lines[block.ruler];
    const L = block.ruler + 1;
    const pipe = rulerLine.indexOf("|");
    const barLabel = rulerLine.slice(1, pipe).trim();
    const segs = segments(rulerLine, L, pipe);

    // temps du bloc
    const blockBeat0 = beats.length;
    let bar = barLabel || nextBar(lastBar);
    const anchors: { t: number; from: number; seg: number }[] = [];
    segs.forEach((s, si) => {
      const w = s.to - s.from;
      if (w % cw) throw new YmnError(`le temps fait ${w} caractères, ce n'est pas un multiple de ${cw}`, L, s.from + 1);
      const n = w / cw;
      if (TICKS_PER_BEAT % n) throw new YmnError(`découpage en ${n} ancres non pris en charge`, L, s.from + 1);
      const cells = Array.from({ length: n }, (_, k) => rulerLine.slice(s.from + k * cw, s.from + (k + 1) * cw).trim());
      const label = Number(cells[0]);
      if (!/^\d+$/.test(cells[0]) || label < 1) throw new YmnError("chaque temps commence par son numéro", L, s.from + 1);
      const colons = cells.filter((c) => c === ":").length;
      const division: Division = colons === 2 ? 3 : colons === 1 ? 2 : defaultDivision;
      // nouvelle mesure ? (début de bloc après une mesure fermée, ou après « || »)
      const newBar = si === 0 ? lastBarClosed || label === 1 : segs[si - 1].barEnd;
      if (si === 0 && !newBar && barLabel && barLabel !== lastBar) {
        throw new YmnError(`la mesure ${lastBar} n'est pas terminée : ce système devrait commencer par « m${lastBar} »`, L, 1);
      }
      if (si === 0 && !newBar) bar = lastBar;
      if (si > 0 && newBar) bar = nextBar(bar);
      if (newBar) barIndex++;
      const gi = beats.length;
      beats.push({ bar, barIndex, label, division });
      for (let k = 0; k < n; k++) anchors.push({ t: gi * TICKS_PER_BEAT + (k * TICKS_PER_BEAT) / n, from: s.from + k * cw, seg: si });
    });
    lastBar = bar;
    lastBarClosed = segs[segs.length - 1].barEnd;
    const t0 = blockBeat0 * TICKS_PER_BEAT;
    const t1 = beats.length * TICKS_PER_BEAT;

    // séparateurs : un trait obligatoire entre les mains, un trait facultatif sous la règle
    const content = block.lines.filter((i) => i >= 0);
    const seps = content.filter((i) => isSeparator(lines[i]));
    if (!seps.length) throw new YmnError("il manque le trait qui sépare la main droite de la main gauche", L);
    if (seps.length > 2) throw new YmnError("trop de traits : un sous la règle, un entre les mains", seps[2] + 1);
    const handSep = seps.length === 2 ? seps[1] : seps[0];
    if (seps.length === 2 && content.indexOf(seps[0]) !== 0) {
      throw new YmnError("le premier trait doit suivre directement la règle de comptage", seps[0] + 1);
    }

    const nextPending: Note[] = [];
    let lastOctave: Record<Hand, number | undefined> = { D: undefined, G: undefined };
    for (const li of content) {
      if (seps.includes(li)) continue;
      const row = lines[li];
      const R = li + 1;
      const hand: Hand = li < handSep ? "D" : "G";
      if (row[pipe] !== "|") throw new YmnError("le « | » de début de ligne doit être aligné sur celui de la règle", R, Math.min(row.length, pipe) + 1);
      for (let c = pipe; c < Math.max(row.length, rulerLine.length); c++) {
        const inRuler = rulerLine[c] === "|", inRow = row[c] === "|";
        if (c < row.length && inRuler !== inRow) {
          throw new YmnError(inRow ? "« | » mal placé : il ne tombe pas sur une séparation de la règle" : "séparation de temps attendue ici", R, c + 1);
        }
      }
      const lab = row.slice(0, pipe).trim();
      if (lab) {
        if (!/^-?\d$/.test(lab)) throw new YmnError(`numéro d'octave invalide : « ${lab} »`, R, 1);
        lastOctave[hand] = Number(lab);
      }
      const octave = lastOctave[hand];
      if (octave === undefined) throw new YmnError("la première ligne de chaque main doit indiquer son octave", R, 1);

      let open: Note | undefined;
      const close = (t: number) => {
        if (open) open.end = t;
        open = undefined;
      };
      anchors.forEach((a, ai) => {
        const raw = row.slice(a.from, a.from + cw);
        const c = raw.trim();
        const col = a.from + 1 + (raw.length - raw.trimStart().length);
        const m = c.match(/^(-?)(\d{0,2})$/);
        if (!m || (m[2] && (Number(m[2]) < 1 || Number(m[2]) > 12)) || (!m[1] && !m[2] && c)) {
          throw new YmnError(`case invalide « ${c} » : attendu un numéro de 1 à 12, « - », « -N » ou une case vide`, R, col);
        }
        const [, dash, digits] = m;
        if (!c) return close(a.t);
        if (!dash) {
          close(a.t);
          open = { hand, midi: midiOf(octave, Number(digits)), start: a.t, end: t1 };
          notes.push(open);
          return;
        }
        // tenue
        if (!digits) {
          if (open) return;
          throw new YmnError(
            ai === 0 ? "tenue en début de système : écris le numéro de la note, par exemple « -7 »" : "« - » sans note à prolonger",
            R, col,
          );
        }
        const midi = midiOf(octave, Number(digits));
        if (open) {
          if (open.midi !== midi) throw new YmnError(`« -${digits} » prolonge une note différente (${open.midi % 12 + 1})`, R, col);
          return;
        }
        const prev = ai === 0 ? pending.find((p) => p.hand === hand && p.midi === midi && p.end === t0) : undefined;
        if (prev) {
          pending = pending.filter((p) => p !== prev);
          open = prev;
        } else {
          // tenue sans origine connue (début de fichier, saisie partielle) : la note commence ici
          open = { hand, midi, start: a.t, end: t1 };
          notes.push(open);
        }
      });
      if (open) {
        open.end = t1;
        nextPending.push(open);
      }
    }
    pending = nextPending;
  }
  return { meta, beats, notes: sortNotes(notes) };
}
