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
import { MAX_FRET, fingerStrings, fretOf, stringsOf } from "./strings.ts";
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
  const strs = stringsOf(instrument, tuning, capo);
  if (!strs) throw new Error(`accordage « ${tuning} » inconnu pour ${instrument}`);
  if (options.octave !== undefined) return convertAt(score, part, instrument, strs, options.octave).result;
  const tries = ([0, -1] as const).map((o) => convertAt(score, part, instrument, strs, o));
  return tries.reduce((a, b) => (b.cost < a.cost ? b : a)).result;
}

function convertAt(score: Score, part: number, instrument: InstrumentName, strs: Strings, octave: 0 | -1) {
  const first = firstStaves(score.parts)[part];
  const count = score.parts[part].staves;
  // les portées de la partie n'en font qu'une ; celles qui suivent remontent d'autant
  const staff = (s: Staff) => (s < first ? s : s < first + count ? first : s - (count - 1));
  const mine = (s: Staff) => s >= first && s < first + count;
  const low = strs.open[strs.open.length - 1] + strs.capo;
  const high = strs.open[0] + strs.capo + MAX_FRET;
  // une note hors de la tessiture passe à l'octave voisine
  const fold = (midi: number) => {
    let m = midi + 12 * octave;
    while (m < low) m += 12;
    while (m > high) m -= 12;
    return m;
  };
  let moved = 0;
  let dropped = 0;
  const notes: Note[] = [];
  for (const n of score.notes) {
    if (!mine(n.staff)) {
      notes.push({ ...n, staff: staff(n.staff) });
      continue;
    }
    const midi = fold(n.midi);
    if (midi !== n.midi + 12 * octave) moved++;
    const { string: _, ...rest } = n;
    // la voisine de trille suit sa note
    const note: Note = { ...rest, staff: first, midi, ...(n.trill !== undefined ? { trill: n.trill + midi - n.midi } : {}) };
    // la même note jouée par les deux mains (ou ramenée à la même octave) : une seule fois
    const twin = notes.find((m) => m.staff === first && m.midi === midi && m.start === note.start);
    if (twin) {
      twin.end = Math.max(twin.end, note.end);
      dropped++;
      continue;
    }
    notes.push(note);
  }
  const fingering = fingerStrings(
    notes.filter((n) => n.staff === first),
    strs,
  );
  const lost = new Set(fingering.dropped);
  dropped += lost.size;
  const kept = notes.filter((n) => !lost.has(n));
  // petites notes : sur la corde de leur note, sinon sur la plus aiguë qui les joue
  const plays = (s: number, midi: number) => fretOf(strs, s, midi) >= 0 && fretOf(strs, s, midi) <= MAX_FRET;
  const graces = score.graces.flatMap((g) => {
    if (!mine(g.staff)) return [{ ...g, staff: staff(g.staff) }];
    const midi = fold(g.midi);
    const main = kept.find((n) => n.staff === first && n.start === g.t && plays(n.string!, midi));
    const string = main?.string ?? strs.open.findIndex((_, k) => plays(k + 1, midi)) + 1;
    return string > 0 ? [{ ...g, staff: first, midi, string }] : [];
  });
  // ce qui est attaché à une portée suit sa portée ; une fois par instant dans la partie réunie
  const unique = <T extends { staff: Staff }>(list: T[], key: (x: T) => string) => {
    const seen = new Set<string>();
    return list.flatMap((x) => {
      const y = { ...x, staff: staff(x.staff) };
      const k = y.staff + "|" + key(y);
      if (seen.has(k)) return [];
      seen.add(k);
      return [y];
    });
  };
  const name = score.parts[part].name;
  // la partie prend le nom de l'instrument, sauf si le sien le dit déjà
  const named = name && guessInstrument(name) === instrument ? name : instrument === "guitar" ? "Guitare" : "Basse";
  const parts = score.parts.map((p, i) => (i === part ? { name: named, staves: 1, ...(guessInstrument(named) !== instrument ? { instrument } : {}), strings: strs } : p));
  const converted: Score = {
    ...score,
    parts,
    notes: sortNotes(kept),
    graces: unique(graces, (g) => `${g.t}|${g.slot}|${g.midi}`),
    expressions: unique(score.expressions, (e) => `${e.t}|${e.text}`),
    hairpins: unique(score.hairpins, (h) => `${h.start}|${h.kind}`),
    slurs: unique(score.slurs, (s) => `${s.start}|${s.end}`),
    lyrics: unique(score.lyrics, (l) => `${l.t}|${l.verse}`),
    articulations: unique(score.articulations, (a) => `${a.t}|${a.kind}`),
    arpeggios: score.arpeggios
      .map((a) => (a.staff === undefined ? a : { ...a, staff: staff(a.staff) }))
      .filter((a, i, all) => all.findIndex((b) => b.t === a.t && b.staff === a.staff) === i),
    // la pédale de résonance est celle du piano : la guitare laisse sonner par la tenue
    pedals: score.pedals.filter((p) => !mine(p.staff)).map((p) => ({ ...p, staff: staff(p.staff) })),
    pedalTexts: score.pedalTexts.filter((p) => !mine(p.staff)).map((p) => ({ ...p, staff: staff(p.staff) })),
  };
  const report: ConversionReport = { octave, moved, dropped, notes: kept.filter((n) => n.staff === first).length };
  return { result: { score: converted, report }, cost: fingering.cost + moved * MOVED_COST + dropped * DROPPED_COST };
}
