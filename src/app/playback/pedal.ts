/**
 * Pédale de résonance à l'écoute : tant qu'elle est enfoncée, une note relâchée continue de sonner,
 * jusqu'à ce que la pédale remonte (ou change). La pédale s'écrit sous la dernière portée d'un
 * partie et vaut pour toutes ses portées.
 *
 * smplr ne tient pas la pédale lui-même : on allonge simplement les notes, comme les étouffoirs
 * restés levés.
 */
import { TICKS_PER_BEAT, partOf } from "../../core/index.ts";
import type { Pedal, Score } from "../../core/index.ts";

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
  score.beats.forEach((beat, index) => {
    bars[beat.barIndex] ??= { from: index * TICKS_PER_BEAT, to: 0 };
    bars[beat.barIndex].to = (index + 1) * TICKS_PER_BEAT;
  });
  const sectionStarts = new Set(score.markers.map((marker) => marker.barIndex));
  const part = (staff: number) => partOf(score.parts, staff);
  for (const text of score.pedalTexts) {
    if (!/simile/i.test(text.text)) continue;
    const written = score.pedals.filter((pedal) => part(pedal.staff) === part(text.staff));
    const pedalled = (bar: number) => written.filter((pedal) => pedal.start < bars[bar].to && pedal.end > bars[bar].from);
    let bar = bars.findIndex((span) => span && text.t >= span.from && text.t < span.to);
    if (bar < 0) continue;
    const at = bar;
    // le motif : la dernière mesure pédalée jusqu'ici, la mesure du « simile » comprise
    let model = -1;
    for (let earlier = bar; earlier >= 0 && model < 0; earlier--) if (pedalled(earlier).length) model = earlier;
    while (bar < bars.length && pedalled(bar).length) bar++;
    if (model < 0) continue;
    const motif = pedalled(model).map((pedal) => ({
      start: Math.max(pedal.start, bars[model].from) - bars[model].from,
      end: Math.min(pedal.end, bars[model].to) - bars[model].from,
    }));
    for (; bar < bars.length && !pedalled(bar).length && !(bar > at && sectionStarts.has(bar)); bar++) {
      const { from, to } = bars[bar];
      for (const span of motif)
        if (from + span.start < to) out.push({ staff: text.staff, start: from + span.start, end: Math.min(from + span.end, to), implied: true });
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
  if (display === "text" || !score.pedalTexts.some((pedalText) => /simile/i.test(pedalText.text))) return score;
  const pedals = playedPedals(score).map((pedal) => (display === "pedals" && pedal.implied ? { staff: pedal.staff, start: pedal.start, end: pedal.end } : pedal));
  return { ...score, pedals, pedalTexts: score.pedalTexts.filter((text) => !/simile/i.test(text.text)) };
}

/**
 * L'instant où chaque note cesse de sonner, dans l'ordre de score.notes : sa fin écrite, ou plus
 * tard si la pédale la tient. Une note tenue par la pédale s'arrête quand la même touche est
 * rejouée : on refrappe la même corde.
 */
export function soundingEnds(score: Score): number[] {
  const part = (staff: number) => partOf(score.parts, staff);
  const pedals = playedPedals(score);
  const ends = score.notes.map((note) => {
    // la pédale enfoncée quand la touche est relâchée ; relâchée pile au changement de pédale, la
    // note s'éteint avec l'harmonie qu'on efface
    const held = pedals.find((pedal) => part(pedal.staff) === part(note.staff) && pedal.start < note.end && note.end < pedal.end);
    return held ? held.end : note.end;
  });
  return score.notes.map((note, index) => {
    if (ends[index] === note.end) return note.end;
    let end = ends[index];
    for (const other of score.notes)
      if (other.midi === note.midi && other.start > note.start && other.start < end && part(other.staff) === part(note.staff)) end = other.start;
    return Math.max(end, note.end);
  });
}
