/**
 * Une fenêtre de dialogue (Nouveau, l'export, la conversion) : au centre, son titre, son contenu,
 * puis Annuler et le bouton qui valide. Elle s'ouvre en modale ; Échap ou Annuler la ferme. Ouverte
 * au clavier, le premier champ a le focus ; à la souris ou au doigt, la fenêtre seule, sans contour.
 */
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { useFocusVisible } from "react-aria";
import { Button } from "../button/Button.tsx";

export function Dialog({ title, intro, submit, onSubmit, onClose, children }: { title: string; intro?: ReactNode; submit: string; onSubmit: () => void; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const { isFocusVisible: keyboard } = useFocusVisible();
  useEffect(() => {
    const d = ref.current;
    if (!d || d.open) return;
    d.showModal();
    if (!keyboard) d.focus();
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
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" kind="primary">
            {submit}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
