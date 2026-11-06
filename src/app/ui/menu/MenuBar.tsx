/**
 * La barre des menus de l'application (Fichier, Partition, Affichage, Aide), comme dans une
 * application de bureau : un clic sur un titre ouvre son menu ; un menu ouvert, le survol d'un autre
 * titre, ou les flèches gauche et droite, passent à celui-ci ; les flèches passent aussi d'un titre
 * à l'autre, menus fermés ; Tab ferme le menu et passe au titre suivant ; Échap, ou un clic ailleurs,
 * le ferme. Quand la place manque, un seul bouton « Menu » (trois traits), qui peut porter en tête
 * le nom du morceau (heading) : un titre choisi (un clic, Entrée, la
 * flèche droite) montre ses actions à la place des titres, « ‹ Menu » (ou la flèche gauche) y revient ;
 * pas de sous-menu à rejoindre à la souris, ni de place à trouver à côté sur un téléphone. Une
 * action montre son raccourci (pas sur un téléphone) ; une action qui se coche (l'éditeur,
 * l'ajustement) se dit cochée. Sur les briques de React Aria : MenuTrigger, Menu.
 */
import { Fragment, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Header, Keyboard, Menu, MenuItem as Item, MenuSection, MenuTrigger, Popover, Pressable, Separator } from "react-aria-components";
import { Button } from "../button/Button.tsx";

import type { MenuDef, MenuItem } from "./menu.ts";

export type { MenuDef, MenuItem };

type Action = Exclude<MenuItem, "separator">;
/** Un groupe d'actions, entre deux traits. */
type Group = { separated: boolean; actions: Action[] };

/** Une action se coche-t-elle. */
const checkable = (action: Action) => action.checked !== undefined;

/**
 * Les actions, en groupes : un trait en commence un nouveau, et, sans rien dessiner, le passage
 * d'actions qui se cochent à d'autres qui ne se cochent pas (chacune se dit ainsi cochée ou non).
 */
function groups(items: MenuItem[]): Group[] {
  const all: Group[] = [];
  let group: Group = { separated: false, actions: [] };
  const close = () => group.actions.length && all.push(group);
  for (const item of items) {
    if (item === "separator") {
      close();
      group = { separated: true, actions: [] };
    } else {
      if (group.actions.length && checkable(group.actions[0]) !== checkable(item)) {
        close();
        group = { separated: false, actions: [] };
      }
      group.actions.push(item);
    }
  }
  close();
  return all;
}

const PANEL = "min-w-[260px] overflow-y-auto p-1 bg-white border border-line rounded-md shadow-[0_6px_18px_rgba(0,0,0,0.12)] outline-none";
const ITEM =
  "grid grid-cols-[1.2em_1fr_auto] items-center gap-2 px-2.5 py-1.5 whitespace-nowrap rounded cursor-default outline-none data-focused:bg-panel data-disabled:opacity-50";

/** Les actions d'un menu, par groupes, séparés d'un trait. */
function Actions({ items }: { items: MenuItem[] }) {
  return groups(items).map((group, index) => (
    <Fragment key={index}>
      {group.separated && <Separator id={`trait-${index}`} className="mx-1.5 my-1 border-0 border-t border-line" />}
      <MenuSection
        id={`groupe-${index}`}
        className="grid"
        {...(checkable(group.actions[0]) && {
          selectionMode: "multiple" as const,
          selectedKeys: group.actions.filter((action) => action.checked).map((action) => action.label),
        })}
      >
        {group.actions.map((action) => (
          <Item
            key={action.label}
            id={action.label}
            textValue={action.label}
            isDisabled={action.disabled}
            onAction={action.onSelect}
            className={ITEM}
          >
            {({ isSelected }) => (
              <>
                <span className="text-accent">{isSelected ? "✓" : ""}</span>
                <span>{action.label}</span>
                {action.shortcut && <Keyboard className="text-muted text-[12px] font-[inherit] phone:hidden">{action.shortcut}</Keyboard>}
              </>
            )}
          </Item>
        ))}
      </MenuSection>
    </Fragment>
  ));
}

export function MenuBar({ menus, heading }: { menus: MenuDef[]; heading?: ReactNode }) {
  return (
    <>
      <Bar menus={menus} />
      <CompactMenu menus={menus} heading={heading} />
    </>
  );
}

