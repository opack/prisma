/**
 * Des boutons collés, d'un seul cadre (les commandes de l'écoute, deux vues au choix) : leurs coins
 * arrondis aux deux bouts seulement. Sa place (className) dépend de ce qui l'entoure.
 */
import type { ReactNode } from "react";

export function ButtonGroup({ label, className = "", children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <span className={`${className} inline-flex *:rounded-none *:first:rounded-l *:last:rounded-r *:not-first:-ml-px`} role="group" aria-label={label}>
      {children}
    </span>
  );
}
