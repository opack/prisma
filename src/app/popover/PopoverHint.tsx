/** Le mot d'explication d'un panneau, en bas. */
import type { ReactNode } from "react";
import { HINT } from "./hint.ts";

export function PopoverHint({ children }: { children: ReactNode }) {
  return <p className={HINT}>{children}</p>;
}