/** Les menus côte à côte, quand il y a la place. */
function Bar({ menus }: { menus: MenuDef[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  // la fenêtre rétrécie, la barre laisse la place au seul « Menu » : le menu ouvert se ferme
  const compact = useMedia(COMPACT);
  useEffect(() => void (compact && setOpen(null)), [compact]);
  const panel = useRef<HTMLDivElement>(null);
  // le dernier menu fermé, et quand : un clic sur son titre le ferme (le focus, en quittant le menu,
  // l'a déjà fermé), il ne le rouvre pas
  const closed = useRef({ menu: -1, at: 0 });
  const change = (index: number) => (isOpen: boolean) => {
    if (!isOpen) {
      closed.current = { menu: index, at: performance.now() };
      setOpen((current) => (current === index ? null : current));
    } else if (!(closed.current.menu === index && performance.now() - closed.current.at < 300)) setOpen(index);
  };

  // un menu ouvert : un clic hors de la barre et du menu le ferme (ses titres, eux, passent d'un menu à l'autre)
  useEffect(() => {
    if (open === null) return;
    const away = (event: PointerEvent) =>
      !bar.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node) && setOpen(null);
    addEventListener("pointerdown", away, true);
    return () => removeEventListener("pointerdown", away, true);
  }, [open]);

  // dans un menu ouvert, les flèches passent au menu voisin ; menus fermés, au titre voisin
  const step = (index: number, key: string) => (index + (key === "ArrowRight" ? 1 : menus.length - 1)) % menus.length;
  const inMenu = (index: number) => (event: KeyboardEvent) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(step(index, event.key));
  };
  const onTitle = (index: number) => (event: KeyboardEvent) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    bar.current?.querySelectorAll("button")[step(index, event.key)]?.focus();
  };

  return (
    <div ref={bar} className="flex gap-2 compact:hidden" role="group" aria-label="Menus">
      {menus.map((menuDef, index) => (
        <MenuTrigger key={menuDef.label} isOpen={open === index} onOpenChange={change(index)}>
          <Pressable>
            <Button kind="quiet" onPointerEnter={() => open !== null && open !== index && setOpen(index)} onKeyDown={onTitle(index)}>
              {menuDef.label}
            </Button>
          </Pressable>
          <Popover ref={open === index ? panel : undefined} className={PANEL} placement="bottom start" offset={4} isNonModal>
            <div onKeyDownCapture={inMenu(index)}>
              <Menu className="grid outline-none" aria-label={menuDef.label} shouldCloseOnSelect onAction={() => setOpen(null)}>
                <Actions items={menuDef.items} />
              </Menu>
            </div>
          </Popover>
        </MenuTrigger>
      ))}
    </div>
  );
}

/** Si l'écran répond à une requête (« (max-width: 600px) »), suivi s'il change. */
function useMedia(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mediaQueryList = matchMedia(query);
    const on = () => setMatches(mediaQueryList.matches);
    mediaQueryList.addEventListener("change", on);
    return () => mediaQueryList.removeEventListener("change", on);
  }, [query]);
  return matches;
}

/** La largeur où la barre laisse la place au seul « Menu » (la variante compact:, dans tailwind.css). */
const COMPACT = "(max-width: 1100px), (pointer: coarse) and (max-width: 1220px)";

/**
 * Quand la place manque : un seul bouton « Menu », dont un titre choisi montre ses actions à la place
 * des titres ; en tête des titres, ce qu'on lui donne (le nom du morceau, sur un téléphone).
 */
function CompactMenu({ menus, heading }: { menus: MenuDef[]; heading?: ReactNode }) {
  // la fenêtre élargie, la barre revient : le menu ouvert se ferme avec son bouton
  const compact = useMedia(COMPACT);
  const [open, setOpen] = useState(false);
  useEffect(() => void (compact || setOpen(false)), [compact]);
  // le titre choisi : ses actions remplacent les titres, sous « ‹ Menu », qui y revient
  const [section, setSection] = useState<number | null>(null);
  const change = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) setSection(null);
  };
  const menu = section === null ? null : menus[section];
  const enter = (index: number) => index >= 0 && setSection(index);
  return (
    <span className="hidden compact:block">
      <MenuTrigger isOpen={open && compact} onOpenChange={change}>
        <Pressable>
          <Button kind="quiet" size="icon" title="Menu" aria-label="Menu">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
              <path fill="currentColor" d="M2 3.25h12v1.5H2zM2 7.25h12v1.5H2zM2 11.25h12v1.5H2z" />
            </svg>
          </Button>
        </Pressable>
        <Popover className={PANEL} placement="bottom start" offset={4}>
          {menu ? (
            // la flèche gauche revient aux titres, comme « ‹ Menu »
            <div onKeyDownCapture={(event) => event.key === "ArrowLeft" && (event.preventDefault(), setSection(null))}>
              <Menu key={menu.label} className="grid outline-none" aria-label={menu.label} autoFocus="first" shouldCloseOnSelect>
                <MenuSection className="grid">
                  <Item
                    id="retour"
                    textValue="Menu"
                    onAction={() => setSection(null)}
                    shouldCloseOnSelect={false}
                    className={`${ITEM} text-muted`}
                  >
                    <span aria-hidden>‹</span>
                    <span>Menu</span>
                  </Item>
                </MenuSection>
                <Header className="mt-1 mb-0.5 px-2.5 text-muted text-[12px] font-semibold">{menu.label}</Header>
                <Actions items={menu.items} />
              </Menu>
            </div>
          ) : (
            // la flèche droite ouvre le titre, comme Entrée
            <div
              onKeyDownCapture={(event) =>
                event.key === "ArrowRight" &&
                (event.preventDefault(),
                enter(
                  menus.findIndex(
                    (menuDef) => menuDef.label === (event.target as HTMLElement).closest<HTMLElement>("[data-key]")?.dataset.key,
                  ),
                ))
              }
            >
              {heading}
              <Menu key="titres" className="grid outline-none" aria-label="Menu" autoFocus="first">
                {menus.map((menuDef, index) => (
                  <Item
                    key={menuDef.label}
                    id={menuDef.label}
                    textValue={menuDef.label}
                    onAction={() => setSection(index)}
                    shouldCloseOnSelect={false}
                    className={ITEM}
                  >
                    <span />
                    <span>{menuDef.label}</span>
                    <span className="text-muted" aria-hidden>
                      ›
                    </span>
                  </Item>
                ))}
              </Menu>
            </div>
          )}
        </Popover>
      </MenuTrigger>
    </span>
  );
}
