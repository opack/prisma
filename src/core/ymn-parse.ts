/**
 * Lecture du format texte .ymn vers le modèle.
 *
 * Les sauts de ligne sont libres : le temps absolu est reconstitué à partir des règles
 * de comptage. Voir FORMAT.md pour la grammaire complète.
 */
import { chordNotes } from "./chords.ts";
import { YmnError, parseFrontmatter } from "./frontmatter.ts";
import { ARPEGGIO_DOWN, FERMATA, articulationOf, isArticulationSign, HYPHEN, LYRIC_LINE, isExtender, sortLyrics, FINGER_MARK, GRACE_MARK, TRILL_MARK, isArpeggioSign, trillAux, MARKER_SIGN, PEDAL_CHANGE, PEDAL_DOWN, PEDAL_UP, TICKS_PER_BEAT, isDynamic, isHairpin, isPedalSign, isSlur, isPedalText, joinsText, sortArticulations, sortGraces, sortNotes } from "./model.ts";
import type { Arpeggio, Articulation, Beat, Division, Expression, Grace, Hairpin, Instrument, Lyric, Marker, Note, Part, Pedal, PedalText, Repeat, Score, Slur, TextMark } from "./model.ts";
import { midiOf, parseOctaveLabel } from "./pitch.ts";

/** Un temps de la règle de comptage, et la barre qui le termine. */
type Segment = { from: number; to: number; barEnd: boolean; endRepeat: boolean; startRepeatAfter: boolean };
/** Plage de colonnes occupée par un séparateur (« | », « :|| »…). */
type SepSpan = { from: number; to: number; text: string };

/**
 * Trait entre deux parties : simple (« ─── », « --- ») entre deux parties d'un instrument,
 * double (« ═══ », « === ») entre deux instruments. Le trait au-dessus de la première partie
 * d'un instrument porte son nom, entouré d'espaces : « ═══╪═ Piano ═══╪═══ ».
 */
type Rule = { double: boolean; name?: string };
const RULE_CHARS = /^[─━\-=═+┼╪|]+$/;
const HORIZONTAL = /[─━\-=═]/;
export function parseRule(line: string, lineNo: number): Rule | undefined {
  const t = line.trim();
  let body = t;
  let name: string | undefined;
  if (!RULE_CHARS.test(t)) {
    // le nom, n'importe où sur le trait, entre des espaces (une ou plusieurs)
    const m = t.match(/^([─━\-=═+┼╪|]+) +(\S.*?\S|\S) +([─━\-=═+┼╪|]+)$/);
    if (!m || !HORIZONTAL.test(m[1]) || !HORIZONTAL.test(m[3]) || !/\p{L}/u.test(m[2])) return undefined;
    body = m[1] + m[3];
    name = m[2];
  }
  if (t.length < 3 || !HORIZONTAL.test(body)) return undefined;
  const double = /[═=╪]/.test(body);
  if (double && /[─━\-]/.test(body)) throw new YmnError("trait mélangé : simple (─) entre deux parties d'un instrument, double (═) entre deux instruments", lineNo, 1);
  return { double, ...(name ? { name } : {}) };
}
export const isRuler = (line: string) => /^m[^|\s]*\s*\|/.test(line);
const isMarkLine = (line: string) => line.startsWith("@");
/** Ligne des accords : « @c », puis chaque accord sur sa case. */
export const CHORD_LINE = "@c";
const isChordLine = (line: string) => line === CHORD_LINE || line.startsWith(CHORD_LINE + " ");
/** Ligne des paroles d'un couplet, sous les lignes de sa partie. */
const isLyricLine = (line: string) => line === LYRIC_LINE || line.startsWith(LYRIC_LINE + " ");

const SEPARATORS = new Set(["|", "||", ":||", "||:", ":||:"]);
const SUB_LABELS = new Set(["*", ".", ","]);

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
 * « <--- », signes de pédale, débuts de section « [A] ») restent à part (voir joinsText).
 */
