/**
 * Pédale de résonance à l'écoute : tant qu'elle est enfoncée, une note relâchée continue de sonner,
 * jusqu'à ce que la pédale remonte (ou change). La pédale s'écrit sous la dernière portée d'un
 * partie et vaut pour toutes ses portées.
 *
 * smplr ne tient pas la pédale lui-même : on allonge simplement les notes, comme les étouffoirs
 * restés levés.
 */
import { TICKS_PER_BEAT, partOf } from "../core/index.ts";
import type { Pedal, Score } from "../core/index.ts";

/**
 * Les pédales jouées : celles qui sont écrites, et celles qu'un « Ped. simile » demande de
 * continuer « comme avant ». Le motif de la dernière mesure pédalée (par exemple un changement
 * à chaque temps 1, ou aux temps 1 et 3) est reproduit à chaque mesure, jusqu'au prochain signe de
 * pédale écrit, au début de la section suivante ou à la fin du morceau.
 */
export function playedPedals(score: Score): Pedal[] {
  const out = [...score.pedals];
  // début et fin de chaque mesure
  const bars: { from: number; to: number }[] = [];
  score.beats.forEach((b, i) => {
    bars[b.barIndex] ??= { from: i * TICKS_PER_BEAT, to: 0 };
    bars[b.barIndex].to = (i + 1) * TICKS_PER_BEAT;
  });
  const sectionStarts = new Set(score.markers.map((m) => m.barIndex));
  const part = (staff: number) => partOf(score.parts, staff);
  for (const text of score.pedalTexts) {
    if (!/simile/i.test(text.text)) continue;
    const written = score.pedals.filter((p) => part(p.staff) === part(text.staff));
    const pedalled = (bar: number) => written.filter((p) => p.start < bars[bar].to && p.end > bars[bar].from);
    let bar = bars.findIndex((b) => b && text.t >= b.from && text.t < b.to);
    if (bar < 0) continue;
    const at = bar;
    // le motif : la dernière mesure pédalée jusqu'ici, la mesure du « simile » comprise
    let model = -1;
    for (let b = bar; b >= 0 && model < 0; b--) if (pedalled(b).length) model = b;
    while (bar < bars.length && pedalled(bar).length) bar++;
    if (model < 0) continue;
    const motif = pedalled(model).map((p) => ({ start: Math.max(p.start, bars[model].from) - bars[model].from, end: Math.min(p.end, bars[model].to) - bars[model].from }));
    for (; bar < bars.length && !pedalled(bar).length && !(bar > at && sectionStarts.has(bar)); bar++) {
      const { from, to } = bars[bar];
      for (const m of motif) if (from + m.start < to) out.push({ staff: text.staff, start: from + m.start, end: Math.min(from + m.end, to), implied: true });
    }
  }
  return out;
}

/** Gravure d'un « Ped. simile » : les pédales qu'il demande, atténuées ou non, ou la seule mention. */
export type SimileDisplay = "pedals" | "faded" | "text";

/**
 * Le morceau tel qu'il se grave : avec les pédales d'un « Ped. simile » écrites comme les autres
 * (la mention, devenue inutile, disparaît), atténuées, ou sans elles (la mention seule).
 */
export function withSimile(score: Score, display: SimileDisplay): Score {
  if (display === "text" || !score.pedalTexts.some((p) => /simile/i.test(p.text))) return score;
  const pedals = playedPedals(score).map((p) => (display === "pedals" && p.implied ? { staff: p.staff, start: p.start, end: p.end } : p));
  return { ...score, pedals, pedalTexts: score.pedalTexts.filter((p) => !/simile/i.test(p.text)) };
}

/**
 * L'instant où chaque note cesse de sonner, dans l'ordre de score.notes : sa fin écrite, ou plus
 * tard si la pédale la tient. Une note tenue par la pédale s'arrête quand la même touche est
 * rejouée : on refrappe la même corde.
 */
export function soundingEnds(score: Score): number[] {
  const part = (staff: number) => partOf(score.parts, staff);
  const pedals = playedPedals(score);
  const ends = score.notes.map((n) => {
    // la pédale enfoncée quand la touche est relâchée ; relâchée pile au changement de pédale, la
    // note s'éteint avec l'harmonie qu'on efface
    const held = pedals.find((p) => part(p.staff) === part(n.staff) && p.start < n.end && n.end < p.end);
    return held ? held.end : n.end;
  });
  return score.notes.map((n, i) => {
    if (ends[i] === n.end) return n.end;
    let end = ends[i];
    for (const m of score.notes)
      if (m.midi === n.midi && m.start > n.start && m.start < end && part(m.staff) === part(n.staff)) end = m.start;
    return Math.max(end, n.end);
  });
}
