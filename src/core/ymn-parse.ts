/**
 * Lecture du format texte .ymn vers le modèle.
 *
 * Les sauts de ligne sont libres : le temps absolu est reconstitué à partir des règles
 * de comptage. Voir FORMAT.md pour la grammaire complète.
 */
import { YmnError, parseFrontmatter } from "./frontmatter.ts";
import { FERMATA, GRACE_MARK, MARKER_SIGN, PEDAL_CHANGE, PEDAL_DOWN, PEDAL_UP, TICKS_PER_BEAT, isDynamic, isHairpin, isPedalSign, joinsText, sortGraces, sortNotes } from "./model.ts";
import type { Beat, Division, Expression, Grace, Hairpin, Hand, Marker, Note, Pedal, Repeat, Score, TextMark } from "./model.ts";
import { midiOf, parseOctaveLabel } from "./pitch.ts";

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
const SUB_LABELS = new Set([":", ".", ","]);

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
 * Indications d'une ligne @ : groupes de mots séparés par au moins deux espaces. Deux mots
 * à une seule espace forment un seul texte (« a tempo », « più f ») ; les signes (soufflets
 * « <--- », signes de pédale, débuts de section « *A ») restent à part (voir joinsText).
 */
function markTokens(line: string) {
  const out: { col: number; text: string }[] = [];
  const body = " " + line.slice(1); // seul le « @ » est retiré
  // morceaux : les mots
  const pieces: { col: number; text: string }[] = [];
  for (let m = /\S+/g, w = m.exec(body); w; w = m.exec(body)) {
    // un soufflet collé à une nuance (« p<--- ») en est séparé ; la découpe ne retire
    // aucun caractère : chaque morceau commence où finit le précédent
    let col = w.index;
    for (const part of w[0].split(/(?<=[^\s<>])(?=[<>][-|]*$)/)) {
      pieces.push({ col, text: part });
      col += part.length;
    }
  }
  for (const p of pieces) {
    // les barres recopiées pour se repérer sont ignorées
    const lead = p.text.length - p.text.replace(/^[|:]+/, "").length;
    const text = p.text.slice(lead).replace(/[|:]+$/, "");
    if (!text) continue;
    const col = p.col + lead;
    const prev = out[out.length - 1];
    // un mot qui suit un autre mot à une seule espace prolonge le même texte
    if (prev && joinsText(prev.text, text) && col === prev.col + prev.text.length + 1) {
      prev.text += " " + text;
    } else out.push({ col, text });
  }
  return out;
}

