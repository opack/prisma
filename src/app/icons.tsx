/** Icônes des boutons sans texte, dessinées dans un carré de 16 (leur nom passe en bulle et en aria-label). */

export function BackIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
      <path fill="currentColor" d="M7.2 2.6 8.3 3.7 4.8 7.2H14v1.6H4.8l3.5 3.5-1.1 1.1L1.8 8z" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
      <path d="M13 8.5A5 5 0 1 1 11.3 4.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path fill="currentColor" d="M13.8 1.6v4.6H9.2z" />
    </svg>
  );
}

/** Un dossier, et la flèche d'un échange : en choisir un autre. */
export function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
      <path d="M1.8 3.2h4l1.5 1.6h6.9v8H1.8z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path fill="currentColor" d="M6 8.2h3.6V6.9l2.3 2-2.3 2V9.6H6z" />
    </svg>
  );
}

/** Deux feuilles l'une sur l'autre : copier. */
export function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
      <rect x="5.2" y="5.2" width="8.6" height="8.6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.8 2.2H3.6a1.4 1.4 0 0 0-1.4 1.4v7.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Une coche : c'est fait. */
export function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
      <path d="M2.8 8.4 6.4 12l6.8-7.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
