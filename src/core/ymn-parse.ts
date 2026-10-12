/**
 * Lecture du format texte .ymn vers le modèle.
 *
 * Les sauts de ligne sont libres : le temps absolu est reconstitué à partir des règles
 * de comptage. Voir FORMAT.md pour la grammaire complète.
 */
import { YmnError, parseFrontmatter } from "./frontmatter.ts";
import { DYNAMICS, TICKS_PER_BEAT, isHairpin, sortNotes } from "./model.ts";
import type { Beat, Division, Ending, Expression, Hairpin, Hand, Note, Repeat, Score, TextMark } from "./model.ts";
import { midiOf, parseOctaveLabel } from "./pitch.ts";
import { DEFAULT_CELL } from "./ymn-write.ts";

/** Un temps de la règle de comptage, et la barre qui le termine. */
type Segment = { from: number; to: number; barEnd: boolean; endRepeat: boolean; startRepeatAfter: boolean };
/** Plage de colonnes occupée par un séparateur (« | », « :|| »…). */
type SepSpan = { from: number; to: number; text: string };

const isSeparator = (line: string) => {
  const t = line.trim();
  return t.length >= 3 && /^[─━\-=+┼|]+$/.test(t) && /[─━\-=]/.test(t);
};
const isRuler = (line: string) => /^m[^|\s]*\s*\|/.test(line);
const isMarkLine = (line: string) => line.startsWith("@");

const SEPARATORS = new Set(["|", "||", ":||", "||:", ":||:"]);

/** Découpe une règle de comptage en temps et en séparateurs. */
function parseRuler(ruler: string, lineNo: number, pipe: number) {
  const seps: { from: number; text: string }[] = [];
  let i = pipe;
  while (i < ruler.length) {
    if (ruler[i] === "|" || (ruler[i] === ":" && ruler[i + 1] === "|")) {
      let j = i;
      while (j < ruler.length && (ruler[j] === "|" || ruler[j] === ":")) j++;
      seps.push({ from: i, text: ruler.slice(i, j) });
      i = j;
    } else i++;
  }
  const trailing = ruler.slice(seps[seps.length - 1].from + seps[seps.length - 1].text.length);
  if (trailing.trim()) throw new YmnError("la règle de comptage doit se terminer par une barre (« | », « || » ou « :|| »)", lineNo, ruler.length - trailing.length + 1);

  // la première barre fait partie de la colonne de gauche : « | » ou « ||: »
  const lead = seps[0].text;
  if (lead !== "|" && lead !== "||:") throw new YmnError(`début de règle invalide « ${lead} » : attendu « | » ou « ||: »`, lineNo, pipe + 1);
  for (const s of seps.slice(1)) {
    if (!SEPARATORS.has(s.text)) throw new YmnError(`barre invalide « ${s.text} » : attendu |, ||, :||, ||: ou :||:`, lineNo, s.from + 1);
  }
  const segs: Segment[] = [];
  for (let k = 0; k + 1 < seps.length; k++) {
    const from = seps[k].from + seps[k].text.length;
    const to = seps[k + 1].from;
    const t = seps[k + 1].text;
    segs.push({ from, to, barEnd: t !== "|", endRepeat: t.startsWith(":"), startRepeatAfter: t.endsWith(":") });
  }
  if (!segs.length) throw new YmnError("règle de comptage sans aucun temps", lineNo);
  const spans: SepSpan[] = seps.map((s) => ({ from: s.from, to: s.from + s.text.length, text: s.text }));
  return { segs, spans, leadRepeat: lead === "||:" };
}

const nextBar = (bar: string) => (/^\d+$/.test(bar) ? String(Number(bar) + 1) : bar + "'");

/**
 * Indications d'une ligne @ : groupes de mots séparés par au moins deux espaces
 * (« a tempo », « più f » restent un seul texte). Les signes de case « [1. » et « ] »,
 * et les soufflets « <--- », sont toujours des indications à part, même séparés par une
 * seule espace (ou collés, pour « ][2. »).
 */
