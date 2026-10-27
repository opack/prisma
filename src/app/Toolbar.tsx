/**
 * La barre du haut : le nom, les menus, le fichier ouvert (un point à la couleur de l'accent tant
 * qu'il y a des modifications non enregistrées), l'avis du moment, l'écoute (children) et le bouton
 * des options. Quand la place manque, l'écoute passe sur sa propre ligne, sous les menus.
 */
import type { ReactNode } from "react";
import { Button } from "./ui/button/Button.tsx";
import { MenuBar } from "./ui/menu/MenuBar.tsx";
import type { MenuDef } from "./ui/menu/MenuBar.tsx";

type Props = { menus: MenuDef[]; fileName: string; saved: boolean; rewritable: boolean; notice: string | null; optionsOpen: boolean; onOptions: () => void; children: ReactNode };

export function Toolbar({ menus, fileName, saved, rewritable, notice, optionsOpen, onOptions, children }: Props) {
  const tip = [saved ? "" : "Modifications non enregistrées", rewritable ? "Enregistrer réécrit ce fichier" : ""].filter(Boolean).join(" ; ");
  return (
    <header className="flex gap-2 items-center px-4 py-2 bg-panel border-b border-line print:hidden! stacked:flex-wrap stacked:px-2">
      <span className="font-bold tracking-[.06em] mr-3">Prisma</span>
      <MenuBar menus={menus} />
      <span className="text-muted ml-2 truncate min-w-[6em] stacked:flex-1" title={tip || undefined}>
        {fileName}
        {!saved && (
          <>
            <span className="text-accent" aria-hidden>
              {" "}●
            </span>
            <span className="sr-only">, non enregistré</span>
          </>
        )}
      </span>
      {notice && (
        <span className="text-accent ml-3 whitespace-nowrap" role="status">
          {notice}
        </span>
      )}
      <span className="contents stacked:flex stacked:order-last stacked:w-full stacked:items-center stacked:gap-1">{children}</span>
      <Button kind="quiet" size="icon" onClick={onOptions} pressed={optionsOpen} aria-controls="options" title="Options" aria-label="Options">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M6.7 1h2.6l.4 1.9 1 .5 1.7-1 1.8 1.8-1 1.7.5 1 1.9.4v2.6l-1.9.4-.5 1 1 1.7-1.8 1.8-1.7-1-1 .5-.4 1.9H6.7l-.4-1.9-1-.5-1.7 1-1.8-1.8 1-1.7-.5-1L.4 9.3V6.7l1.9-.4.5-1-1-1.7 1.8-1.8 1.7 1 1-.5zM8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"
          />
        </svg>
      </Button>
    </header>
  );
}
