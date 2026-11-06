/**
 * Conversion d'une partie pour un instrument à cordes (guitare, basse) : une proposition, que
 * l'arrangeur corrige ensuite dans le texte.
 *
 * - Rendre jouable, par des règles claires : les portées de la partie se réunissent en une ; une
 *   note hors de la tessiture passe à l'octave voisine ; un accord que la main ne peut pas prendre
 *   garde son aigu (la mélodie) et sa basse, et perd ses notes intérieures.
 * - L'octave : la guitare s'écrit une octave au-dessus de ce qu'elle fait sonner, et les
 *   arrangements gardent souvent les notes écrites, qui sonnent alors une octave plus bas. Sans
 *   consigne, la conversion essaie les deux et garde la moins coûteuse.
 * - Choisir les cordes : le doigté le moins coûteux sur tout le morceau (voir fingerStrings).
 */
import { guessInstrument } from "./instruments.ts";
import type { InstrumentName } from "./instruments.ts";
import { firstStaves, sortNotes } from "./model.ts";
import type { Note, Score, Staff } from "./model.ts";
import { MAX_FRET, fingerStrings, fretOf, settleSlides, stringsOf } from "./strings.ts";
import type { Strings } from "./strings.ts";

/** Ce que la conversion a changé, pour savoir où repasser. */
export type ConversionReport = { octave: 0 | -1; moved: number; dropped: number; notes: number };

export type ConversionOptions = { instrument: InstrumentName; tuning?: string; capo?: number; octave?: 0 | -1 };

/** Ce que coûte, en plus du doigté, une note déplacée d'une octave, une note retirée. */
const MOVED_COST = 4;
const DROPPED_COST = 8;

/**
 * Convertit une partie d'un morceau pour un instrument à cordes : ses portées réunies en une, ses
 * notes rendues jouables et mises sur des cordes. Rend le morceau converti et ce qui a changé.
 */
export function convertToStrings(score: Score, part: number, options: ConversionOptions): { score: Score; report: ConversionReport } {
  const { instrument, tuning = "standard", capo = 0 } = options;
  const strings = stringsOf(instrument, tuning, capo);
  if (!strings) throw new Error(`accordage « ${tuning} » inconnu pour ${instrument}`);
  if (options.octave !== undefined) return convertAt(score, part, instrument, strings, options.octave).result;
  const tries = ([0, -1] as const).map((octave) => convertAt(score, part, instrument, strings, octave));
  return tries.reduce((first, second) => (second.cost < first.cost ? second : first)).result;
}

