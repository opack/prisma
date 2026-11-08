/** Ce que montre une barre des menus : ses menus, chacun avec ses actions, séparées de traits. */
export type MenuItem = { label: string; onSelect: () => void; shortcut?: string; disabled?: boolean; checked?: boolean } | "separator";
export type MenuDef = { label: string; items: MenuItem[] };

/** La largeur où la barre laisse la place au seul « Menu » (la variante compact:, dans tailwind.css). */
export const COMPACT = "(max-width: 1100px), (pointer: coarse) and (max-width: 1220px)";
