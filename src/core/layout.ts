/**
 * Mise en page : découpe le morceau en systèmes qui tiennent dans une largeur donnée,
 * et calcule pour chaque système ses ancres, ses lignes et le contenu de chaque case.
 *
 * Le moteur ne connaît que des « unités » de largeur : des caractères pour le texte,
 * des millimètres pour le rendu graphique. Seules les mesures changent.
 */
import { PEDAL_CHANGE, PEDAL_DOWN, PEDAL_UP, TICKS_PER_BEAT, beatStart, repeatOf } from "./model.ts";
import type { Beat, Division, Ending, Hairpin, Hand, Note, Score } from "./model.ts";
import { numberOf, octaveOf } from "./pitch.ts";

export type Metrics = {
  /** Largeur totale disponible pour un système. */
  width: number;
  /** Largeur de la colonne de gauche (numéro de mesure ou d'octave), séparateur compris. */
  prefix: number;
  cell: number;
  beatSep: number;
  barSep: number;
  /** Largeur ajoutée par les deux points d'un signe de reprise, de chaque côté. */
  repeatDots: number;
};

export type Column =
  | { kind: "anchor"; t: number; label: string; beatIndex: number; k: number; n: number }
  | { kind: "beatSep" }
  /**
   * Barre de mesure. endRepeat : « :|| » (la mesure précédente termine une reprise) ;
   * startRepeat : « ||: » (la mesure suivante en commence une). lead : barre de début de
   * système, présente seulement quand le système commence par « ||: ».
   */
  | { kind: "barSep"; endRepeat?: boolean; startRepeat?: boolean; lead?: boolean; final?: boolean };
// final : dernière barre du morceau (double barre de fin, trait fin puis trait épais)

export type SystemRow = {
  hand: Hand;
  octave: number;
  /** Faux pour les lignes suivantes d'un même groupe d'octave : on n'écrit le numéro qu'une fois. */
  showOctave: boolean;
  /** Contenu de chaque ancre : "", "-", "-N" (rappel en début de système) ou "N". */
  cells: string[];
  /**
   * Pour chaque ancre, décalage vertical (en lignes) qui centre le bloc de notes dans
   * son couloir d'octave. Sert seulement au rendu graphique « notes centrées ».
   */
  center: number[];
};

/** Indication de la ligne @ placée sur une ancre (index dans anchors). */
/**
 * Indication de la ligne @. Les cases de reprise (« [1. », « ] ») sont placées sur une
 * barre de mesure (column : index dans columns, -1 pour la barre de gauche du système) ;
 * les autres indications sur une ancre (anchor : index dans anchors).
 */
export type Mark = {
  anchor?: number;
  column?: number;
  text: string;
  kind: "ending" | "endingClose" | "times" | "text";
};

/** Position d'une indication dans l'ordre des colonnes du système, pour les trier. */
export const markColumn = (sys: { anchors: number[] }, m: Mark) => (m.anchor !== undefined ? sys.anchors[m.anchor] : m.column!);

/** Portion d'une case de reprise visible dans un système. */
export type EndingSpan = {
  ending: Ending;
  /** Première et dernière ancres couvertes. */
  fromAnchor: number;
  toAnchor: number;
  /**
   * Barres de mesure où commence et finit le crochet (index dans columns).
   * -1 : bord gauche du système (fromColumn) ou bord droit (toColumn, case qui continue).
   */
  fromColumn: number;
  toColumn: number;
  /** La case commence dans ce système (on y écrit son numéro). */
  opens: boolean;
  /** La case se termine dans ce système. */
  closes: boolean;
  /** Elle se termine sur une barre de reprise « :|| ». */
  closedByRepeat: boolean;
  /** Crochet descendant à droite : case fermée par « :|| », par « ] » ou par la fin du morceau. */
  hook: boolean;
};

/** Indication d'une voix (nuance ou texte), sur une ancre. */
export type VoiceMark = { anchor: number; text: string; kind: "dynamic" | "text" };

/** Portion d'un soufflet visible dans un système. */
export type HairpinSpan = {
  kind: Hairpin["kind"];
  /** Première et dernière ancres couvertes. */
  fromAnchor: number;
  toAnchor: number;
  /** Avancement du soufflet (0 à 1) au début et à la fin de la portion : un soufflet coupé reste ouvert. */
  from: number;
  to: number;
};

/** Ligne @ d'une voix : sous les lignes de sa main. */
export type Voice = { marks: VoiceMark[]; hairpins: HairpinSpan[] };

