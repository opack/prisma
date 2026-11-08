/**
 * Les raccourcis de l'application, partout : Ctrl+Entrée (mettre en page), Ctrl+S et Ctrl+Maj+S
 * (enregistrer), Ctrl+O (ouvrir), Ctrl+B (la bibliothèque), Ctrl+E (l'éditeur), Ctrl++, Ctrl+−,
 * Ctrl+0 (le zoom), F11 (plein écran). Les menus les rappellent.
 */
import { useEventListener } from "@vueuse/core";

type Actions = {
  engrave: () => void;
  save: (as: boolean) => void;
  open: () => void;
  library: () => void;
  editor: () => void;
  zoom: (direction: 1 | -1 | 0) => void;
  fullScreen: () => void;
};

export function useShortcuts(actions: Actions) {
  useEventListener(window, "keydown", (event: KeyboardEvent) => {
    const ctrl = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    const run = (action: () => void) => (event.preventDefault(), action());
    if (ctrl && event.key === "Enter") run(actions.engrave);
    else if (ctrl && key === "s") run(() => actions.save(event.shiftKey));
    else if (ctrl && key === "o") run(actions.open);
    else if (ctrl && key === "b") run(actions.library);
    else if (ctrl && key === "e") run(actions.editor);
    else if (ctrl && ["+", "=", "-", "0"].includes(event.key)) run(() => actions.zoom(event.key === "0" ? 0 : event.key === "-" ? -1 : 1));
    else if (event.key === "F11") run(actions.fullScreen);
  });
}
