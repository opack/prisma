/** Les menus de la barre : Fichier, Partition, Affichage, Aide ; ce que fait chaque action, et quand elle est cochée ou inactive. */
import type { MenuDef } from "./ui/menu/MenuBar.tsx";
import { ZOOMS } from "./score/useView.ts";
import type { View } from "./score/useView.ts";

type Ctx = {
  newFile: () => void;
  openFile: () => void;
  library: { shown: boolean; toggle: () => void };
  save: (as: boolean) => void;
  saveToLibrary: () => void;
  exportFile: () => void;
  share: () => void;
  importLink: () => void;
  reload?: () => void;
  engrave: () => void;
  autoEngrave: { on: boolean; toggle: () => void };
  options: { shown: boolean; toggle: () => void };
  convert: () => void;
  /** La fenêtre À propos : la version, les nouveautés. */
  about: () => void;
  /** Rien à imprimer : pas de pages, ou la référence, la bibliothèque à la place. */
  canPrint: boolean;
  editor: { on: boolean; toggle: () => void };
  view: View;
  setView: (patch: Partial<View>) => void;
  zoomBy: (dir: 1 | -1) => void;
  fullScreen: { on: boolean; toggle: () => void };
  guide: { shown: boolean; toggle: () => void };
};

export function appMenus(ctx: Ctx): MenuDef[] {
  const { view } = ctx;
  const focused = view.fit === "focus";
  return [
    {
      label: "Fichier",
      items: [
        { label: "Nouveau…", onSelect: ctx.newFile },
        { label: "Ouvrir…", onSelect: ctx.openFile, shortcut: "Ctrl+O" },
        { label: "Bibliothèque", onSelect: ctx.library.toggle, checked: ctx.library.shown, shortcut: "Ctrl+B" },
        "separator",
        { label: "Enregistrer", onSelect: () => ctx.save(false), shortcut: "Ctrl+S" },
        { label: "Enregistrer sous…", onSelect: () => ctx.save(true), shortcut: "Ctrl+Maj+S" },
        { label: "Enregistrer dans la bibliothèque", onSelect: ctx.saveToLibrary },
        { label: "Exporter en MusicXML…", onSelect: ctx.exportFile },
        "separator",
        { label: "Partager par un lien", onSelect: ctx.share },
        { label: "Importer un lien…", onSelect: ctx.importLink },
        "separator",
        { label: "Recharger", onSelect: () => ctx.reload?.(), disabled: !ctx.reload },
        "separator",
        // le site qui présente Prisma, autour de l'application (app/) ; le navigateur prévient
        // avant de quitter un morceau aux modifications non enregistrées
        { label: "Retour au site", onSelect: () => location.assign("..") },
      ],
    },
    {
      label: "Partition",
      items: [
        { label: "Mettre en page", onSelect: ctx.engrave, shortcut: "Ctrl+Entrée" },
        { label: "Mettre en page automatiquement", onSelect: ctx.autoEngrave.toggle, checked: ctx.autoEngrave.on },
        { label: "Options", onSelect: ctx.options.toggle, checked: ctx.options.shown },
        "separator",
        { label: "Convertir pour la guitare ou la basse…", onSelect: ctx.convert },
        "separator",
        { label: "Imprimer…", onSelect: () => window.print(), shortcut: "Ctrl+P", disabled: !ctx.canPrint },
      ],
    },
    {
      label: "Affichage",
      items: [
        { label: "Éditeur", onSelect: ctx.editor.toggle, checked: ctx.editor.on, shortcut: "Ctrl+E" },
        { label: "Piste de lecture", onSelect: () => ctx.setView({ progress: !view.progress }), checked: view.progress },
        { label: "Plein écran", onSelect: ctx.fullScreen.toggle, checked: ctx.fullScreen.on, shortcut: "F11" },
        "separator",
        {
          label: "Zoom avant",
          onSelect: () => ctx.zoomBy(1),
          shortcut: "Ctrl++",
          disabled: view.zoom >= ZOOMS[ZOOMS.length - 1] || focused,
        },
        { label: "Zoom arrière", onSelect: () => ctx.zoomBy(-1), shortcut: "Ctrl+−", disabled: view.zoom <= ZOOMS[0] || focused },
        {
          label: `Taille normale${view.zoom !== 1 ? ` (zoom ${Math.round(view.zoom * 100)} %)` : ""}`,
          onSelect: () => ctx.setView({ zoom: 1 }),
          shortcut: "Ctrl+0",
          disabled: view.zoom === 1 || focused,
        },
        "separator",
        {
          label: "Ajuster à la hauteur",
          onSelect: () => ctx.setView({ fit: "height", zoom: 1 }),
          checked: view.fit === "height" && view.zoom === 1,
        },
        {
          label: "Ajuster à la largeur",
          onSelect: () => ctx.setView({ fit: "width", zoom: 1 }),
          checked: view.fit === "width" && view.zoom === 1,
        },
        {
          label: "Lecture focalisée : deux systèmes",
          onSelect: () => ctx.setView({ fit: "focus", zoom: 1 }),
          checked: view.fit === "focus",
        },
      ],
    },
    {
      label: "Aide",
      items: [
        { label: "Référence", onSelect: ctx.guide.toggle, checked: ctx.guide.shown },
        "separator",
        { label: "À propos…", onSelect: ctx.about },
      ],
    },
  ];
}
