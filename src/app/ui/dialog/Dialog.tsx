/**
 * Une fenêtre de dialogue (Nouveau, l'export, la conversion, un morceau reçu) : au centre, son
 * titre, son contenu, puis Annuler, d'autres actions s'il y en a, et le bouton qui valide. Elle
 * s'ouvre en modale ; Échap ou Annuler la ferme. Ouverte au clavier, le premier champ a le focus (ou
 * le bouton qui valide, pour une fenêtre sans champ : focusSubmit) ; à la souris ou au doigt, la
 * fenêtre seule, sans contour, sauf pour un champ à remplir aussitôt (focusField : un lien à coller).
 */
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { useFocusVisible } from "react-aria";
import { Button } from "../button/Button.tsx";

export function Dialog({ title, intro, submit, onSubmit, onClose, actions, cancel = "Annuler", focusSubmit = false, focusField = false, children }: { title: string; intro?: ReactNode; submit: string; onSubmit: () => void; onClose: () => void; actions?: ReactNode; cancel?: string; focusSubmit?: boolean; focusField?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const { isFocusVisible: keyboard } = useFocusVisible();
  useEffect(() => {
    const d = ref.current;
    if (!d || d.open) return;
    d.showModal();
    // showModal a donné le focus au premier champ
    if (focusField) return;
    if (!keyboard) d.focus();
    else if (focusSubmit) d.querySelector<HTMLButtonElement>("button[type=submit]")?.focus();
  }, []);
  return (
    <dialog ref={ref} tabIndex={-1} className="outline-none m-auto w-[min(460px,calc(100%_-_32px))] p-0 border border-line rounded-lg bg-panel text-ink shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop:bg-[rgba(27,29,31,0.32)]" aria-labelledby={id} onClose={onClose} onCancel={onClose}>
      <form
        className="grid gap-3.5 px-5 pt-4.5 pb-4"
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <h2 className="m-0 text-[1.05rem]" id={id}>
          {title}
        </h2>
        {intro && <p className="-mt-1.5 mb-0 text-muted leading-[1.4]">{intro}</p>}
        {children}
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose}>{cancel}</Button>
          {actions}
          <Button type="submit" kind="primary">
            {submit}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
