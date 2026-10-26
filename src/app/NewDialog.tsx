/**
 * Fichier › Nouveau : le modèle du morceau à commencer, vide, pour le piano ou pour la guitare.
 * Le morceau en cours est remplacé après confirmation, s'il a des modifications non enregistrées.
 */
import { useEffect, useRef, useState } from "react";
import { TEMPLATES } from "./templates.ts";
import type { Template } from "./templates.ts";

export function NewDialog({ onCreate, onClose }: { onCreate: (template: Template) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [chosen, setChosen] = useState(TEMPLATES[1].id);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className="dialog" aria-labelledby="new-title" onClose={onClose} onCancel={onClose}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate(TEMPLATES.find((t) => t.id === chosen)!);
        }}
      >
        <h2 id="new-title">Nouveau morceau</h2>
        <fieldset>
          <legend>Pour commencer</legend>
          {TEMPLATES.map((t) => (
            <label key={t.id} className={"dialog-choice" + (chosen === t.id ? " on" : "")}>
              <input type="radio" name="template" checked={chosen === t.id} onChange={() => setChosen(t.id)} />
              <span>
                <span className="dialog-choice-label">{t.label}</span>
                <span className="dialog-choice-hint">{t.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="primary">
            Créer
          </button>
        </div>
      </form>
    </dialog>
  );
}