export function markTokens(line: string) {
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
  // instruments déclarés : « parts: Chant, Piano », chacun nommé sur le trait au-dessus de sa première partie
  const partsLine = lines.findIndex((l, i) => i < bodyStartLine && /^parts\s*:/.test(l)) + 1;
  const declared = meta.parts === undefined ? undefined : String(meta.parts).split(",").map((x) => x.trim());
  delete meta.parts;
  if (declared) {
    if (declared.some((x) => !x)) throw new YmnError("« parts » : les noms des instruments, séparés par des virgules (parts: Chant, Piano)", partsLine);
    const twice = declared.find((x, i) => declared.indexOf(x) !== i);
    if (twice) throw new YmnError(`« parts » : l'instrument « ${twice} » est nommé deux fois`, partsLine);
  }
  let instruments: Instrument[] | undefined; // fixés par le premier système
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
      // sous les lignes d'une partie, sans ligne vide : ligne @ de cette partie (nuances, soufflets)
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
  const chords: TextMark[] = [];
  const lyrics: Lyric[] = [];
  // fin de la case de chaque syllabe prolongée : sa prolongation doit la dépasser
  const lyricCell = new Map<Lyric, { end: number; line: number; col: number }>();
  const arpeggios: Arpeggio[] = [];
  const articulations: Articulation[] = [];
  /** Arpège posé une seule fois par instant et par partie (ou pour toutes les parties). */
  const addArpeggio = (x: Arpeggio, line: number, col: number) => {
    const clash = arpeggios.find((y) => y.t === x.t && (y.part === undefined || x.part === undefined || y.part === x.part));
    if (clash) throw new YmnError("un seul arpège par accord : sur la ligne @ d'une partie, ou sur celle du haut pour toutes les parties", line, col);
    arpeggios.push(x);
  };
  const expressions: Expression[] = [];
  const hairpins: Hairpin[] = [];
  const pedals: Pedal[] = [];
  const slurs: Slur[] = [];
  type OpenSlur = { slur: Slur; line: number; col: number };
  let openSlurs: OpenSlur[] = []; // liaisons ouvertes dans ce système, qui continuent au suivant
  let pendingSlurs: OpenSlur[] = [];
  const slurAt = new Map<Slur, { line: number; col: number }>(); // position du « ( », pour les erreurs // liaisons du système précédent, à reprendre en tête de celui-ci
  const pedalTexts: PedalText[] = [];
  const pedalDown = new Map<Part, Pedal>(); // pédale enfoncée de chaque partie, peut-être depuis un système précédent
  const timesMarks: { bar: number; times: number; line: number; col: number }[] = [];
  const markers: (Marker & { line: number; col: number })[] = [];
  let barIndex = -1;
  let lastBar = "0";
  let lastBarClosed = true;
  let repeatNext = false; // « ||: » en fin de système : la mesure suivante commence une reprise
  let pending: Note[] = []; // notes encore tenues à la fin du bloc précédent

  for (const block of blocks) {
    pendingSlurs = openSlurs;
    openSlurs = [];
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
      // chaque case du temps commence par son étiquette : le numéro du temps, puis « * », « . » ou « , »
      const labels: { from: number; text: string }[] = [];
      const body = rulerLine.slice(s.from, s.to);
      for (let re = /\S+/g, w = re.exec(body); w; w = re.exec(body)) labels.push({ from: s.from + w.index, text: w[0] });
      if (!labels.length || labels[0].from !== s.from || !/^\d+$/.test(labels[0].text) || Number(labels[0].text) < 1) {
        throw new YmnError("chaque temps commence par son numéro, collé à la barre", L, s.from + 1);
      }
      for (const lb of labels.slice(1)) {
        if (!SUB_LABELS.has(lb.text)) throw new YmnError(`étiquette de case « ${lb.text} » inconnue : attendu « * », « . » ou « , »`, L, lb.from + 1);
      }
      const n = labels.length;
      if (TICKS_PER_BEAT % n) throw new YmnError(`découpage en ${n} cases non pris en charge`, L, s.from + 1);
      const cells = labels.map((lb) => lb.text);
      const label = Number(cells[0]);
      const stars = cells.filter((c) => c === "*").length;
      const division: Division = stars === 2 ? 3 : stars === 1 ? 2 : defaultDivision;
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
      if (isLyricLine(lines[li])) throw new YmnError("les paroles se placent sous les lignes de leur partie, comme ses nuances", li + 1, 1);
      if (isChordLine(lines[li])) {
        // accords : chaque mot est un accord, posé sur une case (pas de texte de plusieurs mots)
        const line = lines[li];
        const re = /\S+/g;
        re.lastIndex = CHORD_LINE.length;
        for (let w = re.exec(line); w; w = re.exec(line)) {
          const col = w.index;
          const a = anchors.find((x) => x.from === col);
          if (!a) throw new YmnError(`accord « ${w[0]} » : il doit commencer exactement sur une case de la règle de comptage`, li + 1, col + 1);
          if (!chordNotes(w[0])) {
            throw new YmnError(`accord inconnu « ${w[0]} » : nom anglais (Am, G7, F#m7b5, G/B…) ou notes ymn séparées par « ; », de la basse vers l'aigu (10;1;5)`, li + 1, col + 1);
          }
          if (chords.some((c) => c.t === a.t)) throw new YmnError("deux accords sur une même case", li + 1, col + 1);
          chords.push({ t: a.t, text: w[0] });
        }
        continue;
      }
      for (const tok of markTokens(lines[li])) {
        const marker = tok.text.match(MARKER_SIGN);
        if (marker) {
          // « [A] » : son « [ » sur le dernier « | » de la barre qui ouvre la mesure
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
        } else if (isArpeggioSign(tok.text)) {
          addArpeggio({ t: a.t, ...(tok.text === ARPEGGIO_DOWN ? { down: true } : {}) }, li + 1, tok.col + 1);
        } else if (isArticulationSign(tok.text)) {
          throw new YmnError(`« ${tok.text} » : une articulation se place sur une ligne @ sous sa partie`, li + 1, tok.col + 1);
        } else texts.push({ t: a.t, text: tok.text });
      }
    }

    // parties : séparées par des traits ; un trait facultatif sous la règle ouvre la première
    const content = block.lines.filter((i) => i >= 0);
    const rules = new Map<number, Rule>();
    for (const i of content) {
      const r = parseRule(lines[i], i + 1);
      if (r) rules.set(i, r);
    }
    const partOfLine = new Map<number, Part>();
    const blockParts: { rule?: Rule; line: number }[] = [{ line: L }];
    content.forEach((li, k) => {
      const r = rules.get(li);
      if (!r) return partOfLine.set(li, blockParts.length - 1);
      if (k === 0) {
        if (r.double) throw new YmnError("le trait sous la règle est simple (─) : le double (═) sépare deux instruments", li + 1, 1);
        blockParts[0] = { rule: r, line: li + 1 };
      } else blockParts.push({ rule: r, line: li + 1 });
    });
    // instruments du système : un trait double en commence un nouveau
    const here: { name?: string; parts: number; line: number }[] = [];
    blockParts.forEach((bp, k) => {
      if (k === 0 || bp.rule!.double) here.push({ ...(bp.rule?.name ? { name: bp.rule.name } : {}), parts: 1, line: bp.line });
      else {
        if (bp.rule!.name) throw new YmnError(`« ${bp.rule!.name} » : le nom d'un instrument s'écrit sur le trait double (═) qui le commence`, bp.line, 1);
        here[here.length - 1].parts++;
      }
    });
    here.forEach((x, k) => {
      if (!declared) {
        if (x.name) throw new YmnError(`instrument « ${x.name} » non déclaré : nomme les instruments dans le frontmatter (parts: …)`, x.line, 1);
        return;
      }
      if (k >= declared.length) throw new YmnError(`instrument de trop : « parts » en déclare ${declared.length} (${declared.join(", ")})`, x.line, 1);
      if (!x.name) throw new YmnError(`il manque le nom de l'instrument « ${declared[k]} » sur le trait au-dessus de sa première partie`, x.line, 1);
      if (x.name !== declared[k]) {
        throw new YmnError(declared.includes(x.name) ? `« ${x.name} » à la place de « ${declared[k]} » : les instruments se suivent dans l'ordre de « parts »` : `instrument « ${x.name} » non déclaré dans « parts » (${declared.join(", ")})`, x.line, 1);
      }
    });
    if (declared && here.length < declared.length) throw new YmnError(`il manque des instruments : « parts » en déclare ${declared.length} (${declared.join(", ")})`, L, 1);
    if (!instruments) instruments = here.map(({ name, parts }) => ({ ...(name ? { name } : {}), parts }));
    else if (here.length !== instruments.length || here.some((x, k) => x.parts !== instruments![k].parts)) {
      const shape = (xs: { parts: number }[]) => xs.map((x) => x.parts).join(" + ");
      throw new YmnError(`ce système n'a pas les mêmes parties que le premier (${shape(here)} au lieu de ${shape(instruments)}) : chaque système écrit toutes les parties, même vides`, L, 1);
    }
    const partTotal = blockParts.length;
    // dernière partie de chaque instrument : celle qui porte la pédale
    const lastParts = new Set(here.map((_, k) => here.slice(0, k + 1).reduce((n, x) => n + x.parts, 0) - 1));
    const inSpan = (c: number) => spans.some((s) => c >= s.from && c < s.to);

    // ligne @ d'une partie : nuances, textes (« cresc. », « dolce »…), soufflets, et pédale
    // sous la dernière partie d'un instrument
    const pedalSigns: { part: Part; t: number; text: string; line: number; col: number }[] = [];
    const readVoiceLine = (row: string, R: number, part: Part) => {
      for (const tok of markTokens(row)) {
        // un soufflet, une liaison ou une articulation peut commencer dans la case, juste
        // après une autre indication (« p <--- », « . ! ») ; le reste commence exactement sur une case
        const ai = isHairpin(tok.text) || isSlur(tok.text) || isArticulationSign(tok.text)
          ? anchors.findIndex((x) => tok.col >= x.from && tok.col < x.to)
          : anchors.findIndex((x) => x.from === tok.col);
        if (ai < 0) throw new YmnError(`« ${tok.text} » doit commencer exactement sur une case de la règle de comptage`, R, tok.col + 1);
        const a = anchors[ai];
        if (isArpeggioSign(tok.text)) {
          addArpeggio({ t: a.t, part, ...(tok.text === ARPEGGIO_DOWN ? { down: true } : {}) }, R, tok.col + 1);
        } else if (isArticulationSign(tok.text)) {
          const kind = articulationOf(tok.text)!;
          if (articulations.some((x) => x.part === part && x.t === a.t && x.kind === kind)) throw new YmnError(`« ${tok.text} » posé deux fois sur la même case`, R, tok.col + 1);
          articulations.push({ part, t: a.t, kind });
        } else if (isPedalSign(tok.text) || isPedalText(tok.text)) {
          if (!lastParts.has(part)) throw new YmnError(`« ${tok.text} » : la pédale se note sur une ligne @ sous la dernière partie de son instrument`, R, tok.col + 1);
          if (isPedalText(tok.text)) pedalTexts.push({ part, t: a.t, text: tok.text });
          else pedalSigns.push({ part, t: a.t, text: tok.text, line: R, col: tok.col + 1 });
        } else if (isSlur(tok.text)) {
          // suite d'une liaison du système précédent : elle reprend sur la première case
          // plusieurs suites : de haut en bas, dans l'ordre où les liaisons ont commencé
          const cont = tok.text.startsWith("(")
            ? undefined
            : pendingSlurs.filter((o) => o.slur.part === part).sort((x, y) => x.slur.start - y.slur.start)[0];
          if (!tok.text.startsWith("(") && (!cont || ai !== 0)) {
            throw new YmnError("« ---) » sans liaison ouverte : une liaison commence par « ( »", R, tok.col + 1);
          }
          const slur = cont ? cont.slur : { part, start: a.t, end: -1 };
          if (cont) pendingSlurs = pendingSlurs.filter((o) => o !== cont);
          else {
            slurs.push(slur);
            slurAt.set(slur, { line: R, col: tok.col + 1 });
          }
          if (tok.text.endsWith(")")) {
            const last = tok.col + tok.text.length - 1;
            const end = anchors.filter((x) => x.from <= last).pop()!;
            slur.end = end.t;
          } else openSlurs.push({ slur, line: R, col: tok.col + 1 });
        } else if (isHairpin(tok.text)) {
          // le soufflet finit avec la case qui contient son dernier caractère
          const last = tok.col + tok.text.length - 1;
          const next = anchors.find((x) => x.from > last);
          const end = next ? next.t : t1;
          const kind = tok.text[0] as Hairpin["kind"];
          // suite d'un soufflet du système précédent
          const prev = ai === 0 ? hairpins.find((h) => h.part === part && h.kind === kind && h.end === t0) : undefined;
          if (prev) prev.end = end;
          else hairpins.push({ part, kind, start: a.t, end });
        } else {
          expressions.push({ part, t: a.t, text: tok.text, kind: isDynamic(tok.text) ? "dynamic" : "text" });
        }
      }
    };

    // ligne de paroles d'une voix : une syllabe par case, « lu- » si le mot continue sur la
    // suivante, « --- » pour prolonger la syllabe précédente sur plusieurs notes
    const readLyricLine = (row: string, R: number, part: Part, verse: number) => {
      let last: Lyric | undefined; // syllabe précédente sur la ligne
      let extended = false; // elle a déjà sa prolongation
      // seules les espaces séparent les syllabes : une espace insécable reste dans la syllabe (« Oh ! »)
      for (const w of row.slice(LYRIC_LINE.length).matchAll(/[^ ]+/g)) {
        const tok = w[0];
        const col = LYRIC_LINE.length + w.index!;
        if (/^[|:]+$/.test(tok)) continue; // barres recopiées pour se repérer
        if (isExtender(tok)) {
          // la prolongation va jusqu'au bout de la case qui contient son dernier caractère
          const lastCh = col + tok.length - 1;
          const end = anchors.find((x) => x.from > lastCh)?.t ?? t1;
          if (!last) {
            // suite de la prolongation d'une syllabe du système précédent
            const prev = col === anchors[0].from ? lyrics.find((l) => l.part === part && l.verse === verse && l.extend === t0) : undefined;
            if (!prev) throw new YmnError("« --- » prolonge la syllabe qui le précède sur la ligne : écris d'abord la syllabe", R, col + 1);
            prev.extend = end;
            last = prev;
          } else {
            if (last.hyphen) throw new YmnError(`« ${last.text}${HYPHEN} » continue sur la syllabe suivante : elle ne se prolonge pas`, R, col + 1);
            if (extended) throw new YmnError("une seule prolongation par syllabe", R, col + 1);
            // une syllabe sur la dernière case d'un système se prolonge au suivant : vérifié à la fin
            const ai = anchors.findIndex((x) => x.t === last!.t);
            lyricCell.set(last, { end: anchors[ai + 1]?.t ?? t1, line: R, col: col + 1 });
            last.extend = end;
          }
          extended = true;
          continue;
        }
        const a = anchors.find((x) => x.from === col);
        if (!a) throw new YmnError(`syllabe « ${tok} » : elle doit commencer exactement sur une case de la règle de comptage`, R, col + 1);
        const hyphen = tok.length > 1 && tok.endsWith(HYPHEN);
        last = { part, verse, t: a.t, text: hyphen ? tok.slice(0, -HYPHEN.length) : tok, ...(hyphen ? { hyphen: true } : {}) };
        extended = false;
        lyrics.push(last);
      }
    };

    const nextPending: Note[] = [];
    // petites notes du bloc, par partie et instant : leur rang se lit de gauche à droite dans la case
    const blockGraces = new Map<string, { part: Part; t: number; col: number; midi: number }[]>();
    const lastOctave: (number | undefined)[] = Array(partTotal).fill(undefined);
    const voiceLine: boolean[] = Array(partTotal).fill(false);
    const verses: number[] = Array(partTotal).fill(0); // couplets : les lignes @l d'une partie, de haut en bas
    for (const li of content) {
      if (rules.has(li)) continue;
      const row = lines[li];
      const R = li + 1;
      const part = partOfLine.get(li)!;
      if (isChordLine(row)) throw new YmnError("les accords se placent au-dessus de la règle de comptage", R, 1);
      if (isLyricLine(row)) {
        voiceLine[part] = true;
        readLyricLine(row, R, part, ++verses[part]);
        continue;
      }
      if (isMarkLine(row)) {
        voiceLine[part] = true;
        readVoiceLine(row, R, part);
        continue;
      }
      if (voiceLine[part]) {
        throw new YmnError("ligne de notes sous une ligne @ : les lignes @ d'une partie se placent après toutes ses lignes de notes", R, 1);
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
        lastOctave[part] = oct;
      }
      const octave = lastOctave[part];
      if (octave === undefined) throw new YmnError("la première ligne de chaque partie doit indiquer son octave", R, 1);

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
          const key = part + ":" + a.t;
          if (!blockGraces.has(key)) blockGraces.set(key, []);
          blockGraces.get(key)!.push({ part, t: a.t, col: gc, midi: midiOf(octave, k) });
          graceEnd = g.index! + g[0].length;
        }
        if (graceEnd) {
          const before = raw.slice(0, graceEnd).replace(/\d+'/g, (x) => " ".repeat(x.length));
          if (before.trim()) throw new YmnError("une petite note se place avant la note de sa case", R, a.from + before.search(/\S/) + 1);
          raw = " ".repeat(graceEnd) + raw.slice(graceEnd);
        }
        const c = raw.trim();
        const col = a.from + 1 + (raw.length - raw.trimStart().length);
        const m = c.match(/^(-?)(\d{0,2})(?:~(\d{1,2}))?(?:_(\d))?$/);
        const bad = (k?: string) => !!k && (Number(k) < 1 || Number(k) > 12);
        const badFinger = m && m[4] && (Number(m[4]) < 1 || Number(m[4]) > 5 || m[1] || !m[2]);
        if (!m || bad(m[2]) || bad(m[3]) || (!m[1] && !m[2] && c) || (m[3] && (m[1] || !m[2])) || badFinger) {
          throw new YmnError(
            `case invalide « ${c} » : attendu un numéro de 1 à 12, « - », « -N », une trille « N${TRILL_MARK}N », un doigté « N${FINGER_MARK}D » (doigt de 1 à 5), des petites notes « N' » ou une case vide`,
            R, col,
          );
        }
        const [, dash, digits, aux, finger] = m;
        if (!c) return close(a.t);
        if (!dash) {
          close(a.t);
          const midi = midiOf(octave, Number(digits));
          if (aux && Number(aux) === Number(digits)) throw new YmnError("une trille alterne avec une autre note", R, col);
          open = { part, midi, start: a.t, end: t1, ...(aux ? { trill: trillAux(midi, Number(aux)) } : {}), ...(finger ? { finger: Number(finger) } : {}) };
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
        const prev = ai === 0 ? pending.find((p) => p.part === part && p.midi === midi && p.end === t0) : undefined;
        if (prev) {
          pending = pending.filter((p) => p !== prev);
          open = prev;
        } else {
          // tenue sans origine connue (début de fichier, saisie partielle) : la note commence ici
          open = { part, midi, start: a.t, end: t1 };
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
      for (const g of list) graces.push({ part: g.part, midi: g.midi, t: g.t, slot: cols.indexOf(g.col) });
    }

    // pédale : dans l'ordre du temps, en relâchant avant d'enfoncer à un même instant
    const order = (x: string) => (x === PEDAL_UP ? 0 : x === PEDAL_CHANGE ? 1 : 2);
    pedalSigns.sort((a, b) => a.part - b.part || a.t - b.t || order(a.text) - order(b.text));
    for (const p of pedalSigns) {
      const down = pedalDown.get(p.part);
      if (p.text !== PEDAL_DOWN) {
        if (!down) {
          throw new YmnError(p.text === PEDAL_UP ? "« * » sans pédale enfoncée" : "« *Ped. » sans pédale enfoncée : écris « Ped. »", p.line, p.col);
        }
        down.end = p.t;
        pedalDown.delete(p.part);
      }
      if (p.text !== PEDAL_UP) {
        if (pedalDown.has(p.part)) throw new YmnError("« Ped. » alors que la pédale est déjà enfoncée : écris « *Ped. » pour la changer", p.line, p.col);
        const pedal = { part: p.part, start: p.t, end: -1 };
        pedalDown.set(p.part, pedal);
        pedals.push(pedal);
      }
    }
    if (pendingSlurs.length) {
      const o = pendingSlurs[0];
      throw new YmnError("liaison coupée en fin de système : reprends-la au début du suivant par « ---) »", o.line, o.col);
    }
  }
  if (openSlurs.length) throw new YmnError("liaison jamais refermée : termine-la par « ) »", openSlurs[0].line, openSlurs[0].col);
  for (const s of slurs) {
    if (s.end <= s.start) {
      throw new YmnError("une liaison relie au moins deux notes : « ( » et « ) » dans deux cases différentes", slurAt.get(s)!.line, slurAt.get(s)!.col);
    }
  }
  for (const [l, c] of lyricCell) {
    if (l.extend! <= c.end) throw new YmnError("la prolongation doit dépasser la case de sa syllabe", c.line, c.col);
  }
  // une pédale jamais relâchée tient jusqu'à la fin du morceau
  for (const p of pedalDown.values()) p.end = beats.length * TICKS_PER_BEAT;

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
    if (markers.find((x) => x.label === m.label) !== m) throw new YmnError(`section « [${m.label}] » posée deux fois`, m.line, m.col);
  }
  if (markers.length && markers[0].barIndex !== 0) {
    throw new YmnError(`le morceau commence avant la première section « [${markers[0].label}] » : pose une section sur la première mesure`, markers[0].line, markers[0].col);
  }
  let repeatStart = 0;
  for (const r of [...repeats.values()].sort((a, b) => a.barIndex - b.barIndex)) {
    if (r.start) repeatStart = r.barIndex;
    if (!r.end) continue;
    const inside = markers.find((m) => m.barIndex > repeatStart && m.barIndex <= r.barIndex);
    if (inside) throw new YmnError(`la reprise passe le début de la section « [${inside.label}] » : une reprise reste dans sa section`, inside.line, inside.col);
    repeatStart = r.barIndex + 1;
  }

  // ordre de jeu : « order: A A B C » dans le frontmatter
  const orderLine = lines.findIndex((l, i) => i < bodyStartLine && /^order\s*:/.test(l)) + 1;
  const order = meta.order === undefined ? [] : String(meta.order).trim().split(/\s+/).filter(Boolean);
  delete meta.order;
  for (const label of order) {
    if (!/^[A-Z]$/.test(label)) throw new YmnError(`ordre de jeu : « ${label} » n'est pas une lettre de section (A à Z)`, orderLine);
    if (!markers.some((m) => m.label === label)) throw new YmnError(`ordre de jeu : aucune section « [${label}] » dans le morceau`, orderLine);
  }

  return {
    meta,
    instruments: instruments!,
    beats,
    notes: sortNotes(notes),
    graces: sortGraces(graces),
    repeats: [...repeats.values()].sort((a, b) => a.barIndex - b.barIndex),
    texts,
    expressions: expressions.sort((a, b) => a.t - b.t || a.part - b.part),
    hairpins: hairpins.sort((a, b) => a.start - b.start || a.part - b.part),
    slurs: slurs.sort((a, b) => a.start - b.start || a.part - b.part || a.end - b.end),
    pedals: pedals.filter((p) => p.end > p.start).sort((a, b) => a.start - b.start || a.part - b.part),
    pedalTexts: pedalTexts.sort((a, b) => a.t - b.t || a.part - b.part),
    markers: markers.map(({ label, barIndex }) => ({ label, barIndex })),
    chords: chords.sort((a, b) => a.t - b.t),
    lyrics: sortLyrics(lyrics),
    arpeggios: arpeggios.sort((a, b) => a.t - b.t || (a.part ?? -1) - (b.part ?? -1)),
    articulations: sortArticulations(articulations),
    fermatas: fermatas.sort((a, b) => a - b),
    order,
  };
}