/**
 * Pédale dans un système : ses signes (pour le texte .ymn) et ses traits (pour la gravure).
 * Un trait va de l'ancre où la pédale s'enfonce (-1 : bord gauche, pédale déjà enfoncée)
 * à l'ancre où elle se relâche (-1 : bord droit du système).
 */
export type PedalLine = {
  signs: { anchor: number; text: string }[];
  spans: { fromAnchor: number; toAnchor: number; opens: boolean; closes: boolean; changeStart: boolean; changeEnd: boolean }[];
};

export type System = {
  /** Numéro de la mesure par laquelle commence le système. */
  bar: string;
  start: number;
  end: number;
  columns: Column[];
  /** Index, dans columns, de chaque ancre. */
  anchors: number[];
  right: SystemRow[];
  left: SystemRow[];
  marks: Mark[];
  endings: EndingSpan[];
  voices: Record<Hand, Voice>;
  pedal: PedalLine;
  /** Largeur naturelle du système, en unités. */
  width: number;
};

const MAX_RESOLUTION = 48;

/** Plus petit nombre d'ancres qui place tous les événements du temps sur une ancre. */
function resolution(offsets: number[]): number {
  for (let n = 1; n <= MAX_RESOLUTION; n++) {
    if (TICKS_PER_BEAT % n) continue;
    const step = TICKS_PER_BEAT / n;
    if (offsets.every((o) => o % step === 0)) return n;
  }
  return MAX_RESOLUTION;
}

/** Découpage effectif d'un temps, pour nommer ses ancres. */
function baseDivision(n: number, def: Division, attacks: number[]): Division {
  if (n % 6 === 0) {
    // découpages binaire et ternaire possibles : on regarde où tombent les attaques
    const third = TICKS_PER_BEAT / 3, half = TICKS_PER_BEAT / 2;
    const onThirds = attacks.some((o) => o > 0 && o % third === 0 && o % half !== 0);
    const onHalf = attacks.includes(half);
    if (onThirds && !onHalf) return 3;
    if (onHalf && !onThirds) return 2;
    return def;
  }
  if (n % 3 === 0) return 3;
  if (n % 2 === 0) return 2;
  return def;
}

/** Nom d'une ancre : chiffre du temps, « : » premier découpage, « . » second, rien au-delà. */
export function anchorLabel(k: number, n: number, base: Division, beatLabel: number): string {
  if (k === 0) return String(beatLabel);
  if ((k * base) % n === 0) return ":";
  if ((k * base * 2) % n === 0) return ".";
  return "";
}

type BeatGrid = { n: number; labels: string[] };

function beatGrids(score: Score): BeatGrid[] {
  const T = TICKS_PER_BEAT;
  const offsets: number[][] = score.beats.map(() => []);
  const attacks: number[][] = score.beats.map(() => []);
  const add = (t: number, isAttack: boolean) => {
    const i = Math.floor(t / T);
    if (i < 0 || i >= score.beats.length) return;
    const o = t - i * T;
    if (o) offsets[i].push(o);
    if (isAttack) attacks[i].push(o);
  };
  for (const n of score.notes) {
    add(n.start, true);
    add(n.end, false);
  }
  for (const m of score.texts) add(m.t, false);
  for (const e of score.expressions) add(e.t, false);
  for (const h of score.hairpins) {
    add(h.start, false);
    add(h.end, false);
  }
  for (const p of score.pedals) {
    add(p.start, false);
    add(p.end, false);
  }
  return score.beats.map((b, i) => {
    const n = resolution(offsets[i]);
    const base = baseDivision(n, b.division, attacks[i]);
    return { n, labels: Array.from({ length: n }, (_, k) => anchorLabel(k, n, base, b.label)) };
  });
}

/** Regroupe les temps par mesure (rang dans le morceau). */
function barsOf(beats: Beat[]): number[][] {
  const bars: number[][] = [];
  beats.forEach((b, i) => {
    const last = bars[bars.length - 1];
    if (last && beats[last[0]].barIndex === b.barIndex) last.push(i);
    else bars.push([i]);
  });
  return bars;
}

