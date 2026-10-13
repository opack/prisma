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
    <div className="menu" ref={root}>
      <button className="menu-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {label}
      </button>
      {open && (
        <div className="menu-list" role="menu">
          {items.map((item, i) =>
            item === "separator" ? (
              <hr key={i} />
            ) : (
              <button
                key={i}
                role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                aria-checked={item.checked}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                <span className="check">{item.checked ? "✓" : ""}</span>
                <span className="label">{item.label}</span>
                {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