function convertAt(score: Score, part: number, instrument: InstrumentName, strings: Strings, octave: 0 | -1) {
  const first = firstStaves(score.parts)[part];
  const count = score.parts[part].staves;
  // les portées de la partie n'en font qu'une ; celles qui suivent remontent d'autant
  const staff = (staffIndex: Staff) => (staffIndex < first ? staffIndex : staffIndex < first + count ? first : staffIndex - (count - 1));
  const mine = (staffIndex: Staff) => staffIndex >= first && staffIndex < first + count;
  const low = strings.open[strings.open.length - 1] + strings.capo;
  const high = strings.open[0] + strings.capo + MAX_FRET;
  // une note hors de la tessiture passe à l'octave voisine
  const fold = (midi: number) => {
    let folded = midi + 12 * octave;
    while (folded < low) folded += 12;
    while (folded > high) folded -= 12;
    return folded;
  };
  let moved = 0;
  let dropped = 0;
  const notes: Note[] = [];
  for (const original of score.notes) {
    if (!mine(original.staff)) {
      notes.push({ ...original, staff: staff(original.staff) });
      continue;
    }
    const midi = fold(original.midi);
    if (midi !== original.midi + 12 * octave) moved++;
    const { string: _, ...rest } = original;
    // la voisine de trille suit sa note
    const note: Note = {
      ...rest,
      staff: first,
      midi,
      ...(original.trill !== undefined ? { trill: original.trill + midi - original.midi } : {}),
    };
    // la même note jouée par les deux mains (ou ramenée à la même octave) : une seule fois
    const twin = notes.find((other) => other.staff === first && other.midi === midi && other.start === note.start);
    if (twin) {
      twin.end = Math.max(twin.end, note.end);
      dropped++;
      continue;
    }
    notes.push(note);
  }
  const fingering = fingerStrings(
    notes.filter((note) => note.staff === first),
    strings,
  );
  const lost = new Set(fingering.dropped);
  dropped += lost.size;
  const kept = notes.filter((note) => !lost.has(note));
  // petites notes : sur la corde de leur note, sinon sur la plus aiguë qui les joue
  const plays = (string: number, midi: number) => fretOf(strings, string, midi) >= 0 && fretOf(strings, string, midi) <= MAX_FRET;
  const graces = score.graces.flatMap((grace) => {
    if (!mine(grace.staff)) return [{ ...grace, staff: staff(grace.staff) }];
    const midi = fold(grace.midi);
    const main = kept.find((note) => note.staff === first && note.start === grace.t && plays(note.string!, midi));
    const string = main?.string ?? strings.open.findIndex((_, index) => plays(index + 1, midi)) + 1;
    return string > 0 ? [{ ...grace, staff: first, midi, string }] : [];
  });
  // ce qui est attaché à une portée suit sa portée ; une fois par instant dans la partie réunie
  const unique = <T extends { staff: Staff }>(list: T[], key: (item: T) => string) => {
    const seen = new Set<string>();
    return list.flatMap((item) => {
      const restaffed = { ...item, staff: staff(item.staff) };
      const seenKey = restaffed.staff + "|" + key(restaffed);
      if (seen.has(seenKey)) return [];
      seen.add(seenKey);
      return [restaffed];
    });
  };
  const name = score.parts[part].name;
  // la partie prend le nom de l'instrument, sauf si le sien le dit déjà
  const named = name && guessInstrument(name) === instrument ? name : instrument === "guitar" ? "Guitare" : "Basse";
  const parts = score.parts.map((other, index) =>
    index === part ? { name: named, staves: 1, ...(guessInstrument(named) !== instrument ? { instrument } : {}), strings } : other,
  );
  const converted: Score = {
    ...score,
    parts,
    notes: settleSlides(sortNotes(kept)),
    graces: unique(graces, (grace) => `${grace.t}|${grace.slot}|${grace.midi}`),
    expressions: unique(score.expressions, (expression) => `${expression.t}|${expression.text}`),
    hairpins: unique(score.hairpins, (hairpin) => `${hairpin.start}|${hairpin.kind}`),
    effects: unique(score.effects, (effect) => `${effect.start}|${effect.kind}`),
    slurs: unique(score.slurs, (slur) => `${slur.start}|${slur.end}`),
    lyrics: unique(score.lyrics, (lyric) => `${lyric.t}|${lyric.verse}`),
    articulations: unique(score.articulations, (articulation) => `${articulation.t}|${articulation.kind}`),
    arpeggios: score.arpeggios
      .map((arpeggio) => (arpeggio.staff === undefined ? arpeggio : { ...arpeggio, staff: staff(arpeggio.staff) }))
      .filter((arpeggio, index, all) => all.findIndex((other) => other.t === arpeggio.t && other.staff === arpeggio.staff) === index),
    // la pédale de résonance est celle du piano : la guitare laisse sonner par la tenue
    pedals: score.pedals.filter((pedal) => !mine(pedal.staff)).map((pedal) => ({ ...pedal, staff: staff(pedal.staff) })),
    pedalTexts: score.pedalTexts.filter((pedalText) => !mine(pedalText.staff)).map((text) => ({ ...text, staff: staff(text.staff) })),
  };
  const report: ConversionReport = { octave, moved, dropped, notes: kept.filter((note) => note.staff === first).length };
  return { result: { score: converted, report }, cost: fingering.cost + moved * MOVED_COST + dropped * DROPPED_COST };
}
