import { useContext } from "react";
import type { ReactNode } from "react";
import { IdeaKindContext } from "./Idea.tsx";

/** Le texte d'une idée, et ses listes ; plus large dans une idée large. */
export function IdeaText({ children }: { children: ReactNode }) {
  const wide = useContext(IdeaKindContext) === "wide";
  return <div className={`${wide ? "max-w-[44em]" : "max-w-[34em]"} [&_ul]:mb-[18px] [&_ul]:pl-[1.2em] [&_li]:mb-1.5`}>{children}</div>;
}
