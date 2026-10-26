/** Les champs d'une fenêtre (la partie, l'instrument, l'accordage…), côte à côte. */
import type { ReactNode } from "react";

export function Fields({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-x-3.5 gap-y-2.5">{children}</div>;
}
