import type { ReactNode } from "react";

/** Les boutons d'appel, côte à côte. */
export function Actions({ children }: { children: ReactNode }) {
  return <p className="flex flex-wrap gap-3 mt-7">{children}</p>;
}
