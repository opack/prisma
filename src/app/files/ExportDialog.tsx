/**
 * Les options de l'export MusicXML, demandées avant d'exporter : la façon d'écrire l'ordre de jeu
 * et, en reprises, les lettres des sections. Le dernier choix est retenu d'un export à l'autre.
 */
import { useState } from "react";
import { Check } from "../ui/dialog/Check.tsx";
import { Choices } from "../ui/dialog/Choices.tsx";
import { Dialog } from "../ui/dialog/Dialog.tsx";
import type { ExportOptions } from "../../core/index.ts";

const KEY = "prisma:export";

type Repeats = NonNullable<ExportOptions["repeats"]>;

const REPEATS: { value: Repeats; label: string; hint: string }[] = [
  { value: "sections", label: "Les sections de Prisma, dans l'ordre de jeu", hint: "Chaque section s'écrit à la suite, comme Prisma l'affiche : on joue d'un bout à l'autre." },
  { value: "traditional", label: "Des reprises et des cases, comme une partition classique", hint: "Quand l'ordre de jeu s'y prête (une reprise, des cases 1 et 2) ; le reste s'écrit à la suite." },
];

export const loadExportOptions = (): ExportOptions => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { repeats: REPEATS.some((r) => r.value === raw.repeats) ? raw.repeats : "sections", letters: raw.letters !== false };
  } catch {
    return { repeats: "sections", letters: true };
  }
};

export function ExportDialog({ onExport, onClose }: { onExport: (options: ExportOptions) => void; onClose: () => void }) {
  const [options, setOptions] = useState(loadExportOptions);
  const submit = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(options));
    } catch {
      /* stockage indisponible : le choix vaut pour cet export */
    }
    onExport(options);
  };
  return (
    <Dialog title="Exporter en MusicXML" submit="Exporter" onSubmit={submit} onClose={onClose}>
      <Choices legend="L'ordre de jeu" name="repeats" options={REPEATS} value={options.repeats!} onChange={(repeats) => setOptions({ ...options, repeats })}>
        {options.repeats === "traditional" && (
          <Check checked={options.letters !== false} onChange={(letters) => setOptions({ ...options, letters })}>
            Écrire aussi la lettre de chaque section (A, B…)
          </Check>
        )}
      </Choices>
    </Dialog>
  );
}