export function parseYmn(text: string): Score {
  const lines = text.replace(/\t/g, "    ").split(/\r?\n/);
  const { meta, bodyStartLine } = parseFrontmatter(lines);
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
  const graces: Grace[] = [];
  const repeats = new Map<number, Repeat>();
  const repeatAt = (barIndex: number) => {
    if (!repeats.has(barIndex)) repeats.set(barIndex, { barIndex });
    return repeats.get(barIndex)!;
  };
  const texts: TextMark[] = [];
  const fermatas: number[] = [];
  const expressions: Expression[] = [];
  const hairpins: Hairpin[] = [];
  const pedals: Pedal[] = [];
  let pedalDown: Pedal | undefined; // pédale enfoncée, peut-être depuis un système précédent
  const timesMarks: { bar: number; times: number; line: number; col: number }[] = [];
  const markers: (Marker & { line: number; col: number })[] = [];
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
    // une case va d'une étiquette de la règle à la suivante, quelle que soit sa largeur
    const anchors: { t: number; from: number; to: number; seg: number; barIndex: number }[] = [];
    const segBar: number[] = []; // mesure de chaque temps
    const segOpensBar: boolean[] = []; // le temps ouvre une mesure
    segs.forEach((s, si) => {
      // chaque case du temps commence par son étiquette : le numéro du temps, puis « : », « . » ou « , »
      const labels: { from: number; text: string }[] = [];
      const body = rulerLine.slice(s.from, s.to);
      for (let re = /\S+/g, w = re.exec(body); w; w = re.exec(body)) labels.push({ from: s.from + w.index, text: w[0] });
      if (!labels.length || labels[0].from !== s.from || !/^\d+$/.test(labels[0].text) || Number(labels[0].text) < 1) {
        throw new YmnError("chaque temps commence par son numéro, collé à la barre", L, s.from + 1);
      }
      for (const lb of labels.slice(1)) {
        if (!SUB_LABELS.has(lb.text)) throw new YmnError(`étiquette de case « ${lb.text} » inconnue : attendu « : », « . » ou « , »`, L, lb.from + 1);
      }
      const n = labels.length;
      if (TICKS_PER_BEAT % n) throw new YmnError(`découpage en ${n} cases non pris en charge`, L, s.from + 1);
      const cells = labels.map((lb) => lb.text);
      const label = Number(cells[0]);
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
        anchors.push({ t: gi * TICKS_PER_BEAT + (k * TICKS_PER_BEAT) / n, from: labels[k].from, to: labels[k + 1]?.from ?? s.to, seg: si, barIndex });
      }
    });
    repeatNext = segs[segs.length - 1].startRepeatAfter;
    lastBar = bar;
    lastBarClosed = segs[segs.length - 1].barEnd;
    const t0 = blockBeat0 * TICKS_PER_BEAT;
    const t1 = beats.length * TICKS_PER_BEAT;

    // ligne(s) @ au-dessus de la règle : débuts de section, nombre de passages, textes
    for (const li of block.marks) {
      for (const tok of markTokens(lines[li])) {
        const marker = tok.text.match(MARKER_SIGN);
        if (marker) {
          // « *A » sur le dernier « | » de la barre qui ouvre la mesure
          const j = spans.findIndex((sp) => tok.col >= sp.from && tok.col < sp.to);
          const sp = spans[j];
          if (j < 0 || j >= segs.length || !segOpensBar[j]) {
            throw new YmnError(`« ${tok.text} » doit être placé sur la barre qui ouvre une mesure`, li + 1, tok.col + 1);
          }
          if (tok.col !== sp.from + sp.text.lastIndexOf("|")) {
            throw new YmnError(`« ${tok.text} » doit être placé sur le dernier « | » de la barre`, li + 1, tok.col + 1);
          }
          markers.push({ label: marker[1], barIndex: segBar[j], line: li + 1, col: tok.col + 1 });
          continue;
        }
        const a = anchors.find((x) => x.from === tok.col);
        if (!a) throw new YmnError(`« ${tok.text} » doit commencer exactement sur une case de la règle de comptage`, li + 1, tok.col + 1);
        const times = tok.text.match(/^(\d+)\s*[×xX]$/);
        if (times) timesMarks.push({ bar: a.barIndex, times: Number(times[1]), line: li + 1, col: tok.col + 1 });
        else if (tok.text === FERMATA) {
          if (!fermatas.includes(a.t)) fermatas.push(a.t);
        } else texts.push({ t: a.t, text: tok.text });
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

    // ligne @ d'une voix : nuances, textes (« cresc. », « dolce »…), soufflets, et pédale sous la main gauche
    const pedalSigns: { t: number; text: string; line: number; col: number }[] = [];
    const readVoiceLine = (row: string, R: number, hand: Hand) => {
      for (const tok of markTokens(row)) {
        // un soufflet peut commencer dans la case, juste après une nuance (« p <--- ») ;
        // toute autre indication commence exactement sur une case
        const ai = isHairpin(tok.text)
          ? anchors.findIndex((x) => tok.col >= x.from && tok.col < x.to)
          : anchors.findIndex((x) => x.from === tok.col);
        if (ai < 0) throw new YmnError(`« ${tok.text} » doit commencer exactement sur une case de la règle de comptage`, R, tok.col + 1);
        const a = anchors[ai];
        if (isPedalSign(tok.text)) {
          if (hand === "D") throw new YmnError(`« ${tok.text} » : la pédale se note sur une ligne @ sous la main gauche`, R, tok.col + 1);
          pedalSigns.push({ t: a.t, text: tok.text, line: R, col: tok.col + 1 });
        } else if (isHairpin(tok.text)) {
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
          expressions.push({ hand, t: a.t, text: tok.text, kind: isDynamic(tok.text) ? "dynamic" : "text" });
        }
      }
    };

    const nextPending: Note[] = [];
    // petites notes du bloc, par main et instant : leur rang se lit de gauche à droite dans la case
    const blockGraces = new Map<string, { hand: Hand; t: number; col: number; midi: number }[]>();
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
        let raw = row.slice(a.from, a.to);
        // petites notes (« 3' »), avant la note de la case
        let graceEnd = 0;
        for (const g of raw.matchAll(/(\d+)'/g)) {
          const gc = a.from + g.index! + 1;
          const k = Number(g[1]);
          if (k < 1 || k > 12) throw new YmnError(`petite note invalide « ${g[0]} » : attendu un numéro de 1 à 12 suivi de « ${GRACE_MARK} »`, R, gc);
          const key = hand + ":" + a.t;
          if (!blockGraces.has(key)) blockGraces.set(key, []);
          blockGraces.get(key)!.push({ hand, t: a.t, col: gc, midi: midiOf(octave, k) });
          graceEnd = g.index! + g[0].length;
        }
        if (graceEnd) {
          const before = raw.slice(0, graceEnd).replace(/\d+'/g, (x) => " ".repeat(x.length));
          if (before.trim()) throw new YmnError("une petite note se place avant la note de sa case", R, a.from + before.search(/\S/) + 1);
          raw = " ".repeat(graceEnd) + raw.slice(graceEnd);
        }
        const c = raw.trim();
        const col = a.from + 1 + (raw.length - raw.trimStart().length);
        const m = c.match(/^(-?)(\d{0,2})$/);
        if (!m || (m[2] && (Number(m[2]) < 1 || Number(m[2]) > 12)) || (!m[1] && !m[2] && c)) {
          throw new YmnError(`case invalide « ${c} » : attendu un numéro de 1 à 12, « - », « -N », des petites notes « N' » ou une case vide`, R, col);
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
    for (const list of blockGraces.values()) {
      const cols = [...new Set(list.map((g) => g.col))].sort((x, y) => x - y);
      for (const g of list) graces.push({ hand: g.hand, midi: g.midi, t: g.t, slot: cols.indexOf(g.col) });
    }

    // pédale : dans l'ordre du temps, en relâchant avant d'enfoncer à un même instant
    const order = (x: string) => (x === PEDAL_UP ? 0 : x === PEDAL_CHANGE ? 1 : 2);
    pedalSigns.sort((a, b) => a.t - b.t || order(a.text) - order(b.text));
    for (const p of pedalSigns) {
      if (p.text !== PEDAL_DOWN) {
        if (!pedalDown) {
          throw new YmnError(p.text === PEDAL_UP ? "« * » sans pédale enfoncée" : "« *Ped. » sans pédale enfoncée : écris « Ped. »", p.line, p.col);
        }
        pedalDown.end = p.t;
        pedalDown = undefined;
      }
      if (p.text !== PEDAL_UP) {
        if (pedalDown) throw new YmnError("« Ped. » alors que la pédale est déjà enfoncée : écris « *Ped. » pour la changer", p.line, p.col);
        pedalDown = { start: p.t, end: -1 };
        pedals.push(pedalDown);
      }
    }
  }
  // une pédale jamais relâchée tient jusqu'à la fin du morceau
  if (pedalDown) pedalDown.end = beats.length * TICKS_PER_BEAT;

  // nombre de passages : porté par une mesure qui finit une reprise
  for (const tm of timesMarks) {
    const r = repeats.get(tm.bar);
    if (!r?.end) throw new YmnError(`« ${tm.times}× » doit être placé dans une mesure qui se termine par « :|| »`, tm.line, tm.col);
    if (tm.times !== 2) r.times = tm.times;
  }

  // sections : chaque lettre une seule fois, la première au tout début, et aucune reprise
  // à cheval sur deux sections (une reprise reste locale)
  markers.sort((a, b) => a.barIndex - b.barIndex);
  for (const m of markers) {
    if (markers.find((x) => x.label === m.label) !== m) throw new YmnError(`section « *${m.label} » posée deux fois`, m.line, m.col);
  }
  if (markers.length && markers[0].barIndex !== 0) {
    throw new YmnError(`le morceau commence avant la première section « *${markers[0].label} » : pose une section sur la première mesure`, markers[0].line, markers[0].col);
  }
  let repeatStart = 0;
  for (const r of [...repeats.values()].sort((a, b) => a.barIndex - b.barIndex)) {
    if (r.start) repeatStart = r.barIndex;
    if (!r.end) continue;
    const inside = markers.find((m) => m.barIndex > repeatStart && m.barIndex <= r.barIndex);
    if (inside) throw new YmnError(`la reprise passe le début de la section « *${inside.label} » : une reprise reste dans sa section`, inside.line, inside.col);
    repeatStart = r.barIndex + 1;
  }

  // ordre de jeu : « order: A A B C » dans le frontmatter
  const orderLine = lines.findIndex((l, i) => i < bodyStartLine && /^order\s*:/.test(l)) + 1;
  const order = meta.order === undefined ? [] : String(meta.order).trim().split(/\s+/).filter(Boolean);
  delete meta.order;
  for (const label of order) {
    if (!/^[A-Z]$/.test(label)) throw new YmnError(`ordre de jeu : « ${label} » n'est pas une lettre de section (A à Z)`, orderLine);
    if (!markers.some((m) => m.label === label)) throw new YmnError(`ordre de jeu : aucune section « *${label} » dans le morceau`, orderLine);
  }

  return {
    meta,
    beats,
    notes: sortNotes(notes),
    graces: sortGraces(graces),
    repeats: [...repeats.values()].sort((a, b) => a.barIndex - b.barIndex),
    texts,
    expressions: expressions.sort((a, b) => a.t - b.t || (a.hand === b.hand ? 0 : a.hand === "D" ? -1 : 1)),
    hairpins: hairpins.sort((a, b) => a.start - b.start || (a.hand === b.hand ? 0 : a.hand === "D" ? -1 : 1)),
    pedals: pedals.filter((p) => p.end > p.start),
    markers: markers.map(({ label, barIndex }) => ({ label, barIndex })),
    fermatas: fermatas.sort((a, b) => a - b),
    order,
  };
}
