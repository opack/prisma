/**
 * Graver : un bouton flottant en bas de l'éditeur, contre les pages. Il refait les pages d'après le
 * texte (Ctrl+Entrée), sa flèche ouvre le choix de graver automatiquement. Il n'est actif que s'il
 * y a quelque chose à graver : un texte modifié depuis la dernière gravure, sans gravure automatique.
 */
import { usePopover } from "./popover.ts";

export function EngraveButton({ dirty, auto, onEngrave, onAuto }: { dirty: boolean; auto: boolean; onEngrave: () => void; onAuto: (auto: boolean) => void }) {
  const { open, setOpen, root } = usePopover<HTMLSpanElement>();
  const title = auto ? "Gravure automatique : les pages suivent le texte" : dirty ? "Graver le texte modifié (Ctrl+Entrée)" : "Rien à graver : les pages sont à jour";
  return (
    <span className={"engrave" + (auto ? " auto" : "")} ref={root}>
      <button onClick={onEngrave} disabled={auto || !dirty} title={title} aria-label="Graver">
        <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M13.5 6.5A5.6 5.6 0 0 0 3 5M2.5 9.5A5.6 5.6 0 0 0 13 11" />
          <path d="M3 1.8V5h3.2M13 14.2V11H9.8" />
        </svg>
      </button>
      <button className={`more${open ? " open" : ""}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)} title="Réglages de la gravure" aria-label="Réglages de la gravure">
        <svg width="8" height="16" viewBox="0 0 8 16" aria-hidden>
          <path d="M1 9.5h6L4 6z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Réglages de la gravure">
          <label>
            <input type="checkbox" checked={auto} onChange={(e) => onAuto(e.target.checked)} />
            Graver automatiquement
          </label>
          <p className="popover-hint">La gravure suit la saisie, peu après la dernière frappe.</p>
        </div>
      )}
    </span>
  );
}
