/**
 * Nuances à l'écoute : l'intensité (vélocité MIDI, de 1 à 127) de chaque note, d'après les nuances,
 * les soufflets et les « cresc. » / « dim. » de sa partie.
 *
 * Une partie sans aucune indication d'intensité suit celles des autres parties de son instrument :
 * au piano, la nuance écrite entre les portées vaut pour les deux mains.
 */
import { TICKS_PER_BEAT, instrumentOf, isDynamic } from "../core/index.ts";
import type { Part, Score } from "../core/index.ts";

/** Intensité de chaque nuance, de ppp à fff : un pas d'une nuance à la suivante. */
const LEVELS: Record<string, number> = { ppp: 16, pp: 28, p: 42, mp: 56, mf: 70, f: 86, ff: 100, fff: 114 };
const STEP = 14;
/** Nuance d'un morceau qui n'en indique pas, avant la première. */
const DEFAULT = LEVELS.mf;
/** Accents (sf, sfz, fz, rfz) : la note attaquée là, nettement plus fort, sans changer la nuance. */
const ACCENTS: Record<string, number> = { sf: 100, sfz: 104, fz: 100, rfz: 96 };
/** Attaque forte puis aussitôt piano : l'attaque, puis la nuance qui suit. */
const FORTE_PIANO: Record<string, [attack: number, after: number]> = { fp: [LEVELS.f, LEVELS.p], sfp: [ACCENTS.sfz, LEVELS.p] };

/** Une indication d'intensité, à un instant du morceau. */
type Mark =
  | { t: number; kind: "set"; level: number; attack?: number }
  | { t: number; kind: "accent"; attack: number }
  | { t: number; kind: "ramp"; up: boolean; end?: number };

const clamp = (v: number) => Math.max(1, Math.min(127, Math.round(v)));

/** Les indications d'intensité d'une partie, dans l'ordre. */
function marksOf(score: Score, part: Part): Mark[] {
  const out: Mark[] = [];
  for (const e of score.expressions) {
    if (e.part !== part) continue;
    const text = e.text.replace(/^\((.+)\)$/, "$1"); // une nuance ajoutée par l'éditeur se joue de même
    if (e.kind === "dynamic" && isDynamic(text)) {
      if (text in LEVELS) out.push({ t: e.t, kind: "set", level: LEVELS[text] });
      else if (text in ACCENTS) out.push({ t: e.t, kind: "accent", attack: ACCENTS[text] });
      else if (text in FORTE_PIANO) out.push({ t: e.t, kind: "set", level: FORTE_PIANO[text][1], attack: FORTE_PIANO[text][0] });
    } else if (/^cresc/.test(text)) out.push({ t: e.t, kind: "ramp", up: true });
    else if (/^(dim|decresc)/.test(text)) out.push({ t: e.t, kind: "ramp", up: false });
  }
  for (const h of score.hairpins) if (h.part === part) out.push({ t: h.start, kind: "ramp", up: h.kind === "<", end: h.end });
  return out.sort((a, b) => a.t - b.t);
}

/**
 * L'intensité d'une suite d'indications à l'instant t. Un crescendo ou un decrescendo va jusqu'à
 * la nuance qui le suit ; sans nuance juste après (un temps au plus après sa fin, ou avant
 * l'indication suivante pour un « cresc. » écrit), il change d'un pas et en reste là.
 */
function levelAt(marks: Mark[], t: number): number {
  let level = DEFAULT;
  for (let i = 0; i < marks.length && marks[i].t <= t; i++) {
    const m = marks[i];
    if (m.kind === "set") level = m.level;
    if (m.kind !== "ramp") continue;
    const next = marks.slice(i + 1).find((x) => x.kind !== "accent");
    // la fin du changement : celle du soufflet, sinon l'indication suivante, sinon une mesure de 4 temps
    const end = m.end ?? next?.t ?? m.t + 4 * TICKS_PER_BEAT;
    const target = next?.kind === "set" && next.t <= end + TICKS_PER_BEAT ? next.level : level + (m.up ? STEP : -STEP);
    if (t >= end) level = target;
    else level += (target - level) * ((t - m.t) / (end - m.t));
  }
  return level;
}

/**
 * L'intensité d'une attaque d'une partie à un instant du morceau. Une note attaquée pile sur un
 * accent (sf, fp…) prend l'intensité de l'accent ; une petite note, qui précède sa note, non.
 */
export function velocityAt(score: Score): (part: Part, t: number, accent?: boolean) => number {
  const own = new Map<Part, Mark[]>();
  const partsCount = score.instruments.reduce((n, i) => n + i.parts, 0);
  for (let p = 0; p < partsCount; p++) own.set(p, marksOf(score, p));
  // une partie sans indication suit celles des autres parties de son instrument
  const used = new Map<Part, Mark[]>();
  for (let p = 0; p < partsCount; p++) {
    const mine = own.get(p)!;
    if (mine.length) used.set(p, mine);
    else {
      const k = instrumentOf(score.instruments, p);
      const shared = [...own].filter(([q]) => instrumentOf(score.instruments, q) === k).flatMap(([, ms]) => ms);
      used.set(p, shared.sort((a, b) => a.t - b.t));
    }
  }
  return (part, t, accent = true) => {
    const marks = used.get(part) ?? [];
    const hit = accent ? (marks.find((m) => m.t === t && m.kind !== "ramp" && m.attack !== undefined) as { attack: number } | undefined) : undefined;
    return clamp(hit ? hit.attack : levelAt(marks, t));
  };
}

/** La vélocité de chaque note du morceau, dans l'ordre de score.notes. */
export function velocities(score: Score): number[] {
  const at = velocityAt(score);
  return score.notes.map((n) => at(n.part, n.start));
}
