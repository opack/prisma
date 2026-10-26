import type { ReactNode } from "react";

/** Une légende, un texte d'appoint ; sa place (ses marges) dépend de ce qui l'entoure. */
export function Caption({ className = "", children }: { className?: string; children: ReactNode }) {
  return <p className={`text-[0.95rem] text-muted ${className}`}>{children}</p>;
}
