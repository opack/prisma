/**
 * Les raccourcis de l'application, partout : Ctrl+Entrée (mettre en page), Ctrl+S et Ctrl+Maj+S
 * (enregistrer), Ctrl+O (ouvrir), Ctrl+B (la bibliothèque), Ctrl+E (l'éditeur), Ctrl++, Ctrl+−,
 * Ctrl+0 (le zoom), F11 (plein écran). Les menus les rappellent.
 */
import { useEffect, useRef } from "react";

type Actions = {
  engrave: () => void;
  save: (as: boolean) => void;
  open: () => void;
  library: () => void;
  editor: () => void;
  zoom: (dir: 1 | -1 | 0) => void;
  fullScreen: () => void;
};

export function useShortcuts(actions: Actions) {
  // les gestes à jour, sans réinscrire l'écoute du clavier à chaque rendu
  const now = useRef(actions);
  now.current = actions;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = now.current;
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const run = (f: () => void) => (e.preventDefault(), f());
      if (ctrl && e.key === "Enter") run(a.engrave);
      else if (ctrl && key === "s") run(() => a.save(e.shiftKey));
      else if (ctrl && key === "o") run(a.open);
      else if (ctrl && key === "b") run(a.library);
      else if (ctrl && key === "e") run(a.editor);
      else if (ctrl && ["+", "=", "-", "0"].includes(e.key)) run(() => a.zoom(e.key === "0" ? 0 : e.key === "-" ? -1 : 1));
      else if (e.key === "F11") run(a.fullScreen);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
}
