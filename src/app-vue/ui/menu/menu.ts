/** Ce que partagent la barre des menus et son menu unique : leur panneau, leurs lignes, la largeur où l'un remplace l'autre. */

export const PANEL =
  "w-auto min-w-[260px] overflow-y-auto p-1 bg-white border border-line rounded-md ring-0 shadow-[0_6px_18px_rgba(0,0,0,0.12)] text-ink outline-none";

export const ITEM =
  "grid grid-cols-[1.2em_1fr_auto] items-center gap-2 px-2.5 py-1.5 text-[length:inherit] whitespace-nowrap rounded cursor-default outline-none focus:bg-panel data-disabled:opacity-50";

/** La largeur où la barre laisse la place au seul « Menu » (la variante compact:, dans tailwind.css). */
export const COMPACT = "(max-width: 1100px), (pointer: coarse) and (max-width: 1220px)";
