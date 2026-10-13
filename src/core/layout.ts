/**
 * Mise en page : découpe le morceau en systèmes qui tiennent dans une largeur donnée,
 * et calcule pour chaque système ses ancres, ses lignes et le contenu de chaque case.
 *
 * Le moteur ne connaît que des « unités » de largeur : des caractères pour le texte,
 * des millimètres pour le rendu graphique. Seules les mesures changent.
 */
import { ARPEGGIO_DOWN, ARPEGGIO_UP, PEDAL_CHANGE, PEDAL_DOWN, PEDAL_UP, TICKS_PER_BEAT, TRILL_MARK, beatStart, graceDigits, repeatOf } from "./model.ts";
import type { Beat, Division, Hairpin, Hand, Note, Score } from "./model.ts";
import { numberOf, octaveOf } from "./pitch.ts";

export type Metrics = {
  /** Largeur totale disponible pour un système. */
  width: number;
  /** Largeur de la colonne de gauche (numéro de mesure ou d'octave), séparateur compris. */
  prefix: number;
  cell: number;
  /**
   * Largeur de la case qui commence à l'instant t, si elle doit être plus large que cell
   * (texte .ymn : une indication trop longue élargit sa case). Par défaut : cell.
   */
  cellAt?: (t: number) => number;
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
  | { kind: "barSep"; endRepeat?: boolean; startRepeat?: boolean; lead?: boolean; final?: boolean; section?: boolean };
// final : dernière barre du morceau (double barre de fin, trait fin puis trait épais) ;
// section : barre qui termine une section (double barre)

export type SystemRow = {
  hand: Hand;
  octave: number;
  /** Faux pour les lignes suivantes d'un même groupe d'octave : on n'écrit le numéro qu'une fois. */
  showOctave: boolean;
  /** Contenu de chaque ancre : "", "-", "-N" (rappel en début de système), "N" ou "N~N" (trille). */
  cells: string[];
  /** Pour chaque ancre, vrai si la note qui y sonne est une trille (attaque ou tenue). */
  trill: boolean[];
  /**
   * Petites notes de chaque ancre, jouées avant son contenu : un numéro par rang (voir
   * System.graceDigits), "" pour un rang joué sur une autre ligne. Vide sans petite note.
   */
  graces: string[][];
  /**
   * Pour chaque ancre, décalage vertical (en lignes) qui centre le bloc de notes dans
   * son couloir d'octave. Sert seulement au rendu graphique « notes centrées ».
   */
  center: number[];
};

/**
 * Indication de la ligne @. Les débuts de section (« *A ») sont placés sur une barre de
 * mesure (column : index dans columns, -1 pour la barre de gauche du système) ; les autres
 * indications sur une ancre (anchor : index dans anchors).
 */
export type Mark = {
  anchor?: number;
  column?: number;
  text: string;
  kind: "times" | "text" | "marker" | "fermata" | "arpeggio";
  /** Début de section : sa lettre. */
  label?: string;
};

/** Position d'une indication dans l'ordre des colonnes du système, pour les trier. */
export const markColumn = (sys: { anchors: number[] }, m: Mark) => (m.anchor !== undefined ? sys.anchors[m.anchor] : m.column!);

/** Indication d'une voix (nuance ou texte), sur une ancre. */
export type VoiceMark = { anchor: number; text: string; kind: "dynamic" | "text" | "arpeggio" };

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

/**
 * Portion d'une liaison visible dans un système : de la case de sa première note à celle
 * de sa dernière. opens / closes : la liaison commence / se termine dans ce système.
 * level : étage, pour les liaisons imbriquées ou qui se chevauchent (0 au plus près des notes).
 */
export type SlurSpan = { fromAnchor: number; toAnchor: number; opens: boolean; closes: boolean; level: number };

/** Ligne @ d'une voix : sous les lignes de sa main. */
export type Voice = { marks: VoiceMark[]; hairpins: HairpinSpan[]; slurs: SlurSpan[] };

/**
 * Pédale dans un système : ses signes (pour le texte .ymn) et ses traits (pour la gravure).
 * Un trait va de l'ancre où la pédale s'enfonce (-1 : bord gauche, pédale déjà enfoncée)
 * à l'ancre où elle se relâche (-1 : bord droit du système).
 */
export type PedalLine = {
  signs: { anchor: number; text: string }[];
  /** Consignes de pédale (« Ped. simile »…). */
  texts: { anchor: number; text: string }[];
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
  /** Lettre de la section que ce système ouvre (chaque section commence un système). */
  section?: string;
  /** Le système termine une section. */
  endsSection: boolean;
  voices: Record<Hand, Voice>;
  pedal: PedalLine;
  /** Arpèges du système, sur leur ancre ; hand absente : les deux mains. */
  arpeggios: { anchor: number; hand?: Hand; down: boolean }[];
  /** Pour chaque main et chaque ancre, le nombre de chiffres de chaque rang de petites notes. */
  graceDigits: Record<Hand, number[][]>;
  /** Largeur naturelle du système, en unités. */
  width: number;
};

/**
 * Plus petit nombre d'ancres qui place tous les événements du temps sur une ancre. Il
 * existe toujours : au pire, une ancre par tick.
 */
function resolution(offsets: number[]): number {
  for (let n = 1; ; n++) {
    if (TICKS_PER_BEAT % n) continue;
    const step = TICKS_PER_BEAT / n;
    if (offsets.every((o) => o % step === 0)) return n;
  }
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

/** Nom d'une ancre : chiffre du temps, « : » premier découpage, « . » second, « , » au-delà. */
export function anchorLabel(k: number, n: number, base: Division, beatLabel: number): string {
  if (k === 0) return String(beatLabel);
  if ((k * base) % n === 0) return ":";
  if ((k * base * 2) % n === 0) return ".";
  return ",";
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
  for (const t of score.fermatas) add(t, false);
  for (const g of score.graces) add(g.t, false);
  for (const x of score.arpeggios) add(x.t, false);
  for (const s of score.slurs) {
    add(s.start, false);
    add(s.end, false);
  }
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

/** Largeur des cases d'un temps. */
function cellsWidth(beat: number, n: number, m: Metrics): number {
  if (!m.cellAt) return n * m.cell;
  let w = 0;
  for (let k = 0; k < n; k++) w += m.cellAt(beatStart(beat) + (k * TICKS_PER_BEAT) / n);
  return w;
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
    cellsWidth(i, grids[i].n, m) + (last ? barEndW(score.beats[i].barIndex) : m.beatSep);
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
  // chaque section commence un nouveau système, comme les couplets d'une chanson
  const sectionStarts = new Set(score.markers.map((mk) => mk.barIndex));
  for (const bar of bars) {
    if (sectionStarts.has(score.beats[bar[0]].barIndex)) flush();
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
  if (attack) return String(numberOf(attack.midi)) + (attack.trill !== undefined ? TRILL_MARK + numberOf(attack.trill) : "");
  const held = lane.notes.find((n) => n.start < t && n.end > t);
  if (!held) return "";
  return t === t0 ? "-" + numberOf(held.midi) : "-";
}

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
        const t = beatStart(bi) + (k * T) / g.n;
        columns.push({ kind: "anchor", t, label: g.labels[k], beatIndex: bi, k, n: g.n });
        width += m.cellAt ? m.cellAt(t) : m.cell;
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
      // fin de section : double barre
      else if (!endRepeat && !startRepeat && score.markers.some((mk) => mk.barIndex === barIndex + 1)) col.section = true;
      columns.push(col);
      width += m.barSep + (endRepeat ? m.repeatDots : 0) + (startRepeat ? m.repeatDots : 0);
    });

    const inSystem = score.notes.filter((n) => n.start < t1 && n.end > t0);
    const anchorT = anchors.map((ci) => (columns[ci] as { t: number }).t);
    const digits = (hand: Hand) => anchorT.map((t) => graceDigits(score.graces, hand, t));
    const toRows = (hand: Hand): SystemRow[] => {
      const gs = groups(inSystem.filter((n) => n.hand === hand), t0);
      // petites notes : sur la première ligne libre de leur couloir d'octave (créé au besoin)
      const graces = score.graces.filter((g) => g.hand === hand && g.t >= t0 && g.t < t1);
      const slotsAt = digits(hand);
      const placed = new Map<Lane, string[][]>();
      for (const g of graces) {
        const octave = octaveOf(g.midi);
        let group = gs.find((x) => x.octave === octave);
        if (!group) {
          group = { hand, octave, lanes: [], blocks: [] };
          gs.push(group);
          gs.sort((x, y) => y.octave - x.octave);
        }
        const a = anchorT.indexOf(g.t);
        let lane = group.lanes.find((l) => !placed.get(l)?.[a]?.[g.slot]);
        if (!lane) {
          lane = { hand, octave, notes: [] };
          group.lanes.push(lane);
        }
        if (!placed.has(lane)) placed.set(lane, anchorT.map(() => []));
        const cellGraces = placed.get(lane)![a];
        while (cellGraces.length < slotsAt[a].length) cellGraces.push("");
        cellGraces[g.slot] = String(numberOf(g.midi));
      }
      return gs.flatMap((g) =>
        g.lanes.map((lane, i) => ({
          hand,
          octave: g.octave,
          showOctave: i === 0,
          cells: anchorT.map((t) => cell(lane, t, t0)),
          trill: anchorT.map((t) => lane.notes.some((n) => n.trill !== undefined && n.start <= t && n.end > t)),
          graces: placed.get(lane) ?? anchorT.map(() => []),
          // décalage pour centrer chaque bloc dans son couloir (rendu graphique, option)
          center: anchors.map((ci) => {
            const t = (columns[ci] as { t: number }).t;
            const b = g.blocks.find((x) => x.start <= t && t < x.end);
            return b ? (g.lanes.length - b.size) / 2 : 0;
          }),
        })),
      );
    };

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
    for (const r of score.repeats) {
      if (!r.end || !r.times || r.times === 2) continue;
      const a = lastAnchorOfBar(r.barIndex);
      if (a !== undefined) marks.push({ anchor: a, text: `${r.times}×`, kind: "times" });
    }
    // début de section : sa lettre en tête du système
    const section = score.markers.find((mk) => firstAnchorOfBar(mk.barIndex) === 0);
    if (section) marks.push({ column: -1, text: "*" + section.label, kind: "marker", label: section.label });
    for (const t of score.fermatas) {
      const a = anchors.findIndex((ci) => (columns[ci] as { t: number }).t === t);
      if (a >= 0) marks.push({ anchor: a, text: "^", kind: "fermata" });
    }
    const arpeggios: System["arpeggios"] = [];
    for (const x of score.arpeggios) {
      const a = anchorT.indexOf(x.t);
      if (a < 0) continue;
      arpeggios.push({ anchor: a, ...(x.hand ? { hand: x.hand } : {}), down: !!x.down });
      if (!x.hand) marks.push({ anchor: a, text: x.down ? ARPEGGIO_DOWN : ARPEGGIO_UP, kind: "arpeggio" });
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
    // liaisons : les plus courtes d'abord, chacune au premier étage où elle ne touche aucune autre
    const slurSpans = (hand: Hand): SlurSpan[] => {
      const spans = score.slurs
        .filter((s) => s.hand === hand && s.start < t1 && s.end >= t0)
        .map((s) => ({
          fromAnchor: anchorAt(Math.max(s.start, t0)),
          toAnchor: s.end < t1 ? anchorAt(s.end) : anchors.length - 1,
          opens: s.start >= t0,
          closes: s.end < t1,
          level: 0,
        }))
        .filter((s) => s.fromAnchor >= 0 && s.toAnchor >= s.fromAnchor);
      const placed: SlurSpan[] = [];
      for (const s of [...spans].sort((a, b) => a.toAnchor - a.fromAnchor - (b.toAnchor - b.fromAnchor))) {
        // deux liaisons qui se touchent seulement (l'une finit sur la note où l'autre commence) restent au même étage
        while (placed.some((p) => p.level === s.level && p.fromAnchor < s.toAnchor && s.fromAnchor < p.toAnchor)) s.level++;
        placed.push(s);
      }
      return spans;
    };
    const voice = (hand: Hand): Voice => ({
      marks: score.expressions
        .filter((e) => e.hand === hand)
        .map((e): VoiceMark => ({ anchor: anchorAt(e.t), text: e.text, kind: e.kind }))
        .concat(
          score.arpeggios
            .filter((x) => x.hand === hand)
            .map((x) => ({ anchor: anchorAt(x.t), text: x.down ? ARPEGGIO_DOWN : ARPEGGIO_UP, kind: "arpeggio" as const })),
        )
        .filter((m) => m.anchor >= 0)
        .sort((x, y) => x.anchor - y.anchor),
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
      slurs: slurSpans(hand),
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
    const pedalTexts = score.pedalTexts.map((p) => ({ anchor: anchorAt(p.t), text: p.text })).filter((p) => p.anchor >= 0);

    return {
      bar: firstBeat.bar,
      start: t0,
      end: t1,
      columns,
      anchors,
      right: toRows("D"),
      left: toRows("G"),
      marks,
      section: section?.label,
      endsSection: score.markers.some((mk) => mk.barIndex > 0 && lastAnchorOfBar(mk.barIndex - 1) === anchors.length - 1),
      voices: { D: voice("D"), G: voice("G") },
      pedal: { signs, spans, texts: pedalTexts },
      arpeggios,
      graceDigits: { D: digits("D"), G: digits("G") },
      width,
    };
  });
}
