/**
 * Les options de l'export MusicXML, demandées avant d'exporter : la façon d'écrire l'ordre de jeu
 * et, en reprises, les lettres des sections. Le dernier choix est retenu d'un export à l'autre.
 */
import { useEffect, useRef, useState } from "react";
import type { ExportOptions } from "../core/index.ts";

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
  const ref = useRef<HTMLDialogElement>(null);
  const [options, setOptions] = useState(loadExportOptions);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const submit = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(options));
    } catch {
      /* stockage indisponible : le choix vaut pour cet export */
    }
    onExport(options);
  };
  return (
    <dialog ref={ref} className="export-dialog" aria-labelledby="export-title" onClose={onClose} onCancel={onClose}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h2 id="export-title">Exporter en MusicXML</h2>
        <fieldset>
          <legend>L'ordre de jeu</legend>
          {REPEATS.map((r) => (
            <label key={r.value} className={"export-choice" + (options.repeats === r.value ? " on" : "")}>
              <input type="radio" name="repeats" value={r.value} checked={options.repeats === r.value} onChange={() => setOptions({ ...options, repeats: r.value })} />
              <span>
                <span className="export-choice-label">{r.label}</span>
                <span className="export-choice-hint">{r.hint}</span>
              </span>
            </label>
          ))}
          {options.repeats === "traditional" && (
            <label className="export-check">
              <input type="checkbox" checked={options.letters !== false} onChange={(e) => setOptions({ ...options, letters: e.target.checked })} />
              Écrire aussi la lettre de chaque section (A, B…)
            </label>
          )}
        </fieldset>
        <div className="export-actions">
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="primary">
            Exporter
          </button>
        </div>
      </form>
    </dialog>
  );
}
