/**
 * La conversion d'une partie pour la guitare ou la basse, demandée avant de convertir : la partie,
 * l'instrument, son accordage et son capo, l'octave. Le texte converti remplace le morceau, et
 * Ctrl+Z le rend.
 */
import { useState } from "react";
import { MAX_CAPO, pitchClass, stringsOf, tuningsOf } from "../core/index.ts";
import { Choices } from "./dialog/Choices.tsx";
import { Dialog } from "./dialog/Dialog.tsx";
import { Fields } from "./dialog/Fields.tsx";
import { NumberField } from "./dialog/NumberField.tsx";
import { SelectField } from "./dialog/SelectField.tsx";
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
  // de préférence la première partie qui n'est pas déjà sur des cordes
  const [part, setPart] = useState(() => Math.max(0, parts.findIndex((p) => !p.strings)));
  const [instrument, setInstrument] = useState<Instrument>("guitar");
  const [tuning, setTuning] = useState("standard");
  const [capo, setCapo] = useState(0);
  const [octave, setOctave] = useState<ConversionOptions["octave"]>(undefined);
  const name = (p: Part, i: number) => p.name ?? `Partie ${i + 1}`;
  return (
    <Dialog
      title="Convertir pour la guitare ou la basse"
      intro="Les notes de la partie passent sur les cordes, par le doigté le plus simple. C'est une proposition : vous la retouchez ensuite dans le texte."
      submit="Convertir"
      onSubmit={() => onConvert(part, { instrument, tuning, capo, octave })}
      onClose={onClose}
    >
      <Fields>
        {parts.length > 1 && (
          <SelectField label="Partie" value={part} onChange={(v) => setPart(Number(v))}>
            {parts.map((p, i) => (
              <option key={i} value={i}>
                {name(p, i)}
              </option>
            ))}
          </SelectField>
        )}
        <SelectField
          label="Instrument"
          value={instrument}
          onChange={(v) => {
            setInstrument(v as Instrument);
            setTuning("standard");
          }}
        >
          {INSTRUMENTS.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Accordage" value={tuning} onChange={setTuning}>
          {tuningsOf(instrument).map((t) => (
            <option key={t} value={t}>
              {t} ({openNames(instrument, t, noteNames)})
            </option>
          ))}
        </SelectField>
        <NumberField label="Capo" min={0} max={MAX_CAPO} value={capo} onChange={(v) => setCapo(Math.min(MAX_CAPO, Math.max(0, Math.round(v || 0))))} />
      </Fields>
      <Choices legend="L'octave" name="octave" options={OCTAVES} value={octave} onChange={setOctave} />
    </Dialog>
  );
}