function markTokens(line: string) {
  const out: { col: number; text: string }[] = [];
  const body = " " + line.slice(1); // seul le « @ » est retiré
  // morceaux : mots, en coupant devant chaque « [ » et derrière chaque « ] »
  const pieces: { col: number; text: string }[] = [];
  for (let m = /\S+/g, w = m.exec(body); w; w = m.exec(body)) {
    // la découpe ne retire aucun caractère : chaque morceau commence où finit le précédent
    let col = w.index;
    for (const part of w[0].split(/(?=\[)|(?<=\])/)) {
      pieces.push({ col, text: part });
      col += part.length;
    }
  }
  const structural = (t: string) => t.startsWith("[") || t === "]" || isHairpin(t);
  for (const p of pieces) {
    // les barres recopiées pour se repérer sont ignorées
    const lead = p.text.length - p.text.replace(/^[|:]+/, "").length;
    const text = p.text.slice(lead).replace(/[|:]+$/, "");
    if (!text) continue;
    const col = p.col + lead;
    const prev = out[out.length - 1];
    // un mot de texte qui suit un autre mot à une seule espace prolonge le même texte
    if (prev && !structural(prev.text) && !structural(text) && col === prev.col + prev.text.length + 1) {
      prev.text += " " + text;
    } else out.push({ col, text });
  }
  return out;
}

