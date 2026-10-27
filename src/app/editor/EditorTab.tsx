/**
 * La languette de l'éditeur, sur le bord où il apparaît : on le tire, on le repousse. En lecture,
 * contre le bord gauche ; en édition, contre l'éditeur (sa largeur : --editor-width), et sur un
 * écran étroit, où l'éditeur prend toute la place, contre le bord droit.
 */
export function EditorTab({ editing, onToggle }: { editing: boolean; onToggle: () => void }) {
  return (
    <button
      className={`absolute z-3 top-1/2 -translate-y-1/2 grid justify-items-center gap-1.5 w-[22px] py-2.5 border border-line bg-panel text-muted shadow-[1px_1px_4px_rgba(0,0,0,0.08)] hover:text-accent hover:border-accent print:hidden ${editing ? "left-[calc(var(--editor-width)-1px)] border-l-0 rounded-r-md narrow:left-auto narrow:right-0 narrow:border-l narrow:border-r-0 narrow:rounded-r-none narrow:rounded-l-md" : "left-0 border-l-0 rounded-r-md"}`}
      onClick={onToggle}
      aria-pressed={editing}
      title={editing ? "Masquer l'éditeur (Ctrl+E)" : "Afficher l'éditeur (Ctrl+E)"}
      aria-label="Éditeur"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
        <path fill="currentColor" d="M11.3 1.3a1.5 1.5 0 0 1 2.1 0l1.3 1.3a1.5 1.5 0 0 1 0 2.1l-8.6 8.6-3.9 1.2 1.2-3.9zM10.4 4 3.5 10.9l-.6 2.2 2.2-.6L12 5.6z" />
      </svg>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
        <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d={editing ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"} />
      </svg>
    </button>
  );
}
