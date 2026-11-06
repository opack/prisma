/** Ce que montre une barre des menus : ses menus, chacun avec ses actions, séparées de traits. */
export type MenuItem = { label: string; onSelect: () => void; shortcut?: string; disabled?: boolean; checked?: boolean } | "separator";
export type MenuDef = { label: string; items: MenuItem[] };