export function parseYmn(text: string): Score {
  const lines = text.replace(/\t/g, "    ").split(/\r?\n/);
  const { meta, bodyStartLine } = parseFrontmatter(lines);
  const cw = Number(meta.cell ?? DEFAULT_CELL);
  const defaultDivision = (Number(meta.division ?? 2) === 3 ? 3 : 2) as Division;

  // découpage en blocs : lignes @, une règle de comptage, puis les lignes qui la suivent
  type Block = { marks: number[]; ruler: number; lines: number[] };
  const blocks: Block[] = [];
  let pendingMarks: number[] = [];
  for (let i = bodyStartLine; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim() || l.trimStart().startsWith("#")) {
      if (!l.trim() && blocks.length) blocks[blocks.length - 1].lines.push(-1); // fin de bloc
      continue;
    }
    if (isMarkLine(l)) {
      const last = blocks[blocks.length - 1];
      // sous les lignes d'une main, sans ligne vide : ligne @ de cette voix (nuances, soufflets)
      if (last && !last.lines.includes(-1) && !pendingMarks.length) last.lines.push(i);
      else pendingMarks.push(i);
      continue;
    }
    if (isRuler(l)) {
      blocks.push({ marks: pendingMarks, ruler: i, lines: [] });
      pendingMarks = [];
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (!last || pendingMarks.length) throw new YmnError("une règle de comptage (« m1 |1 … ») doit précéder les lignes de notes", i + 1);
    if (last.lines.includes(-1)) throw new YmnError("ligne de notes séparée de sa règle de comptage par une ligne vide", i + 1);
    last.lines.push(i);
  }
  if (pendingMarks.length) throw new YmnError("ligne @ sans règle de comptage en dessous", pendingMarks[0] + 1);
  if (!blocks.length) throw new YmnError("aucune règle de comptage trouvée", bodyStartLine + 1);

  const beats: Beat[] = [];
  const notes: Note[] = [];
  const repeats = new Map<number, Repeat>();
  const repeatAt = (barIndex: number) => {
    if (!repeats.has(barIndex)) repeats.set(barIndex, { barIndex });
    return repeats.get(barIndex)!;
  };
  const texts: TextMark[] = [];
  const expressions: Expression[] = [];
  const hairpins: Hairpin[] = [];
  const endingStarts: { numbers: number[]; bar: number }[] = [];
  const endingCloses: number[] = [];
  const timesMarks: { bar: number; times: number; line: number; col: number }[] = [];
  let barIndex = -1;
  let lastBar = "0";
  let lastBarClosed = true;
  let repeatNext = false; // « ||: » en fin de système : la mesure suivante commence une reprise
  let pending: Note[] = []; // notes encore tenues à la fin du bloc précédent

  for (const block of blocks) {
    const rulerLine = lines[block.ruler];
    const L = block.ruler + 1;
    const pipe = rulerLine.indexOf("|");
    const barLabel = rulerLine.slice(1, pipe).trim();
    const { segs, spans, leadRepeat } = parseRuler(rulerLine, L, pipe);

    // temps du bloc
    const blockBeat0 = beats.length;
    let bar = barLabel || nextBar(lastBar);
    const anchors: { t: number; from: number; seg: number; barIndex: number }[] = [];
    const segBar: number[] = []; // mesure de chaque temps
    const segOpensBar: boolean[] = []; // le temps ouvre une mesure
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
      // nouvelle mesure ? (début de bloc après une mesure fermée, ou après une barre de mesure)
      const newBar = si === 0 ? lastBarClosed || label === 1 : segs[si - 1].barEnd;
      if (si === 0 && !newBar && barLabel && barLabel !== lastBar) {
        throw new YmnError(`la mesure ${lastBar} n'est pas terminée : ce système devrait commencer par « m${lastBar} »`, L, 1);
      }
      if (si === 0 && !newBar && leadRepeat) throw new YmnError("« ||: » ne peut pas couper une mesure en deux", L, pipe + 1);
      if (si === 0 && !newBar) bar = lastBar;
      if (si > 0 && newBar) bar = nextBar(bar);
      if (newBar) {
        barIndex++;
        if (repeatNext || (si === 0 && leadRepeat) || (si > 0 && segs[si - 1].startRepeatAfter)) repeatAt(barIndex).start = true;
        repeatNext = false;
      }
      if (s.endRepeat) repeatAt(barIndex).end = true;
      segBar.push(barIndex);
      segOpensBar.push(newBar);
      const gi = beats.length;
      beats.push({ bar, barIndex, label, division });
      for (let k = 0; k < n; k++) {
        anchors.push({ t: gi * TICKS_PER_BEAT + (k * TICKS_PER_BEAT) / n, from: s.from + k * cw, seg: si, barIndex });
      }
    });
    repeatNext = segs[segs.length - 1].startRepeatAfter;
    lastBar = bar;
    lastBarClosed = segs[segs.length - 1].barEnd;
    const t0 = blockBeat0 * TICKS_PER_BEAT;
    const t1 = beats.length * TICKS_PER_BEAT;

    // ligne(s) @ au-dessus de la règle : cases de reprise, nombre de passages, textes
    for (const li of block.marks) {
      for (const tok of markTokens(lines[li])) {
        const ending = tok.text.match(/^\[((?:\d+\.)+)$/);
        if (ending || tok.text === "]") {
          // « [1. » sur le dernier « | » de la barre qui ouvre la mesure,
          // « ] » sur le premier « | » de la barre qui la ferme : « ][2. » s'enchaînent
          const j = spans.findIndex((sp) => tok.col >= sp.from && tok.col < sp.to);
          const sp = spans[j];
          if (ending) {
            if (j < 0 || j >= segs.length || !segOpensBar[j]) {
              throw new YmnError(`« ${tok.text} » doit être placé sur la barre qui ouvre une mesure`, li + 1, tok.col + 1);
            }
            if (tok.col !== sp.from + sp.text.lastIndexOf("|")) {
              throw new YmnError(`« ${tok.text} » doit être placé sur le dernier « | » de la barre`, li + 1, tok.col + 1);
            }
            endingStarts.push({ numbers: ending[1].split(".").filter(Boolean).map(Number), bar: segBar[j] });
          } else {
            if (j < 1 || !segs[j - 1].barEnd) {
              throw new YmnError("« ] » doit être placé sur la barre qui ferme une mesure", li + 1, tok.col + 1);
            }
            if (tok.col !== sp.from + sp.text.indexOf("|")) {
              throw new YmnError("« ] » doit être placé sur le premier « | » de la barre", li + 1, tok.col + 1);
            }
            endingCloses.push(segBar[j - 1]);
          }
          continue;
        }
        const a = anchors.find((x) => x.from === tok.col);
        if (!a) throw new YmnError(`« ${tok.text} » doit commencer exactement sur une case de la règle de comptage`, li + 1, tok.col + 1);
        const times = tok.text.match(/^(\d+)\s*[×xX]$/);
        if (times) timesMarks.push({ bar: a.barIndex, times: Number(times[1]), line: li + 1, col: tok.col + 1 });
        else texts.push({ t: a.t, text: tok.text });
      }
    }

    // séparateurs : un trait obligatoire entre les mains, un trait facultatif sous la règle
    const content = block.lines.filter((i) => i >= 0);
    const seps = content.filter((i) => isSeparator(lines[i]));
    if (!seps.length) throw new YmnError("il manque le trait qui sépare la main droite de la main gauche", L);
    if (seps.length > 2) throw new YmnError("trop de traits : un sous la règle, un entre les mains", seps[2] + 1);
    const handSep = seps.length === 2 ? seps[1] : seps[0];
    if (seps.length === 2 && content.indexOf(seps[0]) !== 0) {
      throw new YmnError("le premier trait doit suivre directement la règle de comptage", seps[0] + 1);
    }
    const inSpan = (c: number) => spans.some((s) => c >= s.from && c < s.to);

    // ligne @ d'une voix : nuances, textes (« cresc. », « dolce »…) et soufflets
    const readVoiceLine = (row: string, R: number, hand: Hand) => {
      for (const tok of markTokens(row)) {
        const ai = anchors.findIndex((x) => x.from === tok.col);
        if (ai < 0) throw new YmnError(`« ${tok.text} » doit commencer exactement sur une case de la règle de comptage`, R, tok.col + 1);
        const a = anchors[ai];
        if (isHairpin(tok.text)) {
          // le soufflet finit avec la case qui contient son dernier caractère
          const last = tok.col + tok.text.length - 1;
          const next = anchors.find((x) => x.from > last);
          const end = next ? next.t : t1;
          const kind = tok.text[0] as Hairpin["kind"];
          // suite d'un soufflet du système précédent
          const prev = ai === 0 ? hairpins.find((h) => h.hand === hand && h.kind === kind && h.end === t0) : undefined;
          if (prev) prev.end = end;
          else hairpins.push({ hand, kind, start: a.t, end });
        } else {
          expressions.push({ hand, t: a.t, text: tok.text, kind: DYNAMICS.includes(tok.text) ? "dynamic" : "text" });
        }
      }
    };

    const nextPending: Note[] = [];
    const lastOctave: Record<Hand, number | undefined> = { D: undefined, G: undefined };
    const voiceLine: Record<Hand, boolean> = { D: false, G: false };
    for (const li of content) {
      if (seps.includes(li)) continue;
      const row = lines[li];
      const R = li + 1;
      const hand: Hand = li < handSep ? "D" : "G";
      if (isMarkLine(row)) {
        voiceLine[hand] = true;
        readVoiceLine(row, R, hand);
        continue;
      }
      if (voiceLine[hand]) {
        throw new YmnError(`ligne de notes sous une ligne @ : les lignes @ se placent ${hand === "D" ? "juste au-dessus du trait entre les mains" : "à la fin du système"}`, R, 1);
      }
      if (row[pipe] !== "|") throw new YmnError("le « | » de début de ligne doit être aligné sur celui de la règle", R, Math.min(row.length, pipe) + 1);
      // les barres (et leurs deux points de reprise, facultatifs) sont alignées sur la règle
      for (let c = pipe; c < row.length; c++) {
        const rc = rulerLine[c], ch = row[c];
        if (inSpan(c)) {
          if (rc === "|" && ch !== "|") throw new YmnError("barre attendue ici, alignée sur la règle de comptage", R, c + 1);
          if (rc === ":" && ch !== ":" && ch !== " ") throw new YmnError("« : » de reprise ou espace attendu ici", R, c + 1);
        } else if (ch === "|") {
          throw new YmnError("« | » mal placé : il ne tombe pas sur une barre de la règle", R, c + 1);
        }
      }
      const lab = row.slice(0, pipe).trim();
      if (lab) {
        const oct = parseOctaveLabel(lab);
        if (oct === undefined) {
          throw new YmnError(`octave invalide : « ${lab} » (attendu 0 pour l'octave du do central, +1, -1, +2…)`, R, 1);
        }
        lastOctave[hand] = oct;
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
          if (open.midi !== midi) throw new YmnError(`« -${digits} » prolonge une note différente (${(open.midi % 12) + 1})`, R, col);
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

  // nombre de passages : porté par une mesure qui finit une reprise
  for (const tm of timesMarks) {
    const r = repeats.get(tm.bar);
    if (!r?.end) throw new YmnError(`« ${tm.times}× » doit être placé dans une mesure qui se termine par « :|| »`, tm.line, tm.col);
    if (tm.times !== 2) r.times = tm.times;
  }

  // cases : une case se poursuit jusqu'à « ] » ou jusqu'à la fin de reprise « :|| »
  // qu'elle contient ; sinon jusqu'à la case suivante, au « ||: » suivant ou à la fin du morceau
  const endings: Ending[] = [];
  const lastBarIndex = barIndex;
  endingStarts.forEach((e, i) => {
    const limit = Math.min(i + 1 < endingStarts.length ? endingStarts[i + 1].bar - 1 : lastBarIndex, lastBarIndex);
    let lastBar = limit;
    let explicit = false;
    for (let b = e.bar; b <= limit; b++) {
      if (b > e.bar && repeats.get(b)?.start) {
        lastBar = b - 1;
        break;
      }
      if (endingCloses.includes(b) || repeats.get(b)?.end) {
        lastBar = b;
        explicit = true;
        break;
      }
    }
    const ending: Ending = { numbers: e.numbers, firstBar: e.bar, lastBar };
    if (!explicit) ending.open = true;
    endings.push(ending);
  });

  return {
    meta,
    beats,
    notes: sortNotes(notes),
    repeats: [...repeats.values()].sort((a, b) => a.barIndex - b.barIndex),
    endings,
    texts,
    expressions: expressions.sort((a, b) => a.t - b.t || (a.hand === b.hand ? 0 : a.hand === "D" ? -1 : 1)),
    hairpins: hairpins.sort((a, b) => a.start - b.start || (a.hand === b.hand ? 0 : a.hand === "D" ? -1 : 1)),
  };
}