/** Répartit les temps en systèmes (listes d'index de temps), sans couper une mesure si possible. */
function breakSystems(score: Score, grids: BeatGrid[], m: Metrics): number[][] {
  const bars = barsOf(score.beats);
  const avail = m.width - m.prefix;
  const barEndW = (barIndex: number) => {
    const r = repeatOf(score, barIndex);
    const next = repeatOf(score, barIndex + 1);
    return m.barSep + (r?.end ? m.repeatDots : 0) + (next?.start ? m.repeatDots : 0);
  };
  const beatW = (i: number, last: boolean) =>
    grids[i].n * m.cell + (last ? barEndW(score.beats[i].barIndex) : m.beatSep);
  const barW = (bar: number[]) => bar.reduce((s, i, j) => s + beatW(i, j === bar.length - 1), 0);
  // une reprise en début de système ajoute « |: » après la barre de gauche
  const leadW = (bar: number[]) => (repeatOf(score, score.beats[bar[0]].barIndex)?.start ? m.repeatDots + m.beatSep : 0);

  const systems: number[][] = [];
  let cur: number[] = [];
  let used = 0;
  const flush = () => {
    if (cur.length) systems.push(cur);
    cur = [];
    used = 0;
  };
  for (const bar of bars) {
    const w = barW(bar);
    if (cur.length && used + w <= avail) {
      cur.push(...bar);
      used += w;
      continue;
    }
    const lw = leadW(bar);
    if (w + lw <= avail) {
      flush();
      cur.push(...bar);
      used = w + lw;
      continue;
    }
    // mesure plus large qu'un système : on la coupe sur un temps
    flush();
    used = lw;
    bar.forEach((i, j) => {
      const bw = beatW(i, j === bar.length - 1);
      if (used + bw > avail && cur.length) flush();
      cur.push(i);
      used += bw;
    });
  }
  flush();
  return systems;
}

/** Une ligne d'un couloir d'octave. */
type Lane = { hand: Hand; octave: number; notes: Note[] };

/**
 * Bloc : suite de notes d'un même couloir qui se chevauchent (directement ou de proche
 * en proche). Deux blocs ne sonnent jamais en même temps, ils peuvent donc être rangés
 * indépendamment l'un de l'autre.
 */
type Block = { start: number; end: number; size: number };

/** Couloir d'octave d'une main : ses lignes et ses blocs. */
type Group = { hand: Hand; octave: number; lanes: Lane[]; blocks: Block[] };

/**
 * Répartit les notes d'un système en couloirs (une main, une octave), puis en lignes
 * (jamais deux notes à la fois sur une ligne).
 *
 * Dans chaque bloc, les notes sont rangées de haut en bas, la plus aiguë en premier :
 * une note seule est toujours sur la ligne du haut, quel que soit le reste du couloir.
 */
function groups(notes: Note[], t0: number): Group[] {
  const byKey = new Map<string, Note[]>();
  for (const n of notes) {
    const key = n.hand + octaveOf(n.midi);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(n);
  }
  const out: Group[] = [];
  for (const list of byKey.values()) {
    const s = (n: Note) => Math.max(n.start, t0);
    const sorted = [...list].sort((a, b) => s(a) - s(b) || b.midi - a.midi);
    const g: Group = { hand: sorted[0].hand, octave: octaveOf(sorted[0].midi), lanes: [], blocks: [] };
    let local: Note[][] = [];
    let block: Block | undefined;
    const flush = () => {
      if (!block) return;
      block.size = local.length;
      g.blocks.push(block);
      local.forEach((notes, i) => {
        if (!g.lanes[i]) g.lanes[i] = { hand: g.hand, octave: g.octave, notes: [] };
        g.lanes[i].notes.push(...notes);
      });
    };
    for (const n of sorted) {
      if (!block || s(n) >= block.end) {
        flush();
        block = { start: s(n), end: n.end, size: 0 };
        local = [];
      }
      block.end = Math.max(block.end, n.end);
      const lane = local.find((l) => l.every((m) => m.end <= s(n)));
      if (lane) lane.push(n);
      else local.push([n]);
    }
    flush();
    out.push(g);
  }
  return out.sort((a, b) => b.octave - a.octave);
}

function cell(lane: Lane, t: number, t0: number): string {
  const attack = lane.notes.find((n) => n.start === t);
  if (attack) return String(numberOf(attack.midi));
  const held = lane.notes.find((n) => n.start < t && n.end > t);
  if (!held) return "";
  return t === t0 ? "-" + numberOf(held.midi) : "-";
}

export const endingLabel = (e: Ending) => "[" + e.numbers.map((n) => n + ".").join("");

