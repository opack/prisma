/**
 * Graver : un bouton flottant en bas de l'éditeur, contre les pages. Il refait les pages d'après le
 * texte (Ctrl+Entrée), sa flèche ouvre le choix de graver automatiquement. Il n'est actif que s'il
 * y a quelque chose à graver : un texte modifié depuis la dernière gravure, sans gravure automatique.
 */
import { Popover } from "./popover/Popover.tsx";
import { PopoverCheck } from "./popover/PopoverCheck.tsx";
import { PopoverHint } from "./popover/PopoverHint.tsx";
import { usePopover } from "./popover/usePopover.ts";

/** Les deux boutons, collés : la mise en page, et sa flèche. */
const ENGRAVE = "relative flex items-center justify-center h-10 border-0 bg-accent text-white enabled:hover:brightness-[1.12]";

export function EngraveButton({ dirty, auto, onEngrave, onAuto }: { dirty: boolean; auto: boolean; onEngrave: () => void; onAuto: (auto: boolean) => void }) {
  const { open, setOpen, root } = usePopover<HTMLSpanElement>();
  const title = auto ? "Mise en page automatique : les pages suivent le texte" : dirty ? "Mettre en page le texte modifié (Ctrl+Entrée)" : "Rien à mettre en page : les pages sont à jour";
  return (
    <span className="absolute right-6 bottom-5 z-2 flex rounded-md shadow-[0_2px_6px_rgba(0,0,0,0.18),0_6px_16px_rgba(0,0,0,0.1)]" ref={root}>
      <button className={`${ENGRAVE} w-11 p-0 rounded-[6px_0_0_6px] disabled:opacity-100 disabled:bg-accent-40`} onClick={onEngrave} disabled={auto || !dirty} title={title} aria-label="Mettre en page">
        <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M13.5 6.5A5.6 5.6 0 0 0 3 5M2.5 9.5A5.6 5.6 0 0 0 13 11" />
          <path d="M3 1.8V5h3.2M13 14.2V11H9.8" />
        </svg>
      </button>
      <button className={`${ENGRAVE} w-[22px] p-0 rounded-[0_6px_6px_0] border-l border-l-white/35`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)} title="Réglages de la mise en page" aria-label="Réglages de la mise en page">
        <svg width="8" height="16" viewBox="0 0 8 16" aria-hidden>
          <path d="M1 9.5h6L4 6z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <Popover label="Réglages de la mise en page" above className="min-w-[240px]">
          <PopoverCheck checked={auto} onChange={onAuto}>
            Mettre en page automatiquement
          </PopoverCheck>
          <PopoverHint>La mise en page suit la saisie, peu après la dernière frappe.</PopoverHint>
        </Popover>
      )}
    </span>
  );
}
