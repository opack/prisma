/**
 * Les parties d'une page, sous un bouton qui dit celle qu'on lit (« Sommaire · 3. Le temps ») et
 * ouvre leur liste, de sa largeur : une partie en gras, une sous-partie en retrait, celle qu'on lit à
 * l'accent. Le bouton est sur une bande blanche, de toute la largeur ; sa place (collée en haut, fixée en haut
 * de l'écran, sur un écran étroit seulement…), className, dépend de la page.
 */
import { Children, isValidElement } from "react";
import type { ReactNode } from "react";
import { Menu, MenuItem, MenuTrigger, Popover, Pressable } from "react-aria-components";
import { Button } from "./button/Button.tsx";

export type ContentsEntry = { id: string; label: ReactNode; depth?: 2 | 3 };

/** Le texte d'un nom de partie, sans sa mise en forme (« Le fa dièse »), pour la frappe d'une lettre. */
function plain(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : isValidElement<{ children?: ReactNode }>(child)
          ? plain(child.props.children)
          : "",
    )
    .join("");
}

export function ContentsMenu({
  title,
  entries,
  current,
  onGo,
  className = "",
}: {
  title: string;
  entries: ContentsEntry[];
  current?: string;
  onGo: (id: string) => void;
  className?: string;
}) {
  // la partie lue, ou, dans une sous-partie, la partie qui la contient
  const at = entries.findIndex((contentsEntry) => contentsEntry.id === current);
  const part = entries
    .slice(0, at + 1)
    .filter((entry) => (entry.depth ?? 2) === 2)
    .pop();
  return (
    <div className={`${className} px-4 py-2 bg-white border-b border-line`}>
      {/* à la largeur des pages du site, calé sur leur texte */}
      <div className="max-w-[1112px] mx-auto">
        <MenuTrigger>
          <Pressable>
            <Button className="w-full max-w-[560px] min-w-0">
              <span className="flex flex-1 items-center gap-2 min-w-0 py-0.5 text-left">
                <span className="flex-none font-semibold">{title}</span>
                {part && <span className="truncate text-muted">{part.label}</span>}
                <svg className="ml-auto flex-none" width="10" height="16" viewBox="0 0 8 16" aria-hidden>
                  <path d="M1 6.5h6L4 10z" fill="currentColor" />
                </svg>
              </span>
            </Button>
          </Pressable>
          <Popover
            className="w-(--trigger-width) overflow-y-auto p-1 bg-white border border-line rounded-md shadow-[0_6px_18px_rgba(0,0,0,0.12)] text-[14px] leading-[1.35] outline-none"
            placement="bottom start"
            offset={4}
          >
            <Menu className="grid outline-none" aria-label={title} onAction={(id) => onGo(String(id))}>
              {entries.map((entry) => {
                const sub = entry.depth === 3;
                return (
                  <MenuItem
                    key={entry.id}
                    id={entry.id}
                    textValue={plain(entry.label)}
                    className={`py-1.5 px-2.5 rounded outline-none cursor-pointer data-focused:bg-panel ${sub ? "pl-[22px]" : "font-semibold"} ${entry.id === current ? "text-accent" : sub ? "text-muted" : "text-ink"}`}
                  >
                    {entry.label}
                  </MenuItem>
                );
              })}
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
    </div>
  );
}
