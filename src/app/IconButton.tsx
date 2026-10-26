/**
 * Un bouton à icône (changer de dossier, actualiser) : gris, l'accent au survol ; son nom, au survol
 * et pour les lecteurs d'écran. Sa place (className) dépend de ce qui l'entoure.
 */
import type { ReactNode } from "react";

export function IconButton({ label, title = label, onClick, className = "", children }: { label: string; title?: string; onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <button className={`${className} inline-flex items-center justify-center px-[7px] py-[5px] text-muted hover:text-accent hover:border-accent`} onClick={onClick} title={title} aria-label={label}>
      {children}
    </button>
  );
}
