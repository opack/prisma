/**
 * Fichier › Nouveau : le modèle du morceau à commencer, vide, pour le piano ou pour la guitare.
 * Le morceau en cours est remplacé après confirmation, s'il a des modifications non enregistrées.
 */
import { useState } from "react";
import { TEMPLATES } from "./templates.ts";
import { Choices } from "./dialog/Choices.tsx";
import { Dialog } from "./dialog/Dialog.tsx";
import type { Template } from "./templates.ts";

export function NewDialog({ onCreate, onClose }: { onCreate: (template: Template) => void; onClose: () => void }) {
  const [chosen, setChosen] = useState(TEMPLATES[1].id);
  return (
    <Dialog title="Nouveau morceau" submit="Créer" onSubmit={() => onCreate(TEMPLATES.find((t) => t.id === chosen)!)} onClose={onClose}>
      <Choices legend="Pour commencer" name="template" options={TEMPLATES.map((t) => ({ value: t.id, label: t.label, hint: t.hint }))} value={chosen} onChange={setChosen} />
    </Dialog>
  );
}
