/**
 * La barre du haut : le logo et le nom, les menus, le fichier ouvert (un point à la couleur de l'accent tant
 * qu'il y a des modifications non enregistrées) et ses notes (`notes:`, sous un bouton), l'avis du
 * moment, une nouvelle version à prendre, l'écoute (listen) et le bouton des options. Toujours sur une
 * ligne : quand la place manque, le logo seul, puis un seul menu (trois traits), puis les réglages de
 * l'écoute sous un bouton ⋯, et sur un téléphone les options et les notes avec eux, le nom du
 * morceau en tête du menu. Les boutons de lecture restent toujours dans la barre.
 */
import type { ReactNode } from "react";
import { DialogTrigger, Pressable } from "react-aria-components";
import { Button } from "./ui/button/Button.tsx";
import { Logo } from "./ui/Logo.tsx";
import { Popover } from "./ui/popover/Popover.tsx";
import { MenuBar } from "./ui/menu/MenuBar.tsx";
import type { MenuDef } from "./ui/menu/MenuBar.tsx";

type Props = {
  menus: MenuDef[];
  fileName: string;
  saved: boolean;
  rewritable: boolean;
  notes?: string;
  notice: string | null;
  onUpdate?: () => void;
  optionsOpen: boolean;
  onOptions: () => void;
  /** L'écoute, dans la barre (bar) ou sous le bouton ⋯ (more), où elle ne montre que ses réglages. */
  listen: (place: "bar" | "more") => ReactNode;
};

/** Les notes du morceau, jamais imprimées : sous un bouton, à côté de son nom. */
function Notes({ notes }: { notes: string }) {
  return (
    <DialogTrigger>
      <Pressable>
        <Button kind="quiet" size="icon" className="-ml-1" title="Notes du morceau" aria-label="Notes du morceau">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
            <path fill="currentColor" fillRule="evenodd" d="M3 1.5h7.5L13 4v10.5H3zM4.5 3v10h7V4.6L9.9 3zM6 6.25h4v1.5H6zm0 3h4v1.5H6z" />
          </svg>
        </Button>
      </Pressable>
      <Popover label="Notes du morceau" title="Notes du morceau" className="max-w-[320px]">
        <p className="m-0 whitespace-pre-line">{notes}</p>
      </Popover>
    </DialogTrigger>
  );
}

/** Les trois points du bouton qui ouvre ce qui n'a pas trouvé place dans la barre. */
function MoreIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
      <path fill="currentColor" d="M2.5 6.5h3v3h-3zM6.5 6.5h3v3h-3zM10.5 6.5h3v3h-3z" />
    </svg>
  );
}

/** Le bouton des options : il ouvre ou ferme leur panneau. */
function OptionsButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <Button kind="quiet" size="icon" onClick={onClick} pressed={open} aria-controls="options" title="Options" aria-label="Options">
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M6.7 1h2.6l.4 1.9 1 .5 1.7-1 1.8 1.8-1 1.7.5 1 1.9.4v2.6l-1.9.4-.5 1 1 1.7-1.8 1.8-1.7-1-1 .5-.4 1.9H6.7l-.4-1.9-1-.5-1.7 1-1.8-1.8 1-1.7-.5-1L.4 9.3V6.7l1.9-.4.5-1-1-1.7 1.8-1.8 1.7 1 1-.5zM8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"
        />
      </svg>
    </Button>
  );
}

export function Toolbar({ menus, fileName, saved, rewritable, notes, notice, onUpdate, optionsOpen, onOptions, listen }: Props) {
  const tip = [saved ? "" : "Modifications non enregistrées", rewritable ? "Enregistrer réécrit ce fichier" : ""]
    .filter(Boolean)
    .join(" ; ");
  const name = (
    <>
      {fileName}
      {!saved && (
        <>
          <span className="text-accent" aria-hidden>
            {" "}
            ●
          </span>
          <span className="sr-only">, non enregistré</span>
        </>
      )}
    </>
  );
  return (
    <header className="flex gap-2 items-center px-4 py-2 bg-panel border-b border-line print:hidden! phone:gap-1 phone:px-2">
      <span className="flex items-center gap-1.5 font-bold tracking-[.06em] mr-3 bare:mr-1" title="Prisma">
        <Logo className="size-5" />
        <span className="bare:hidden">Prisma</span>
      </span>
      {/* sur un téléphone, le nom du morceau passe en tête du menu */}
      <MenuBar
        menus={menus}
        heading={
          <p
            className="hidden phone:block max-w-[260px] mt-0 mb-1 px-2.5 pt-1 pb-1.5 border-b border-line text-muted truncate"
            title={tip || undefined}
          >
            {name}
          </p>
        }
      />
      <span className="text-muted ml-2 truncate min-w-[6em] phone:hidden" title={tip || undefined}>
        {name}
      </span>
      {notes && (
        <span className="contents phone:hidden">
          <Notes notes={notes} />
        </span>
      )}
      {notice && (
        <span className="text-accent ml-3 whitespace-nowrap" role="status">
          {notice}
        </span>
      )}
      {onUpdate && (
        <Button
          kind="primary"
          size="small"
          className="ml-2 whitespace-nowrap"
          onClick={onUpdate}
          title="Une nouvelle version de Prisma est prête : recharger l'application pour la prendre"
        >
          Mettre à jour
        </Button>
      )}
      {listen("bar")}
      {/* ce qui n'a pas trouvé place : les réglages de l'écoute, et sur un téléphone les options et les notes */}
      <span className="hidden crowded:contents">
        <DialogTrigger>
          <Pressable>
            <Button size="icon" title="Réglages de l'écoute" aria-label="Plus">
              <MoreIcon />
            </Button>
          </Pressable>
          <Popover label="Réglages de l'écoute">
            <div className="flex flex-wrap items-center gap-2 max-w-[300px]">
              {listen("more")}
              <span className="hidden phone:contents">
                {notes && <Notes notes={notes} />}
                <OptionsButton open={optionsOpen} onClick={onOptions} />
              </span>
            </div>
          </Popover>
        </DialogTrigger>
      </span>
      <span className="contents phone:hidden">
        <OptionsButton open={optionsOpen} onClick={onOptions} />
      </span>
    </header>
  );
}
