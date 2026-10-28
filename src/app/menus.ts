/** Les menus de la barre : Fichier, Partition, Affichage, Aide ; ce que fait chaque action, et quand elle est cochée ou inactive. */
import type { MenuDef } from "./ui/menu/MenuBar.tsx";
import { ZOOMS } from "./score/useView.ts";
import type { View } from "./score/useView.ts";

type Ctx = {
  newFile: () => void;
  openFile: () => void;
  library: { shown: boolean; toggle: () => void };
  save: (as: boolean) => void;
  exportFile: () => void;
  share: () => void;
  importLink: () => void;
  reload?: () => void;
  engrave: () => void;
  autoEngrave: { on: boolean; toggle: () => void };
  options: { shown: boolean; toggle: () => void };
  convert: () => void;
  /** Rien à imprimer : pas de pages, ou la référence, la bibliothèque à la place. */
  canPrint: boolean;
  editor: { on: boolean; toggle: () => void };
  view: View;
  setView: (patch: Partial<View>) => void;
  zoomBy: (dir: 1 | -1) => void;
  fullScreen: { on: boolean; toggle: () => void };
  guide: { shown: boolean; toggle: () => void };
};

export function appMenus(c: Ctx): MenuDef[] {
  const { view } = c;
  const focused = view.fit === "focus";
  return [
    {
      label: "Fichier",
      items: [
        { label: "Nouveau…", onSelect: c.newFile },
        { label: "Ouvrir…", onSelect: c.openFile, shortcut: "Ctrl+O" },
        { label: "Bibliothèque", onSelect: c.library.toggle, checked: c.library.shown, shortcut: "Ctrl+B" },
        "separator",
        { label: "Enregistrer", onSelect: () => c.save(false), shortcut: "Ctrl+S" },
        { label: "Enregistrer sous…", onSelect: () => c.save(true), shortcut: "Ctrl+Maj+S" },
        { label: "Exporter en MusicXML…", onSelect: c.exportFile },
        "separator",
        { label: "Partager par un lien", onSelect: c.share },
        { label: "Importer un lien…", onSelect: c.importLink },
        "separator",
        { label: "Recharger", onSelect: () => c.reload?.(), disabled: !c.reload },
        "separator",
        // le site qui présente Prisma, autour de l'application (app/) ; le navigateur prévient
        // avant de quitter un morceau aux modifications non enregistrées
        { label: "Retour au site", onSelect: () => location.assign("..") },
      ],
    },
    {
      label: "Partition",
      items: [
        { label: "Mettre en page", onSelect: c.engrave, shortcut: "Ctrl+Entrée" },
        { label: "Mettre en page automatiquement", onSelect: c.autoEngrave.toggle, checked: c.autoEngrave.on },
        { label: "Options", onSelect: c.options.toggle, checked: c.options.shown },
        "separator",
        { label: "Convertir pour la guitare ou la basse…", onSelect: c.convert },
        "separator",
        { label: "Imprimer…", onSelect: () => window.print(), shortcut: "Ctrl+P", disabled: !c.canPrint },
      ],
    },
    {
      label: "Affichage",
      items: [
        { label: "Éditeur", onSelect: c.editor.toggle, checked: c.editor.on, shortcut: "Ctrl+E" },
        { label: "Piste de lecture", onSelect: () => c.setView({ progress: !view.progress }), checked: view.progress },
        { label: "Plein écran", onSelect: c.fullScreen.toggle, checked: c.fullScreen.on, shortcut: "F11" },
        "separator",
        { label: "Zoom avant", onSelect: () => c.zoomBy(1), shortcut: "Ctrl++", disabled: view.zoom >= ZOOMS[ZOOMS.length - 1] || focused },
        { label: "Zoom arrière", onSelect: () => c.zoomBy(-1), shortcut: "Ctrl+−", disabled: view.zoom <= ZOOMS[0] || focused },
        { label: `Taille normale${view.zoom !== 1 ? ` (zoom ${Math.round(view.zoom * 100)} %)` : ""}`, onSelect: () => c.setView({ zoom: 1 }), shortcut: "Ctrl+0", disabled: view.zoom === 1 || focused },
        "separator",
        { label: "Ajuster à la hauteur", onSelect: () => c.setView({ fit: "height", zoom: 1 }), checked: view.fit === "height" && view.zoom === 1 },
        { label: "Ajuster à la largeur", onSelect: () => c.setView({ fit: "width", zoom: 1 }), checked: view.fit === "width" && view.zoom === 1 },
        { label: "Lecture focalisée : deux systèmes", onSelect: () => c.setView({ fit: "focus", zoom: 1 }), checked: view.fit === "focus" },
      ],
    },
    { label: "Aide", items: [{ label: "Référence", onSelect: c.guide.toggle, checked: c.guide.shown }] },
  ];
}
