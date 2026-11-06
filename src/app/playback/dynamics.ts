/**
 * Nuances à l'écoute : l'intensité (vélocité MIDI, de 1 à 127) de chaque note, d'après les nuances,
 * les soufflets et les « cresc. » / « dim. ».
 *
 * Une indication vaut pour toute la partie, sous quelque portée qu'elle soit écrite : au piano,
 * la nuance écrite entre les portées vaut pour les deux mains (et le MusicXML la range sous l'une
 * d'elles). Une portée qui a sa propre indication au même instant garde la sienne : deux nuances
 * écrites ensemble, une par main, se jouent chacune pour sa main.
 */
import { TICKS_PER_BEAT, partOf, isDynamic } from "../../core/index.ts";
import type { Staff, Score } from "../../core/index.ts";

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

const clamp = (value: number) => Math.max(1, Math.min(127, Math.round(value)));

/** Les indications d'intensité d'une portée, dans l'ordre. */
function marksOf(score: Score, staff: Staff): Mark[] {
  const out: Mark[] = [];
  for (const expression of score.expressions) {
    if (expression.staff !== staff) continue;
    const text = expression.text.replace(/^\((.+)\)$/, "$1"); // une nuance ajoutée par l'éditeur se joue de même
    if (expression.kind === "dynamic" && isDynamic(text)) {
      if (text in LEVELS) out.push({ t: expression.t, kind: "set", level: LEVELS[text] });
      else if (text in ACCENTS) out.push({ t: expression.t, kind: "accent", attack: ACCENTS[text] });
      else if (text in FORTE_PIANO) out.push({ t: expression.t, kind: "set", level: FORTE_PIANO[text][1], attack: FORTE_PIANO[text][0] });
    } else if (/^cresc/.test(text)) out.push({ t: expression.t, kind: "ramp", up: true });
    else if (/^(dim|decresc)/.test(text)) out.push({ t: expression.t, kind: "ramp", up: false });
  }
  for (const hairpin of score.hairpins)
    if (hairpin.staff === staff) out.push({ t: hairpin.start, kind: "ramp", up: hairpin.kind === "<", end: hairpin.end });
  return out.sort((first, second) => first.t - second.t);
}

/**
 * L'intensité d'une suite d'indications à l'instant t. Un crescendo ou un decrescendo va jusqu'à
 * la nuance qui le suit ; sans nuance juste après (un temps au plus après sa fin, ou avant
 * l'indication suivante pour un « cresc. » écrit), il change d'un pas et en reste là.
 */
function levelAt(marks: Mark[], tick: number): number {
  let level = DEFAULT;
  for (let index = 0; index < marks.length && marks[index].t <= tick; index++) {
    const mark = marks[index];
    if (mark.kind === "set") level = mark.level;
    if (mark.kind !== "ramp") continue;
    const next = marks.slice(index + 1).find((candidate) => candidate.kind !== "accent");
    // la fin du changement : celle du soufflet, sinon l'indication suivante, sinon une mesure de 4 temps
    const end = mark.end ?? next?.t ?? mark.t + 4 * TICKS_PER_BEAT;
    const target = next?.kind === "set" && next.t <= end + TICKS_PER_BEAT ? next.level : level + (mark.up ? STEP : -STEP);
    if (tick >= end) level = target;
    else level += (target - level) * ((tick - mark.t) / (end - mark.t));
  }
  return level;
}

/**
 * L'intensité d'une attaque d'une portée à un instant du morceau. Une note attaquée pile sur un
 * accent (sf, fp…) prend l'intensité de l'accent ; une petite note, qui précède sa note, non.
 */
export function velocityAt(score: Score): (staff: Staff, t: number, accent?: boolean) => number {
  const own = new Map<Staff, Mark[]>();
  const stavesCount = score.parts.reduce((count, part) => count + part.staves, 0);
  for (let staff = 0; staff < stavesCount; staff++) own.set(staff, marksOf(score, staff));
  // les indications des autres portées de la partie, sauf là où la portée a la sienne
  const family = (mark: Mark) => (mark.kind === "ramp" ? "ramp" : "level");
  const used = new Map<Staff, Mark[]>();
  for (let staff = 0; staff < stavesCount; staff++) {
    const mine = own.get(staff)!;
    const taken = new Set(mine.map((mark) => `${family(mark)}:${mark.t}`));
    const part = partOf(score.parts, staff);
    const others = [...own].filter(([other]) => other !== staff && partOf(score.parts, other) === part).flatMap(([, marks]) => marks);
    const shared: Mark[] = [];
    for (const mark of others) {
      const key = `${family(mark)}:${mark.t}`;
      if (taken.has(key)) continue;
      taken.add(key);
      shared.push(mark);
    }
    // à un même instant, la nuance d'abord, puis le changement qui part d'elle
    used.set(
      staff,
      [...mine, ...shared].sort(
        (first, second) => first.t - second.t || (family(first) === "ramp" ? 1 : 0) - (family(second) === "ramp" ? 1 : 0),
      ),
    );
  }
  return (staff, tick, accent = true) => {
    const marks = used.get(staff) ?? [];
    const hit = accent
      ? (marks.find((mark) => mark.t === tick && mark.kind !== "ramp" && mark.attack !== undefined) as { attack: number } | undefined)
      : undefined;
    return clamp(hit ? hit.attack : levelAt(marks, tick));
  };
}

/** La vélocité de chaque note du morceau, dans l'ordre de score.notes. */
export function velocities(score: Score): number[] {
  const at = velocityAt(score);
  return score.notes.map((note) => at(note.staff, note.start));
}
