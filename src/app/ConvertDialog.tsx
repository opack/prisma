/**
 * La conversion d'une partie pour la guitare ou la basse, demandée avant de convertir : la partie,
 * l'instrument, son accordage et son capo, l'octave. Le texte converti remplace le morceau, et
 * Ctrl+Z le rend.
 */
import { useEffect, useRef, useState } from "react";
import { MAX_CAPO, pitchClass, stringsOf, tuningsOf } from "../core/index.ts";
import type { ConversionOptions, NoteNames, Part } from "../core/index.ts";

type Instrument = "guitar" | "electric-bass";

const INSTRUMENTS: { value: Instrument; label: string }[] = [
  { value: "guitar", label: "Guitare" },
  { value: "electric-bass", label: "Basse" },
];

const OCTAVES: { value: ConversionOptions["octave"]; label: string; hint: string }[] = [
  { value: undefined, label: "Au mieux", hint: "Prisma essaie les deux octaves et garde la plus facile à jouer." },
  { value: 0, label: "Telle qu'elle sonne", hint: "Les notes sonnent à la hauteur de l'original." },
  { value: -1, label: "Une octave plus bas", hint: "Comme la plupart des arrangements pour guitare : les notes écrites de l'original, qui sonnent une octave plus bas." },
];

/** Les cordes à vide d'un accordage, de la plus grave à l'aiguë : « mi la ré sol si mi ». */
const openNames = (instrument: Instrument, tuning: string, names: NoteNames) =>
  [...stringsOf(instrument, tuning, 0)!.open]
    .reverse()
    .map((m) => pitchClass((m % 12) + 1, names))
    .join(" ");

export function ConvertDialog({ parts, noteNames, onConvert, onClose }: { parts: Part[]; noteNames: NoteNames; onConvert: (part: number, options: ConversionOptions) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  // de préférence la première partie qui n'est pas déjà sur des cordes
  const [part, setPart] = useState(() => Math.max(0, parts.findIndex((p) => !p.strings)));
  const [instrument, setInstrument] = useState<Instrument>("guitar");
  const [tuning, setTuning] = useState("standard");
  const [capo, setCapo] = useState(0);
  const [octave, setOctave] = useState<ConversionOptions["octave"]>(undefined);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const name = (p: Part, i: number) => p.name ?? `Partie ${i + 1}`;
  return (
    <dialog ref={ref} className="dialog" aria-labelledby="convert-title" onClose={onClose} onCancel={onClose}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          onConvert(part, { instrument, tuning, capo, octave });
        }}
      >
        <h2 id="convert-title">Convertir pour la guitare ou la basse</h2>
        <p className="dialog-intro">Les notes de la partie passent sur les cordes, par le doigté le plus simple. C'est une proposition : vous la retouchez ensuite dans le texte.</p>
        <div className="dialog-fields">
          {parts.length > 1 && (
            <label>
              Partie
              <select value={part} onChange={(e) => setPart(Number(e.target.value))}>
                {parts.map((p, i) => (
                  <option key={i} value={i}>
                    {name(p, i)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Instrument
            <select
              value={instrument}
              onChange={(e) => {
                setInstrument(e.target.value as Instrument);
                setTuning("standard");
              }}
            >
              {INSTRUMENTS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Accordage
            <select value={tuning} onChange={(e) => setTuning(e.target.value)}>
              {tuningsOf(instrument).map((t) => (
                <option key={t} value={t}>
                  {t} ({openNames(instrument, t, noteNames)})
                </option>
              ))}
            </select>
          </label>
          <label>
            Capo
            <input type="number" min={0} max={MAX_CAPO} value={capo} onChange={(e) => setCapo(Math.min(MAX_CAPO, Math.max(0, Math.round(Number(e.target.value) || 0))))} />
          </label>
        </div>
        <fieldset>
          <legend>L'octave</legend>
          {OCTAVES.map((o) => (
            <label key={String(o.value)} className={"dialog-choice" + (octave === o.value ? " on" : "")}>
              <input type="radio" name="octave" checked={octave === o.value} onChange={() => setOctave(o.value)} />
              <span>
                <span className="dialog-choice-label">{o.label}</span>
                <span className="dialog-choice-hint">{o.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="primary">
            Convertir
          </button>
        </div>
      </form>
    </dialog>
  );
}