export function layout(score: Score, m: Metrics): System[] {
  const grids = beatGrids(score);
  const T = TICKS_PER_BEAT;
  return breakSystems(score, grids, m).map((beatIdx) => {
    const t0 = beatStart(beatIdx[0]);
    const t1 = beatStart(beatIdx[beatIdx.length - 1] + 1);
    const columns: Column[] = [];
    const anchors: number[] = [];
    let width = m.prefix;
    const firstBeat = score.beats[beatIdx[0]];
    const startsBar = beatIdx[0] === 0 || score.beats[beatIdx[0] - 1].barIndex !== firstBeat.barIndex;
    if (startsBar && repeatOf(score, firstBeat.barIndex)?.start) {
      columns.push({ kind: "barSep", lead: true, startRepeat: true });
      width += m.repeatDots + m.beatSep;
    }
    beatIdx.forEach((bi, j) => {
      const g = grids[bi];
      for (let k = 0; k < g.n; k++) {
        anchors.push(columns.length);
        columns.push({ kind: "anchor", t: beatStart(bi) + (k * T) / g.n, label: g.labels[k], beatIndex: bi, k, n: g.n });
        width += m.cell;
      }
      const barIndex = score.beats[bi].barIndex;
      const barEnd = score.beats[bi + 1]?.barIndex !== barIndex;
      if (!barEnd) {
        columns.push({ kind: "beatSep" });
        width += m.beatSep;
        return;
      }
      const lastOfSystem = j === beatIdx.length - 1;
      const endRepeat = !!repeatOf(score, barIndex)?.end;
      // « ||: » de la mesure suivante : en fin de système, il passe au début du système suivant
      const startRepeat = !lastOfSystem && !!repeatOf(score, barIndex + 1)?.start;
      const col: Column = { kind: "barSep" };
      if (endRepeat) col.endRepeat = true;
      if (startRepeat) col.startRepeat = true;
      if (bi === score.beats.length - 1) col.final = true;
      columns.push(col);
      width += m.barSep + (endRepeat ? m.repeatDots : 0) + (startRepeat ? m.repeatDots : 0);
    });

    const inSystem = score.notes.filter((n) => n.start < t1 && n.end > t0);
    const toRows = (hand: Hand): SystemRow[] =>
      groups(inSystem.filter((n) => n.hand === hand), t0).flatMap((g) =>
        g.lanes.map((lane, i) => ({
          hand,
          octave: g.octave,
          showOctave: i === 0,
          cells: anchors.map((ci) => cell(lane, (columns[ci] as { t: number }).t, t0)),
          // décalage pour centrer chaque bloc dans son couloir (rendu graphique, option)
          center: anchors.map((ci) => {
            const t = (columns[ci] as { t: number }).t;
            const b = g.blocks.find((x) => x.start <= t && t < x.end);
            return b ? (g.lanes.length - b.size) / 2 : 0;
          }),
        })),
      );

    // ancres de chaque mesure du système
    const barAnchors = new Map<number, number[]>();
    anchors.forEach((ci, a) => {
      const bi = (columns[ci] as { beatIndex: number }).beatIndex;
      const bar = score.beats[bi].barIndex;
      if (!barAnchors.has(bar)) barAnchors.set(bar, []);
      barAnchors.get(bar)!.push(a);
    });
    const firstAnchorOfBar = (bar: number) => {
      const list = barAnchors.get(bar);
      if (!list) return undefined;
      // seulement si la mesure commence bien dans ce système
      const ci = anchors[list[0]];
      const col = columns[ci] as { k: number; beatIndex: number };
      const b = score.beats[col.beatIndex];
      const prev = score.beats[col.beatIndex - 1];
      return col.k === 0 && (!prev || prev.barIndex !== b.barIndex) ? list[0] : undefined;
    };
    const lastAnchorOfBar = (bar: number) => {
      const list = barAnchors.get(bar);
      if (!list) return undefined;
      const a = list[list.length - 1];
      const bi = (columns[anchors[a]] as { beatIndex: number }).beatIndex;
      return score.beats[bi + 1]?.barIndex !== bar ? a : undefined; // la mesure se termine dans ce système
    };

    const marks: Mark[] = [];
    const endings: EndingSpan[] = [];
    for (const e of score.endings) {
      // une case sans fin explicite n'a de crochet qu'au-dessus de sa première mesure
      const drawnLast = e.open ? e.firstBar : e.lastBar;
      const bars = [...barAnchors.keys()].filter((b) => b >= e.firstBar && b <= drawnLast);
      if (!bars.length) continue;
      const fromBar = bars[0], toBar = bars[bars.length - 1];
      const list = barAnchors.get(toBar)!;
      const opens = firstAnchorOfBar(e.firstBar) !== undefined;
      const closes = toBar === drawnLast && lastAnchorOfBar(drawnLast) !== undefined;
      const closedByRepeat = closes && !e.open && !!repeatOf(score, e.lastBar)?.end;
      const fromAnchor = barAnchors.get(fromBar)![0];
      const toAnchor = list[list.length - 1];
      // barre qui ouvre la mesure : -1 si c'est la barre de gauche du système
      const before = anchors[fromAnchor] - 1;
      const fromColumn = opens && before >= 0 && columns[before].kind === "barSep" && !(columns[before] as { lead?: boolean }).lead ? before : -1;
      const toColumn = closes ? anchors[toAnchor] + 1 : -1;
      // une case dont la mesure finit le morceau est fermée, comme sur « :|| »
      const endsPiece = drawnLast === score.beats[score.beats.length - 1].barIndex;
      endings.push({ ending: e, fromAnchor, toAnchor, fromColumn, toColumn, opens, closes, closedByRepeat, hook: closes && (!e.open || endsPiece) });
      if (opens) marks.push({ column: fromColumn, text: endingLabel(e), kind: "ending" });
      if (closes && !e.open && !closedByRepeat) marks.push({ column: toColumn, text: "]", kind: "endingClose" });
    }
    for (const r of score.repeats) {
      if (!r.end || !r.times || r.times === 2) continue;
      const a = lastAnchorOfBar(r.barIndex);
      if (a !== undefined) marks.push({ anchor: a, text: `${r.times}×`, kind: "times" });
    }
    for (const tm of score.texts) {
      const a = anchors.findIndex((ci) => (columns[ci] as { t: number }).t === tm.t);
      if (a >= 0) marks.push({ anchor: a, text: tm.text, kind: "text" });
    }
    marks.sort((x, y) => markColumn({ anchors }, x) - markColumn({ anchors }, y));

    const anchorAt = (t: number) => anchors.findIndex((ci) => (columns[ci] as { t: number }).t === t);
    const lastAnchorBefore = (t: number) => {
      let a = -1;
      anchors.forEach((ci, i) => {
        if ((columns[ci] as { t: number }).t < t) a = i;
      });
      return a;
    };
    const voice = (hand: Hand): Voice => ({
      marks: score.expressions
        .filter((e) => e.hand === hand)
        .map((e) => ({ anchor: anchorAt(e.t), text: e.text, kind: e.kind }))
        .filter((m) => m.anchor >= 0),
      hairpins: score.hairpins
        .filter((h) => h.hand === hand && h.start < t1 && h.end > t0 && h.end > h.start)
        .map((h) => {
          const s = Math.max(h.start, t0), e = Math.min(h.end, t1);
          return {
            kind: h.kind,
            fromAnchor: anchorAt(s),
            toAnchor: lastAnchorBefore(e),
            from: (s - h.start) / (h.end - h.start),
            to: (e - h.start) / (h.end - h.start),
          };
        })
        .filter((h) => h.fromAnchor >= 0 && h.toAnchor >= h.fromAnchor),
    });

    const signs: PedalLine["signs"] = [];
    const spans: PedalLine["spans"] = [];
    for (const p of score.pedals) {
      const change = (t: number) => score.pedals.some((q) => q !== p && (q.end === t || q.start === t));
      if (p.start >= t0 && p.start < t1) {
        const a = anchorAt(p.start);
        if (a >= 0) signs.push({ anchor: a, text: score.pedals.some((q) => q.end === p.start) ? PEDAL_CHANGE : PEDAL_DOWN });
      }
      // relâchée à un instant où une autre pédale s'enfonce : c'est ce changement qui l'écrit
      if (p.end >= t0 && p.end < t1 && !score.pedals.some((q) => q.start === p.end)) {
        const a = anchorAt(p.end);
        if (a >= 0) signs.push({ anchor: a, text: PEDAL_UP });
      }
      if (p.start < t1 && p.end > t0) {
        const opens = p.start >= t0, closes = p.end <= t1;
        spans.push({
          fromAnchor: opens ? anchorAt(p.start) : -1,
          toAnchor: p.end < t1 ? anchorAt(p.end) : -1,
          opens,
          closes,
          changeStart: opens && change(p.start),
          changeEnd: closes && change(p.end),
        });
      }
    }
    signs.sort((a, b) => a.anchor - b.anchor);

    return {
      bar: firstBeat.bar,
      start: t0,
      end: t1,
      columns,
      anchors,
      right: toRows("D"),
      left: toRows("G"),
      marks,
      endings,
      voices: { D: voice("D"), G: voice("G") },
      pedal: { signs, spans },
      width,
    };
  });
}
