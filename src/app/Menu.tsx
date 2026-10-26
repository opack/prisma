/**
 * Menu déroulant de la barre d'outils : un bouton qui ouvre une liste d'actions, chacune
 * avec son raccourci. Se ferme au choix d'une action, avec Échap ou par un clic ailleurs.
 */
import { useEffect, useRef, useState } from "react";

export type MenuItem =
  | { label: string; onSelect: () => void; shortcut?: string; disabled?: boolean; checked?: boolean }
  | "separator";

export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", outside);
    window.addEventListener("keydown", key);
    // le premier élément actif prend le focus, pour naviguer au clavier (Tab, Entrée)
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    return () => {
      window.removeEventListener("mousedown", outside);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="relative" ref={root}>
      <button className="border-transparent bg-transparent hover:border-line hover:bg-white aria-expanded:border-line aria-expanded:bg-white" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {label}
      </button>
      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 z-10 grid min-w-[260px] p-1 bg-white border border-line rounded-md shadow-[0_6px_18px_rgba(0,0,0,0.12)]" role="menu">
          {items.map((item, i) =>
            item === "separator" ? (
              <hr key={i} className="mx-1.5 my-1 border-0 border-t border-line" />
            ) : (
              <button
                key={i}
                className="grid grid-cols-[1.2em_1fr_auto] items-center gap-2 px-2.5 py-1.5 text-left whitespace-nowrap bg-transparent border-0 rounded enabled:hover:bg-panel focus-visible:bg-panel focus-visible:outline-none"
                role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                aria-checked={item.checked}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                <span className="text-accent">{item.checked ? "✓" : ""}</span>
                <span>{item.label}</span>
                {item.shortcut && <span className="text-muted text-[12px]">{item.shortcut}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
